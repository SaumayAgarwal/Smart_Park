const { prisma } = require('../config/db');

const EARTH_RADIUS_KM = 6371.0;

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

class PublicParkingController {
  // GET /api/parking/nearby
  async searchNearbyParking(req, res, next) {
    try {
      const lat = parseFloat(req.query.latitude);
      const lon = parseFloat(req.query.longitude);
      const radiusKm = parseFloat(req.query.radiusKm || '5.0');
      const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : null;
      const covered = req.query.covered === 'true' ? true : req.query.covered === 'false' ? false : null;
      const security = req.query.security === 'true' ? true : req.query.security === 'false' ? false : null;
      const evCharging = req.query.evCharging === 'true' ? true : req.query.evCharging === 'false' ? false : null;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
      }

      // 1. Calculate Bounding Box
      const latDelta = radiusKm / 111.0;
      const lonDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLon = lon - lonDelta;
      const maxLon = lon + lonDelta;

      // 2. Fetch spots within bounding box from DB
      const spots = await prisma.parkingSpot.findMany({
        where: {
          status: 'AVAILABLE',
          latitude: { gte: minLat, lte: maxLat },
          longitude: { gte: minLon, lte: maxLon },
          ...(maxPrice !== null && { pricePerHour: { lte: maxPrice } }),
          ...(covered === true && { covered: true }),
          ...(security === true && { securityAvailable: true }),
          ...(evCharging === true && { evChargingAvailable: true }),
        },
      });

      const now = new Date();
      const activeStatuses = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'ACTIVE'];

      // 3. Filter with exact Haversine distance and compute real-time capacity
      const results = [];
      for (const spot of spots) {
        const exactDistance = calculateHaversineDistance(lat, lon, spot.latitude, spot.longitude);
        if (exactDistance > radiusKm) continue;

        // Count overlapping active bookings right now
        const activeBookingsCount = await prisma.booking.count({
          where: {
            parkingSpotId: spot.id,
            status: { in: activeStatuses },
            startTime: { lte: now },
            endTime: { gte: now },
          },
        });

        const totalCapacity = spot.capacity || 1;
        const available = Math.max(0, totalCapacity - activeBookingsCount);

        if (available > 0) {
          results.push({
            id: Number(spot.id),
            title: spot.title,
            address: spot.address,
            city: spot.city,
            latitude: spot.latitude,
            longitude: spot.longitude,
            pricePerHour: Number(spot.pricePerHour),
            peakPricePerHour: spot.peakPricePerHour ? Number(spot.peakPricePerHour) : null,
            capacity: spot.capacity,
            availableSpots: available,
            covered: spot.covered,
            securityAvailable: spot.securityAvailable,
            evChargingAvailable: spot.evChargingAvailable,
            imageUrl: spot.imageUrl,
            operatingHours: spot.operatingHours,
            distanceKm: Math.round(exactDistance * 10) / 10,
          });
        }
      }

      results.sort((a, b) => a.distanceKm - b.distanceKm);

      res.json({
        success: true,
        message: `Found ${results.length} parking spots nearby`,
        data: results,
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/parking/:id
  async getParkingDetails(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const userLat = req.query.userLat ? parseFloat(req.query.userLat) : null;
      const userLon = req.query.userLon ? parseFloat(req.query.userLon) : null;

      const spot = await prisma.parkingSpot.findUnique({
        where: { id },
      });

      if (!spot) {
        return res.status(404).json({ success: false, message: 'Parking spot not found' });
      }

      let distance = 0.0;
      if (userLat !== null && userLon !== null) {
        distance = calculateHaversineDistance(userLat, userLon, spot.latitude, spot.longitude);
      }

      const now = new Date();
      const activeStatuses = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'ACTIVE'];

      const activeBookingsCount = await prisma.booking.count({
        where: {
          parkingSpotId: spot.id,
          status: { in: activeStatuses },
          startTime: { lte: now },
          endTime: { gte: now },
        },
      });

      const totalCapacity = spot.capacity || 1;
      const available = Math.max(0, totalCapacity - activeBookingsCount);

      res.json({
        success: true,
        message: 'Fetched parking details successfully',
        data: {
          id: Number(spot.id),
          title: spot.title,
          description: spot.description,
          address: spot.address,
          city: spot.city,
          latitude: spot.latitude,
          longitude: spot.longitude,
          pricePerHour: Number(spot.pricePerHour),
          peakPricePerHour: spot.peakPricePerHour ? Number(spot.peakPricePerHour) : null,
          capacity: spot.capacity,
          availableSpots: available,
          covered: spot.covered,
          securityAvailable: spot.securityAvailable,
          evChargingAvailable: spot.evChargingAvailable,
          imageUrl: spot.imageUrl,
          operatingHours: spot.operatingHours,
          distanceKm: Math.round(distance * 10) / 10,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/parking/:id/availability
  async getSpotAvailability(req, res, next) {
    try {
      const id = BigInt(req.params.id);
      const now = new Date();
      const activeStatuses = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'ACTIVE', 'EXTENSION_REQUESTED'];

      const upcomingBookings = await prisma.booking.findMany({
        where: {
          parkingSpotId: id,
          status: { in: activeStatuses },
          endTime: { gt: now },
        },
        orderBy: { startTime: 'asc' },
      });

      const slots = upcomingBookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
      }));

      res.json({
        success: true,
        message: 'Fetched spot availability',
        data: slots,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicParkingController();
