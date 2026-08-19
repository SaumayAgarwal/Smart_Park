const { prisma } = require('../config/db');

class CheckInController {
  // POST /api/owner/scan/checkin
  async checkIn(req, res, next) {
    try {
      const ownerId = req.user.id;
      const { qrToken } = req.body;

      if (!qrToken) {
        return res.status(400).json({ success: false, message: 'QR token is required' });
      }

      const booking = await prisma.booking.findFirst({
        where: { qrCode: qrToken },
        include: { parkingSpot: true, user: true },
      });

      if (!booking) {
        return res.status(400).json({ success: false, message: 'Invalid QR Code. No booking found.' });
      }

      if (booking.parkingSpot.ownerId !== ownerId) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied. You do not own the parking spot for this booking.',
        });
      }

      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({
          success: false,
          message: `Cannot check-in. Booking status is: ${booking.status}`,
        });
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'ACTIVE' },
        include: { parkingSpot: true, user: true },
      });

      res.json({
        success: true,
        message: 'Check-in successful! Driver is now ACTIVE.',
        data: {
          id: Number(updated.id),
          parkingSpotId: Number(updated.parkingSpotId),
          parkingSpotTitle: updated.parkingSpot.title,
          startTime: updated.startTime,
          endTime: updated.endTime,
          amount: Number(updated.amount),
          status: updated.status,
          bookingReference: updated.bookingReference,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/owner/scan/checkout
  async checkOut(req, res, next) {
    try {
      const ownerId = req.user.id;
      const { qrToken } = req.body;

      if (!qrToken) {
        return res.status(400).json({ success: false, message: 'QR token is required' });
      }

      const booking = await prisma.booking.findFirst({
        where: { qrCode: qrToken },
        include: { parkingSpot: true, user: true },
      });

      if (!booking) {
        return res.status(400).json({ success: false, message: 'Invalid QR Code. No booking found.' });
      }

      if (booking.parkingSpot.ownerId !== ownerId) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied. You do not own the parking spot for this booking.',
        });
      }

      if (booking.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message: 'Cannot check-out. Driver has not checked in yet.',
        });
      }

      const updated = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED' },
        include: { parkingSpot: true, user: true },
      });

      res.json({
        success: true,
        message: 'Check-out successful! Booking is now COMPLETED.',
        data: {
          id: Number(updated.id),
          parkingSpotId: Number(updated.parkingSpotId),
          parkingSpotTitle: updated.parkingSpot.title,
          startTime: updated.startTime,
          endTime: updated.endTime,
          amount: Number(updated.amount),
          status: updated.status,
          bookingReference: updated.bookingReference,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CheckInController();
