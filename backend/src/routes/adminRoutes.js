const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleGuard');

router.use(authenticateToken, requireRole('ADMIN'));

router.get('/dashboard', adminController.getDashboardAnalytics);

module.exports = router;
