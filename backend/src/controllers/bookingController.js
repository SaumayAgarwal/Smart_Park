const { prisma } = require('../config/db');
const lockService = require('../services/lockService');
const smsService = require('../services/smsService');
const { emitToOwner } = require('../socket/socketHandler');
const { publishBookingEvent } = require('../kafka/producer');

class BookingController {
  // POST /api/bookings
  async createBooking(req, res, next) {
    try {
      const driverId = req.user.id;
      const { parkingSpotId, startTime, endTime, vehicleNumber, vehicleType } = req.body;

      if (!parkingSpotId || !startTime || !endTime) {
        return res.status(400).json({ success: false, message: 'Spot ID, start time, and end time are required' });
      }

      const start = new Date(startTime);
      const end = new Date(endTime);

      if (start >= end) {
        return res.status(400).json({ success: false, message: 'End time must be after start time' });
      }

      const spotId = BigInt(parkingSpotId);

      // 1. Acquire spot-level Redis lock to prevent concurrent overlap-check race conditions
      const lockHandle = await lockService.acquireLock(spotId);
      if (lockHandle === null) {
        return res.status(429).json({
          success: false,
          message: 'This parking spot is currently being booked by someone else. Please try again in a moment.',
        });
      }

      try {
        // 2. Fetch spot details
        const spot = await prisma.parkingSpot.findUnique({ where: { id: spotId } });
        if (!spot) {
          return res.status(404).json({ success: false, message: 'Parking spot not found' });
        }

        // 3. Overlap check in DB
        const activeStatuses = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'ACTIVE', 'EXTENSION_REQUESTED'];
        const overlappingCount = await prisma.booking.count({
          where: {
            parkingSpotId: spotId,
            status: { in: activeStatuses },
            startTime: { lt: end },
            endTime: { gt: start },
          },
        });

        const capacity = spot.capacity || 1;
        if (overlappingCount >= capacity) {
          return res.status(400).json({
            success: false,
            message: 'This parking spot is already reserved during the selected time range. Please choose another time slot.',
          });
        }

        // 4. Compute price
        const durationHours = Math.max(1, (end.getTime() - start.getTime()) / 3600000);
        const amount = Number(spot.pricePerHour) * durationHours;

        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const bookingReference = `BKG-${randomSuffix}-${Date.now().toString().slice(-4)}`;

        const booking = await prisma.booking.create({
          data: {
            userId: driverId,
            parkingSpotId: spotId,
            startTime: start,
            endTime: end,
            amount,
            status: 'PAYMENT_PENDING',
            bookingReference,
            vehicleNumber: vehicleNumber || null,
            vehicleType: vehicleType || null,
          },
          include: { user: true, parkingSpot: true },
        });

        res.json({
          success: true,
          message: 'Booking created successfully. Pending payment.',
          data: {
            id: Number(booking.id),
            parkingSpotId: Number(booking.parkingSpotId),
            parkingSpotTitle: booking.parkingSpot.title,
            address: booking.parkingSpot.address,
            startTime: booking.startTime,
            endTime: booking.endTime,
            amount: Number(booking.amount),
            status: booking.status,
            bookingReference: booking.bookingReference,
            driverName: booking.user.name,
            driverEmail: booking.user.email,
            driverPhone: booking.user.phone,
            vehicleNumber: booking.vehicleNumber,
            vehicleType: booking.vehicleType,
            createdAt: booking.createdAt,
          },
        });
      } finally {
        // Always release the lock after the critical section
        await lockService.releaseLock(lockHandle);
      }
    } catch (err) {
      next(err);
    }
  }

  // GET /api/bookings/my
  async getMyBookings(req, res, next) {
    try {
      const driverId = req.user.id;
      const bookings = await prisma.booking.findMany({
        where: { userId: driverId },
        include: {
          parkingSpot: true,
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = bookings.map((b) => ({
        id: Number(b.id),
        parkingSpotId: Number(b.parkingSpotId),
        parkingSpotTitle: b.parkingSpot.title,
        address: b.parkingSpot.address,
        startTime: b.startTime,
        endTime: b.endTime,
        amount: Number(b.amount),
        status: b.status,
        bookingReference: b.bookingReference,
        driverName: b.user.name,
        driverEmail: b.user.email,
        driverPhone: b.user.phone,
        qrCodeToken: b.qrCode,
        vehicleNumber: b.vehicleNumber,
        vehicleType: b.vehicleType,
        extensionHours: b.extensionHours,
        cancellationFee: b.cancellationFee ? Number(b.cancellationFee) : null,
        imageUrl: b.parkingSpot.imageUrl,
        operatingHours: b.parkingSpot.operatingHours,
        latitude: b.parkingSpot.latitude,
        longitude: b.parkingSpot.longitude,
        createdAt: b.createdAt,
      }));

      res.json({
        success: true,
        message: 'Fetched bookings successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/bookings/:id
  async getBookingDetails(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const userId = req.user.id;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          parkingSpot: { include: { owner: true } },
          user: true,
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      // Check authorization (driver, owner of spot, or admin)
      if (
        booking.userId !== userId &&
        booking.parkingSpot.ownerId !== userId &&
        req.user.role !== 'ADMIN'
      ) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      res.json({
        success: true,
        message: 'Fetched booking details successfully',
        data: {
          id: Number(booking.id),
          parkingSpotId: Number(booking.parkingSpotId),
          parkingSpotTitle: booking.parkingSpot.title,
          address: booking.parkingSpot.address,
          startTime: booking.startTime,
          endTime: booking.endTime,
          amount: Number(booking.amount),
          status: booking.status,
          bookingReference: booking.bookingReference,
          driverName: booking.user.name,
          driverEmail: booking.user.email,
          driverPhone: booking.user.phone,
          qrCodeToken: booking.qrCode,
          vehicleNumber: booking.vehicleNumber,
          vehicleType: booking.vehicleType,
          extensionHours: booking.extensionHours,
          cancellationFee: booking.cancellationFee ? Number(booking.cancellationFee) : null,
          imageUrl: booking.parkingSpot.imageUrl,
          operatingHours: booking.parkingSpot.operatingHours,
          latitude: booking.parkingSpot.latitude,
          longitude: booking.parkingSpot.longitude,
          createdAt: booking.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/bookings/:id/extend
  async requestExtension(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const driverId = req.user.id;
      const hours = parseInt(req.query.hours || '1', 10);

      const booking = await prisma.booking.findFirst({
        where: { id, userId: driverId },
        include: { parkingSpot: { include: { owner: true } }, user: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          extensionHours: hours,
          status: 'EXTENSION_REQUESTED',
        },
        include: { parkingSpot: true, user: true },
      });

      // Send real-time Socket.io alert to Space Owner
      if (booking.parkingSpot && booking.parkingSpot.owner) {
        emitToOwner(booking.parkingSpot.owner.email, 'EXTENSION_REQUESTED', {
          type: 'EXTENSION_REQUESTED',
          message: `Driver ${booking.user.name} requested a +${hours}h extension on ${booking.parkingSpot.title}`,
          bookingId: Number(booking.id),
        });

        // Send SMS to Space Owner
        if (booking.parkingSpot.owner.phone) {
          smsService.sendExtensionRequestOwnerSms(booking.parkingSpot.owner.phone, {
            bookingReference: booking.bookingReference,
            spotTitle: booking.parkingSpot.title,
            driverName: booking.user.name,
            extensionHours: hours,
          });
        }

        // Publish to Apache Kafka event pipeline
        publishBookingEvent('EXTENSION_REQUESTED', {
          booking: updated,
          ownerEmail: booking.parkingSpot.owner.email,
          ownerPhone: booking.parkingSpot.owner.phone,
          driverName: booking.user.name,
          spotTitle: booking.parkingSpot.title,
          hours,
        });
      }

      res.json({
        success: true,
        message: 'Extension request submitted to space owner',
        data: {
          id: Number(updated.id),
          parkingSpotId: Number(updated.parkingSpotId),
          parkingSpotTitle: updated.parkingSpot.title,
          address: updated.parkingSpot.address,
          startTime: updated.startTime,
          endTime: updated.endTime,
          amount: Number(updated.amount),
          status: updated.status,
          bookingReference: updated.bookingReference,
          driverName: updated.user.name,
          driverEmail: updated.user.email,
          driverPhone: updated.user.phone,
          qrCodeToken: updated.qrCode,
          vehicleNumber: updated.vehicleNumber,
          vehicleType: updated.vehicleType,
          extensionHours: updated.extensionHours,
          cancellationFee: updated.cancellationFee ? Number(updated.cancellationFee) : null,
          createdAt: updated.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/bookings/:id/cancel
  async cancelBooking(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const userId = req.user.id;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          parkingSpot: { include: { owner: true } },
          user: true,
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      const isDriver = booking.userId === userId;
      const isOwner = booking.parkingSpot.ownerId === userId;

      if (!isDriver && !isOwner && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
      }

      let cancellationFee = 0.0;
      let refundAmount = 0.0;

      // Refund calculation if booking was CONFIRMED
      if (isDriver && booking.status === 'CONFIRMED' && booking.amount) {
        const now = new Date();
        const startTime = new Date(booking.startTime);
        const totalAmount = Number(booking.amount);

        if (now < startTime) {
          const minutesUntilStart = (startTime.getTime() - now.getTime()) / (1000 * 60);

          if (minutesUntilStart >= 120) {
            // Cancelled > 2 hours before start -> 100% refund
            refundAmount = totalAmount;
            cancellationFee = 0.0;
          } else {
            // Cancelled < 2 hours before start -> 50% refund, 50% penalty compensation to owner
            refundAmount = Math.round((totalAmount * 0.5) * 100) / 100;
            cancellationFee = totalAmount - refundAmount;
          }
        } else {
          // Cancelled after start time -> 0% refund, 100% to owner
          refundAmount = 0.0;
          cancellationFee = totalAmount;
        }

        // 1. Credit driver wallet
        if (refundAmount > 0) {
          const currentDriverWallet = Number(booking.user.walletBalance || 0);
          await prisma.user.update({
            where: { id: booking.userId },
            data: { walletBalance: currentDriverWallet + refundAmount },
          });
        }

        // 2. Credit owner wallet with cancellation penalty fee
        if (cancellationFee > 0 && booking.parkingSpot && booking.parkingSpot.owner) {
          const currentOwnerWallet = Number(booking.parkingSpot.owner.walletBalance || 0);
          await prisma.user.update({
            where: { id: booking.parkingSpot.ownerId },
            data: { walletBalance: currentOwnerWallet + cancellationFee },
          });
        }
      }

      await lockService.releaseLock(booking.parkingSpotId, booking.startTime, booking.endTime);

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationFee: cancellationFee > 0 ? cancellationFee : null,
        },
        include: { parkingSpot: true, user: true },
      });

      // Send SMS to Driver
      if (booking.user?.phone) {
        smsService.sendBookingCancelledSms(booking.user.phone, {
          bookingReference: booking.bookingReference,
          refundAmount,
        });
      }

      // Publish to Apache Kafka event pipeline
      publishBookingEvent('BOOKING_CANCELLED', {
        bookingId: Number(updated.id),
        bookingReference: updated.bookingReference,
        driverPhone: booking.user?.phone,
        refundAmount,
      });

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: {
          id: Number(updated.id),
          parkingSpotId: Number(updated.parkingSpotId),
          parkingSpotTitle: updated.parkingSpot.title,
          address: updated.parkingSpot.address,
          startTime: updated.startTime,
          endTime: updated.endTime,
          amount: Number(updated.amount),
          status: updated.status,
          bookingReference: updated.bookingReference,
          driverName: updated.user.name,
          driverEmail: updated.user.email,
          driverPhone: updated.user.phone,
          qrCodeToken: updated.qrCode,
          vehicleNumber: updated.vehicleNumber,
          vehicleType: updated.vehicleType,
          extensionHours: updated.extensionHours,
          cancellationFee: updated.cancellationFee ? Number(updated.cancellationFee) : null,
          createdAt: updated.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BookingController();
