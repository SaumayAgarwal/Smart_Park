package com.smartpark.dto.booking;

import com.smartpark.entity.BookingStatus;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class BookingResponse {
    private Long id;
    private Long parkingSpotId;
    private String parkingSpotTitle;
    private String address;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal amount;
    private BookingStatus status;
    private String bookingReference;
    private LocalDateTime createdAt;
}