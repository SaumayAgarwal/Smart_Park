package com.smartpark.kafka.producer;

import com.smartpark.config.KafkaConfig;
import com.smartpark.kafka.event.BookingConfirmedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingEventProducer {

    // KafkaTemplate is Spring's abstraction for sending messages
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public void sendBookingConfirmedEvent(BookingConfirmedEvent event) {
        log.info("Producing BOOKING_CONFIRMED event for Booking ID: {}", event.getBookingId());

        // Key is bookingId (ensures messages for the same booking go to the same partition)
        kafkaTemplate.send(KafkaConfig.BOOKING_EVENTS_TOPIC, String.valueOf(event.getBookingId()), event);
    }
}