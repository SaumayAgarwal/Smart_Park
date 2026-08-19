const { prisma } = require('../config/db');

class AdminController {
  // GET /api/admin/dashboard
  async getDashboardAnalytics(req, res, next) {
    try {
      const [totalUsers, totalSpots, activeBookings, confirmedBookings] = await Promise.all([
        prisma.user.count(),
        prisma.parkingSpot.count(),
        prisma.booking.count({
          where: {
            status: { in: ['CONFIRMED', 'ACTIVE', 'EXTENSION_REQUESTED'] },
          },
        }),
        prisma.booking.findMany({
          where: {
            status: { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] },
          },
          select: { amount: true, cancellationFee: true, status: true },
        }),
      ]);

      const totalRevenue = confirmedBookings.reduce((sum, b) => {
        return sum + Number(b.amount || 0);
      }, 0);

      res.json({
        success: true,
        message: 'Admin analytics fetched successfully',
        data: {
          totalUsers,
          totalSpots,
          activeBookings,
          totalRevenue,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
