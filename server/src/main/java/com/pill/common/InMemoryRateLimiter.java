package com.pill.common;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@Component
public class InMemoryRateLimiter {
    private static final int DEFAULT_MAX_ENTRIES = 10_000;

    private final Clock clock;
    private final int maxEntries;
    private final Map<LimitKey, Window> windows = new HashMap<>();

    @Autowired
    public InMemoryRateLimiter(Clock clock) {
        this(clock, DEFAULT_MAX_ENTRIES);
    }

    public InMemoryRateLimiter(Clock clock, int maxEntries) {
        this.clock = Objects.requireNonNull(clock, "clock");
        if (maxEntries <= 0) {
            throw new IllegalArgumentException("max entries must be positive");
        }
        this.maxEntries = maxEntries;
    }

    public synchronized void check(String scope, String key, int limit, Duration window) {
        validate(scope, key, limit, window);
        var now = clock.instant();
        var limitKey = new LimitKey(scope, key);
        var current = activeWindow(limitKey, now);
        if (current != null && current.count() >= limit) {
            throw exceeded(now, current.expiresAt());
        }
        if (current == null) {
            ensureCapacity(now);
        }
    }

    public synchronized void consume(String scope, String key, int limit, Duration window) {
        validate(scope, key, limit, window);
        var now = clock.instant();
        var limitKey = new LimitKey(scope, key);
        var current = activeWindow(limitKey, now);
        if (current == null) {
            ensureCapacity(now);
            windows.put(limitKey, new Window(1, now.plus(window)));
            return;
        }
        if (current.count() >= limit) {
            throw exceeded(now, current.expiresAt());
        }
        windows.put(limitKey, new Window(current.count() + 1, current.expiresAt()));
    }

    public synchronized void reset(String scope, String key) {
        if (scope == null || key == null) {
            return;
        }
        windows.remove(new LimitKey(scope, key));
    }

    private Window activeWindow(LimitKey key, Instant now) {
        var current = windows.get(key);
        if (current != null && !current.expiresAt().isAfter(now)) {
            windows.remove(key);
            return null;
        }
        return current;
    }

    private void ensureCapacity(Instant now) {
        purgeExpired(now);
        if (windows.size() < maxEntries) {
            return;
        }
        var earliestExpiry = windows.values().stream()
            .map(Window::expiresAt)
            .min(Instant::compareTo)
            .orElse(now.plusSeconds(1));
        throw exceeded(now, earliestExpiry);
    }

    private void purgeExpired(Instant now) {
        windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private RateLimitExceededException exceeded(Instant now, Instant expiresAt) {
        var remaining = Duration.between(now, expiresAt);
        var seconds = remaining.getSeconds() + (remaining.getNano() > 0 ? 1 : 0);
        return new RateLimitExceededException(seconds);
    }

    private void validate(String scope, String key, int limit, Duration window) {
        if (scope == null || scope.isBlank() || key == null || key.isBlank()) {
            throw new IllegalArgumentException("rate limit key must not be blank");
        }
        if (limit <= 0 || window == null || window.isZero() || window.isNegative()) {
            throw new IllegalArgumentException("rate limit and window must be positive");
        }
    }

    private record LimitKey(String scope, String key) {
    }

    private record Window(int count, Instant expiresAt) {
    }
}
