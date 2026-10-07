package com.pill.scan;

import com.pill.common.InMemoryRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class ScanRateLimiter {
    private static final String MINUTE_SCOPE = "scan-minute";
    private static final String DAY_SCOPE = "scan-24-hour";
    private static final int MINUTE_LIMIT = 3;
    private static final int DAY_LIMIT = 20;
    private static final Duration MINUTE_WINDOW = Duration.ofMinutes(1);
    private static final Duration DAY_WINDOW = Duration.ofHours(24);

    private final InMemoryRateLimiter limiter;

    public ScanRateLimiter(InMemoryRateLimiter limiter) {
        this.limiter = limiter;
    }

    public synchronized void consume(Long userId) {
        if (userId == null || userId <= 0) {
            throw new IllegalArgumentException("user id must be positive");
        }
        var key = userId.toString();
        limiter.check(MINUTE_SCOPE, key, MINUTE_LIMIT, MINUTE_WINDOW);
        limiter.check(DAY_SCOPE, key, DAY_LIMIT, DAY_WINDOW);
        limiter.consume(MINUTE_SCOPE, key, MINUTE_LIMIT, MINUTE_WINDOW);
        limiter.consume(DAY_SCOPE, key, DAY_LIMIT, DAY_WINDOW);
    }
}
