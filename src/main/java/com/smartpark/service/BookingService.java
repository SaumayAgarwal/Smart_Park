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
                    .vehicleNumber(request.getVehicleNumber())
                    .vehicleType(request.getVehicleType())
                    .build();

            Booking savedBooking = bookingRepository.save(booking);
            return mapToResponse(savedBooking);

        } catch (Exception e) {
            // IF ANYTHING FAILS, RELEASE THE LOCK IMMEDIATELY
            redisLockService.releaseLock(request.getParkingSpotId(), request.getStartTime(), request.getEndTime());
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getMyBookings(String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

        return bookingRepository.findByUserIdOrderByCreatedAtDesc(driver.getId())
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingDetails(Long id, String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

        Booking booking = bookingRepository.findByIdAndUserId(id, driver.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found or access denied"));

        return mapToResponse(booking);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> getOwnerBookings(String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Owner not found"));

        return bookingRepository.findByParkingSpotOwnerIdOrderByCreatedAtDesc(owner.getId())
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public BookingResponse requestExtension(Long bookingId, Integer hours, String driverEmail) {
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

        Booking booking = bookingRepository.findByIdAndUserId(bookingId, driver.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        booking.setExtensionHours(hours);
        booking.setStatus(BookingStatus.EXTENSION_REQUESTED);
        Booking saved = bookingRepository.save(booking);
        return mapToResponse(saved);
    }

    @Transactional
    public BookingResponse respondToExtension(Long bookingId, boolean approve, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Owner not found"));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        if (!booking.getParkingSpot().getOwner().getId().equals(owner.getId())) {
            throw new IllegalArgumentException("You don't have permission for this booking");
        }

        if (approve) {
            int extraHours = booking.getExtensionHours() != null ? booking.getExtensionHours() : 1;
            booking.setEndTime(booking.getEndTime().plusHours(extraHours));
            BigDecimal extraAmount = booking.getParkingSpot().getPricePerHour().multiply(BigDecimal.valueOf(extraHours));
            booking.setAmount(booking.getAmount().add(extraAmount));
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setExtensionHours(null);
        } else {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setExtensionHours(null);
        }

        Booking saved = bookingRepository.save(booking);
        return mapToResponse(saved);
    }

    @Transactional
    public BookingResponse cancelBooking(Long bookingId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found"));

        boolean isDriver = booking.getUser() != null && booking.getUser().getId().equals(user.getId());
        boolean isOwner = booking.getParkingSpot() != null && booking.getParkingSpot().getOwner() != null
                && booking.getParkingSpot().getOwner().getId().equals(user.getId());

        if (!isDriver && !isOwner) {
            throw new IllegalArgumentException("Not authorized to cancel this booking");
        }

        // Only refund if booking was CONFIRMED (payment was made)
        if (isDriver && booking.getStatus() == BookingStatus.CONFIRMED && booking.getAmount() != null) {
            BigDecimal refundAmount = calculateRefundAmount(booking);
            BigDecimal cancellationFee = booking.getAmount().subtract(refundAmount);
            booking.setCancellationFee(cancellationFee);

            // 1. Credit driver wallet with refundAmount (if > 0)
            if (refundAmount.compareTo(BigDecimal.ZERO) > 0) {
                User driver = booking.getUser();
                BigDecimal currentBalance = driver.getWalletBalance() != null ? driver.getWalletBalance() : BigDecimal.ZERO;
                driver.setWalletBalance(currentBalance.add(refundAmount));
                userRepository.save(driver);
            }

            // 2. Credit space owner wallet with cancellationFee penalty compensation (if > 0)
            if (cancellationFee.compareTo(BigDecimal.ZERO) > 0 && booking.getParkingSpot() != null && booking.getParkingSpot().getOwner() != null) {
                User owner = booking.getParkingSpot().getOwner();
                BigDecimal currentOwnerBalance = owner.getWalletBalance() != null ? owner.getWalletBalance() : BigDecimal.ZERO;
                owner.setWalletBalance(currentOwnerBalance.add(cancellationFee));
                userRepository.save(owner);
            }
        }

        booking.setStatus(BookingStatus.CANCELLED);
        redisLockService.releaseLock(booking.getParkingSpot().getId(), booking.getStartTime(), booking.getEndTime());
        Booking saved = bookingRepository.save(booking);
        return mapToResponse(saved);
    }

    /**
     * Refund Policy:
     * - Cancelled > 2 hours before start → 100% refund
     * - Cancelled < 2 hours before start → 50% refund
     * - Cancelled after start time       → 0% refund
     */
    private BigDecimal calculateRefundAmount(Booking booking) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now(java.time.ZoneId.of("Asia/Kolkata"));
        java.time.LocalDateTime startTime = booking.getStartTime();

        if (startTime == null || booking.getAmount() == null) {
            return BigDecimal.ZERO;
        }

        if (now.isAfter(startTime)) {
            return BigDecimal.ZERO; // No refund after start
        }

        long minutesUntilStart = java.time.Duration.between(now, startTime).toMinutes();

        if (minutesUntilStart >= 120) {
            return booking.getAmount(); // 100% refund
        } else {
            return booking.getAmount().multiply(new BigDecimal("0.50")).setScale(2, java.math.RoundingMode.HALF_UP); // 50% refund
        }
    }

    private BookingResponse mapToResponse(Booking booking) {
        User driver = booking.getUser();
        ParkingSpot spot = booking.getParkingSpot();
        return BookingResponse.builder()
                .id(booking.getId())
                .parkingSpotId(spot.getId())
                .parkingSpotTitle(spot.getTitle())
                .address(spot.getAddress())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .amount(booking.getAmount())
                .status(booking.getStatus())
                .bookingReference(booking.getBookingReference())
                .driverName(driver != null ? driver.getName() : null)
                .driverEmail(driver != null ? driver.getEmail() : null)
                .driverPhone(driver != null ? driver.getPhone() : null)
                .qrCodeToken(booking.getQrCode())
                .vehicleNumber(booking.getVehicleNumber())
                .vehicleType(booking.getVehicleType())
                .extensionHours(booking.getExtensionHours())
                .cancellationFee(booking.getCancellationFee())
                .imageUrl(spot.getImageUrl())
                .operatingHours(spot.getOperatingHours())
                .latitude(spot.getLatitude())
                .longitude(spot.getLongitude())
                .createdAt(booking.getCreatedAt())
                .build();
    }
}