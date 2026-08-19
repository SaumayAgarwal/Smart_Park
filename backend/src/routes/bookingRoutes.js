const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', bookingController.createBooking);
router.get('/my', bookingController.getMyBookings);
router.get('/:id', bookingController.getBookingDetails);
router.post('/:id/extend', bookingController.requestExtension);
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
