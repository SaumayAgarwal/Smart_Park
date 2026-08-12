package com.smartpark.service;

import com.smartpark.dto.booking.BookingRequest;
import com.smartpark.dto.booking.BookingResponse;
import com.smartpark.entity.Booking;
import com.smartpark.entity.BookingStatus;
import com.smartpark.entity.ParkingSpot;
import com.smartpark.entity.User;
import com.smartpark.exception.ResourceNotFoundException;
import com.smartpark.repository.BookingRepository;
import com.smartpark.repository.ParkingSpotRepository;
import com.smartpark.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;
    private final ParkingSpotRepository parkingSpotRepository;
    private final UserRepository userRepository;
    private final RedisLockService redisLockService;

    @Transactional
    public BookingResponse createBooking(BookingRequest request, String driverEmail) {
        if (request.getStartTime().isAfter(request.getEndTime()) || request.getStartTime().isEqual(request.getEndTime())) {
            throw new IllegalArgumentException("End time must be after start time");
        }

        // 1. ATTEMPT TO ACQUIRE REDIS LOCK FIRST
        boolean lockAcquired = redisLockService.acquireLock(
                request.getParkingSpotId(), request.getStartTime(), request.getEndTime());

        if (!lockAcquired) {
            throw new IllegalStateException("This parking spot is currently being booked by someone else. Please try again in 5 minutes.");
        }

        try {
            User driver = userRepository.findByEmail(driverEmail)
                    .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

            ParkingSpot spot = parkingSpotRepository.findById(request.getParkingSpotId())
                    .orElseThrow(() -> new ResourceNotFoundException("Parking spot not found"));

            // 2. Fallback DB overlap check
            List<BookingStatus> activeStatuses = List.of(
                    BookingStatus.PENDING, BookingStatus.PAYMENT_PENDING,
                    BookingStatus.CONFIRMED, BookingStatus.ACTIVE
            );

            long overlaps = bookingRepository.countOverlappingBookings(
                    spot.getId(), request.getStartTime(), request.getEndTime(), activeStatuses);

            if (overlaps > 0) {
                throw new IllegalStateException("Parking spot is already booked for the selected time period");
            }

            long minutes = Duration.between(request.getStartTime(), request.getEndTime()).toMinutes();
            double hours = Math.ceil(minutes / 60.0);
            BigDecimal totalAmount = spot.getPricePerHour().multiply(BigDecimal.valueOf(hours))
                    .setScale(2, RoundingMode.HALF_UP);

            Booking booking = Booking.builder()
                    .user(driver)
                    .parkingSpot(spot)
                    .startTime(request.getStartTime())
                    .endTime(request.getEndTime())
                    .amount(totalAmount)
                    .status(BookingStatus.PAYMENT_PENDING)
                    .bookingReference("BKG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                    .build();

            Booking savedBooking = bookingRepository.save(booking);
            return mapToResponse(savedBooking);

        } catch (Exception e) {
            // IF ANYTHING FAILS, RELEASE THE LOCK IMMEDIATELY
            redisLockService.releaseLock(request.getParkingSpotId(), request.getStartTime(), request.getEndTime());
            throw e;
        }
    }

    public List<BookingResponse> getMyBookings(String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

        return bookingRepository.findByUserIdOrderByCreatedAtDesc(driver.getId())
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public BookingResponse getBookingDetails(Long id, String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

        Booking booking = bookingRepository.findByIdAndUserId(id, driver.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found or access denied"));

        return mapToResponse(booking);
    }

    private BookingResponse mapToResponse(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .parkingSpotId(booking.getParkingSpot().getId())
                .parkingSpotTitle(booking.getParkingSpot().getTitle())
                .address(booking.getParkingSpot().getAddress())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .amount(booking.getAmount())
                .status(booking.getStatus())
                .bookingReference(booking.getBookingReference())
                .createdAt(booking.getCreatedAt())
                .build();
    }
}