const { prisma } = require('../config/db');

class ReviewController {
  // POST /api/reviews/booking/:bookingId
  async addReview(req, res, next) {
    try {
      const bookingId = BigInt(req.params.bookingId);
      const userId = req.user.id;
      const { rating, comment } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
      }

      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, userId },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found or unauthorized' });
      }

      const existingReview = await prisma.review.findFirst({
        where: { bookingId },
      });

      if (existingReview) {
        return res.status(400).json({ success: false, message: 'You have already reviewed this booking' });
      }

      const review = await prisma.review.create({
        data: {
          bookingId,
          rating: parseInt(rating, 10),
          comment: comment || null,
        },
      });

      res.json({
        success: true,
        message: 'Review submitted successfully!',
        data: {
          id: Number(review.id),
          bookingId: Number(review.bookingId),
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/reviews/parking/:parkingSpotId
  async getParkingReviews(req, res, next) {
    try {
      const parkingSpotId = BigInt(req.params.parkingSpotId);

      const reviews = await prisma.review.findMany({
        where: {
          booking: {
            parkingSpotId,
          },
        },
        include: {
          booking: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = reviews.map((r) => ({
        id: Number(r.id),
        bookingId: Number(r.bookingId),
        driverName: r.booking.user.name,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      }));

      res.json({
        success: true,
        message: `Fetched ${data.length} reviews.`,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReviewController();
