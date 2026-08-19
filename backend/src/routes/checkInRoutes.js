const express = require('express');
const router = express.Router();
const checkInController = require('../controllers/checkInController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleGuard');

router.use(authenticateToken, requireRole('OWNER'));

router.post('/checkin', checkInController.checkIn);
router.post('/checkout', checkInController.checkOut);

module.exports = router;
