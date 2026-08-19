const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/booking/:bookingId', authenticateToken, reviewController.addReview);
router.get('/parking/:parkingSpotId', reviewController.getParkingReviews);

module.exports = router;
