package com.smartpark.service;

import com.smartpark.dto.payment.PaymentRequest;
import com.smartpark.dto.payment.PaymentResponse;
import com.smartpark.entity.*;
import com.smartpark.exception.ResourceNotFoundException;
import com.smartpark.repository.BookingRepository;
import com.smartpark.repository.PaymentRepository;
import com.smartpark.repository.UserRepository;
import com.smartpark.service.gateway.PaymentGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.smartpark.kafka.producer.BookingEventProducer;
import com.smartpark.kafka.event.BookingConfirmedEvent;
import java.time.LocalDateTime;
import com.smartpark.util.QrCodeGenerator;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final PaymentGateway paymentGateway;
    private final RedisLockService redisLockService;

    // 1. INJECT KAFKA PRODUCER
    private final BookingEventProducer bookingEventProducer;

    @Transactional
    public PaymentResponse processPayment(PaymentRequest request, String driverEmail) {
        // ... (keep driver, booking validation, and paymentGateway logic the same) ...
        User driver = userRepository.findByEmail(driverEmail)
                .orElseThrow(() -> new ResourceNotFoundException("Driver not found"));

        Booking booking = bookingRepository.findByIdAndUserId(request.getBookingId(), driver.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found or access denied"));

        if (booking.getStatus() != BookingStatus.PAYMENT_PENDING) {
            throw new IllegalStateException("Booking is not in a valid state for payment.");
        }

        PaymentGateway.PaymentResult gatewayResult = paymentGateway.processPayment(
                booking.getAmount(), "USD", request.getPaymentMethod().name());

        Payment payment = Payment.builder()
                .booking(booking)
                .amount(booking.getAmount())
                .transactionId(gatewayResult.success() ? gatewayResult.transactionId() : "FAILED-" + System.currentTimeMillis())
                .paymentMethod(request.getPaymentMethod())
                .status(gatewayResult.success() ? PaymentStatus.SUCCESS : PaymentStatus.FAILED)
                .build();

        paymentRepository.save(payment);

        if (gatewayResult.success()) {
            booking.setStatus(BookingStatus.CONFIRMED);

            // Generate and attach the secure QR Token
            String qrToken = QrCodeGenerator.generateSecureQrToken(booking.getId(), booking.getBookingReference());
            booking.setQrCode(qrToken);

            bookingRepository.save(booking);

            redisLockService.releaseLock(booking.getParkingSpot().getId(), booking.getStartTime(), booking.getEndTime());

            // 2. PUBLISH KAFKA EVENT ASYNCHRONOUSLY
            BookingConfirmedEvent event = BookingConfirmedEvent.builder()
                    .bookingId(booking.getId())
                    .bookingReference(booking.getBookingReference())
                    .parkingSpotId(booking.getParkingSpot().getId())
                    .parkingSpotTitle(booking.getParkingSpot().getTitle())
                    .driverEmail(driver.getEmail())
                    .ownerEmail(booking.getParkingSpot().getOwner().getEmail()) // Fetching owner email through the JPA relationship
                    .amountPaid(payment.getAmount())
                    .eventTimestamp(LocalDateTime.now())
                    .build();

            bookingEventProducer.sendBookingConfirmedEvent(event);

            return mapToResponse(payment, "Payment successful. Booking confirmed.");
        } else {
            throw new IllegalStateException("Payment failed: " + gatewayResult.errorMessage());
        }
    }
    private PaymentResponse mapToResponse(Payment payment, String message) {
        return PaymentResponse.builder()
                .id(payment.getId())
                .bookingId(payment.getBooking().getId())
                .amount(payment.getAmount())
                .transactionId(payment.getTransactionId())
                .paymentMethod(payment.getPaymentMethod())
                .status(payment.getStatus())
                .message(message)
                .createdAt(payment.getCreatedAt())
                .build();
    }
}