const express = require('express');
const router = express.Router();
const ownerParkingController = require('../controllers/ownerParkingController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleGuard');

// All owner routes require authentication and OWNER role
router.use(authenticateToken, requireRole('OWNER'));

router.get('/bookings', ownerParkingController.getOwnerBookings);
router.post('/bookings/:id/extension-response', ownerParkingController.respondToExtension);

router.get('/', ownerParkingController.getMySpots);
router.post('/', ownerParkingController.createSpot);
router.get('/:id', ownerParkingController.getSpotById);
router.put('/:id', ownerParkingController.updateSpot);
router.delete('/:id', ownerParkingController.deleteSpot);

module.exports = router;
