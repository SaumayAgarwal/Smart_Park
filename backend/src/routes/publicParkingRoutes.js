const express = require('express');
const router = express.Router();
const publicParkingController = require('../controllers/publicParkingController');

router.get('/nearby', publicParkingController.searchNearbyParking);
router.get('/:id/availability', publicParkingController.getSpotAvailability);
router.get('/:id', publicParkingController.getParkingDetails);

module.exports = router;
