package com.smartpark.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class RedisLockService {

    private final StringRedisTemplate redisTemplate;

    // We hold the lock for 5 minutes. If payment isn't done, it auto-releases.
    private static final long LOCK_EXPIRATION_MINUTES = 5;

    public boolean acquireLock(Long parkingSpotId, LocalDateTime startTime, LocalDateTime endTime) {
        String lockKey = generateLockKey(parkingSpotId, startTime, endTime);

        // setIfAbsent is the Redis 'SETNX' command. It is ATOMIC.
        // It returns true if the key didn't exist and was set, false if it already exists.
        Boolean acquired = redisTemplate.opsForValue().setIfAbsent(
                lockKey,
                "LOCKED",
                LOCK_EXPIRATION_MINUTES,
                TimeUnit.MINUTES
        );

        return Boolean.TRUE.equals(acquired);
    }

    public void releaseLock(Long parkingSpotId, LocalDateTime startTime, LocalDateTime endTime) {
        String lockKey = generateLockKey(parkingSpotId, startTime, endTime);
        redisTemplate.delete(lockKey);
    }

    // Creates a key like: parking:lock:1:202608101000-202608101230
    private String generateLockKey(Long parkingSpotId, LocalDateTime startTime, LocalDateTime endTime) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
        return String.format("parking:lock:%d:%s-%s",
                parkingSpotId,
                startTime.format(formatter),
                endTime.format(formatter));
    }
}