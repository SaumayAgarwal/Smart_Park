const { prisma } = require('../config/db');
const smsService = require('../services/smsService');
const { emitToDriver } = require('../socket/socketHandler');
const { publishBookingEvent } = require('../kafka/producer');

class OwnerParkingController {
  // GET /api/owner/parking
  async getMySpots(req, res, next) {
    try {
      const ownerId = req.user.id;
      const spots = await prisma.parkingSpot.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        message: 'Fetched parking spots successfully',
        data: spots.map((s) => ({
          ...s,
          id: Number(s.id),
          ownerId: Number(s.ownerId),
          pricePerHour: Number(s.pricePerHour),
          peakPricePerHour: s.peakPricePerHour ? Number(s.peakPricePerHour) : null,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/owner/parking
  async createSpot(req, res, next) {
    try {
      const ownerId = req.user.id;
      const {
        title,
        description,
        address,
        city,
        latitude,
        longitude,
        pricePerHour,
        peakPricePerHour,
        capacity,
        covered,
        securityAvailable,
        evChargingAvailable,
        imageUrl,
        operatingHours,
      } = req.body;

      if (!title || !address || !city || latitude === undefined || longitude === undefined || !pricePerHour) {
        return res.status(400).json({ success: false, message: 'Missing required spot fields' });
      }

      const spot = await prisma.parkingSpot.create({
        data: {
          ownerId,
          title,
          description: description || title,
          address,
          city,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          pricePerHour: parseFloat(pricePerHour),
          peakPricePerHour: peakPricePerHour ? parseFloat(peakPricePerHour) : null,
          capacity: capacity ? parseInt(capacity, 10) : 1,
          covered: Boolean(covered),
          securityAvailable: Boolean(securityAvailable),
          evChargingAvailable: Boolean(evChargingAvailable),
          imageUrl: imageUrl || null,
          operatingHours: operatingHours || null,
          status: 'AVAILABLE',
        },
      });

      res.json({
        success: true,
        message: 'Parking spot created successfully',
        data: {
          ...spot,
          id: Number(spot.id),
          ownerId: Number(spot.ownerId),
          pricePerHour: Number(spot.pricePerHour),
          peakPricePerHour: spot.peakPricePerHour ? Number(spot.peakPricePerHour) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/owner/parking/:id
  async getSpotById(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const ownerId = req.user.id;

      const spot = await prisma.parkingSpot.findFirst({
        where: { id, ownerId },
      });

      if (!spot) {
        return res.status(404).json({ success: false, message: 'Parking spot not found' });
      }

      res.json({
        success: true,
        message: 'Fetched parking spot successfully',
        data: {
          ...spot,
          id: Number(spot.id),
          ownerId: Number(spot.ownerId),
          pricePerHour: Number(spot.pricePerHour),
          peakPricePerHour: spot.peakPricePerHour ? Number(spot.peakPricePerHour) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/owner/parking/:id
  async updateSpot(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const ownerId = req.user.id;

      const existing = await prisma.parkingSpot.findFirst({
        where: { id, ownerId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Parking spot not found or unauthorized' });
      }

      const {
        title,
        description,
        address,
        city,
        latitude,
        longitude,
        pricePerHour,
        peakPricePerHour,
        capacity,
        covered,
        securityAvailable,
        evChargingAvailable,
        imageUrl,
        operatingHours,
      } = req.body;

      const updated = await prisma.parkingSpot.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(address && { address }),
          ...(city && { city }),
          ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
          ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
          ...(pricePerHour !== undefined && { pricePerHour: parseFloat(pricePerHour) }),
          ...(peakPricePerHour !== undefined && { peakPricePerHour: peakPricePerHour ? parseFloat(peakPricePerHour) : null }),
          ...(capacity !== undefined && { capacity: parseInt(capacity, 10) }),
          ...(covered !== undefined && { covered: Boolean(covered) }),
          ...(securityAvailable !== undefined && { securityAvailable: Boolean(securityAvailable) }),
          ...(evChargingAvailable !== undefined && { evChargingAvailable: Boolean(evChargingAvailable) }),
          ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
          ...(operatingHours !== undefined && { operatingHours: operatingHours || null }),
        },
      });

      res.json({
        success: true,
        message: 'Parking spot updated successfully',
        data: {
          ...updated,
          id: Number(updated.id),
          ownerId: Number(updated.ownerId),
          pricePerHour: Number(updated.pricePerHour),
          peakPricePerHour: updated.peakPricePerHour ? Number(updated.peakPricePerHour) : null,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/owner/parking/:id
  async deleteSpot(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const ownerId = req.user.id;

      const existing = await prisma.parkingSpot.findFirst({
        where: { id, ownerId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, message: 'Parking spot not found or unauthorized' });
      }

      await prisma.parkingSpot.delete({ where: { id } });

      res.json({
        success: true,
        message: 'Parking spot deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/owner/parking/bookings
  async getOwnerBookings(req, res, next) {
    try {
      const ownerId = req.user.id;

      const bookings = await prisma.booking.findMany({
        where: {
          parkingSpot: {
            ownerId,
          },
        },
        include: {
          user: true,
          parkingSpot: true,
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
        message: 'Fetched owner spot bookings successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/owner/parking/bookings/:id/extension-response
  async respondToExtension(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const approve = req.query.approve === 'true';
      const ownerId = req.user.id;

      const booking = await prisma.booking.findUnique({
        where: { id },
        include: {
          parkingSpot: true,
          user: true,
        },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      if (booking.parkingSpot.ownerId !== ownerId) {
        return res.status(403).json({ success: false, message: "You don't have permission for this booking" });
      }

      let updated;
      const extraHours = booking.extensionHours || 1;

      if (approve) {
        const newEndTime = new Date(booking.endTime.getTime() + extraHours * 3600000);
        const extraAmount = Number(booking.parkingSpot.pricePerHour) * extraHours;
        const newTotalAmount = Number(booking.amount) + extraAmount;

        updated = await prisma.booking.update({
          where: { id },
          data: {
            endTime: newEndTime,
            amount: newTotalAmount,
            status: 'CONFIRMED',
            extensionHours: null,
          },
          include: { user: true, parkingSpot: true },
        });

        // Notify driver via Socket.io
        emitToDriver(booking.user.email, 'EXTENSION_APPROVED', {
          type: 'EXTENSION_APPROVED',
          message: `Your extension request for +${extraHours}h was approved!`,
          bookingId: Number(booking.id),
        });
      } else {
        updated = await prisma.booking.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            extensionHours: null,
          },
          include: { user: true, parkingSpot: true },
        });

        // Notify driver via Socket.io
        emitToDriver(booking.user.email, 'EXTENSION_DECLINED', {
          type: 'EXTENSION_DECLINED',
          message: `Your extension request was declined.`,
          bookingId: Number(booking.id),
        });
      }

      // Send SMS to Driver
      if (booking.user?.phone) {
        smsService.sendExtensionResponseSms(booking.user.phone, {
          bookingReference: booking.bookingReference,
          approved: approve,
          extensionHours: extraHours,
        });
      }

      // Publish to Apache Kafka event pipeline
      publishBookingEvent(approve ? 'EXTENSION_APPROVED' : 'EXTENSION_DECLINED', {
        driverEmail: booking.user.email,
        driverPhone: booking.user?.phone,
        bookingReference: booking.bookingReference,
        bookingId: Number(updated.id),
        extraHours,
      });

      res.json({
        success: true,
        message: approve ? 'Extension approved successfully' : 'Extension declined',
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

module.exports = new OwnerParkingController();
