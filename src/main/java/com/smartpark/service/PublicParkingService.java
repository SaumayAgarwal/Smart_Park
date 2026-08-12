package com.smartpark.service;

import com.smartpark.dto.parking.PublicParkingSpotResponse;
import com.smartpark.entity.ParkingSpot;
import com.smartpark.entity.ParkingStatus;
import com.smartpark.exception.ResourceNotFoundException;
import com.smartpark.repository.ParkingSpotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PublicParkingService {

    private final ParkingSpotRepository parkingSpotRepository;
    private static final double EARTH_RADIUS_KM = 6371.0;

    public List<PublicParkingSpotResponse> searchNearbyParking(
            Double lat, Double lon, Double radiusKm,
            BigDecimal maxPrice, Boolean covered,
            Boolean security, Boolean evCharging) {

        // 1. Calculate Bounding Box (Rough Square) to limit DB query size
        // 1 degree of latitude is ~111 km
        double latDelta = radiusKm / 111.0;
        double lonDelta = radiusKm / (111.0 * Math.cos(Math.toRadians(lat)));

        double minLat = lat - latDelta;
        double maxLat = lat + latDelta;
        double minLon = lon - lonDelta;
        double maxLon = lon + lonDelta;

        // 2. Fetch from DB using the Bounding Box (Fast execution)
        List<ParkingSpot> roughSpots = parkingSpotRepository
                .findByStatusAndLatitudeBetweenAndLongitudeBetween(
                        ParkingStatus.AVAILABLE, minLat, maxLat, minLon, maxLon);

        // 3. Apply precise Haversine formula (Circle) and dynamic filters
        return roughSpots.stream()
                .filter(spot -> {
                    double exactDistance = calculateHaversineDistance(lat, lon, spot.getLatitude(), spot.getLongitude());
                    spot.setLatitude(exactDistance); // Temporarily store distance, or handle in map
                    return exactDistance <= radiusKm;
                })
                .filter(spot -> maxPrice == null || spot.getPricePerHour().compareTo(maxPrice) <= 0)
                .filter(spot -> covered == null || !covered || spot.isCovered())
                .filter(spot -> security == null || !security || spot.isSecurityAvailable())
                .filter(spot -> evCharging == null || !evCharging || spot.isEvChargingAvailable())
                .map(spot -> mapToPublicResponse(spot, calculateHaversineDistance(lat, lon, spot.getLatitude(), spot.getLongitude())))
                .sorted(Comparator.comparingDouble(PublicParkingSpotResponse::getDistanceKm)) // Sort by closest
                .collect(Collectors.toList());
    }

    public PublicParkingSpotResponse getParkingDetails(Long id, Double userLat, Double userLon) {
        ParkingSpot spot = parkingSpotRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Parking spot not found"));

        double distance = 0.0;
        if (userLat != null && userLon != null) {
            distance = calculateHaversineDistance(userLat, userLon, spot.getLatitude(), spot.getLongitude());
        }

        return mapToPublicResponse(spot, distance);
    }

    // Haversine Formula for exact distance between two coordinates
    private double calculateHaversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    private PublicParkingSpotResponse mapToPublicResponse(ParkingSpot spot, double distanceKm) {
        return PublicParkingSpotResponse.builder()
                .id(spot.getId())
                .title(spot.getTitle())
                .address(spot.getAddress())
                .city(spot.getCity())
                .latitude(spot.getLatitude())
                .longitude(spot.getLongitude())
                .pricePerHour(spot.getPricePerHour())
                .capacity(spot.getCapacity())
                .covered(spot.isCovered())
                .securityAvailable(spot.isSecurityAvailable())
                .evChargingAvailable(spot.isEvChargingAvailable())
                .distanceKm(Math.round(distanceKm * 10.0) / 10.0) // Round to 1 decimal place
                .build();
    }
}