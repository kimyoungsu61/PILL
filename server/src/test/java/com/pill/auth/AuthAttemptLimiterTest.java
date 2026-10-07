package com.pill.auth;

import com.pill.common.InMemoryRateLimiter;
import com.pill.common.RateLimitExceededException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthAttemptLimiterTest {
    @Test
    void limitsLoginFailuresAcrossDifferentEmailsFromOneAddress() {
        var attempts = limiter();

        for (var index = 0; index < 30; index++) {
            attempts.recordLoginFailure("203.0.113.10", "user-" + index + "@example.com");
        }

        assertThatThrownBy(() -> attempts.checkLogin("203.0.113.10", "another@example.com"))
            .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void limitsLoginFailuresForOneEmailAcrossDifferentAddresses() {
        var attempts = limiter();

        for (var index = 0; index < 10; index++) {
            attempts.recordLoginFailure("203.0.113." + index, "target@example.com");
        }

        assertThatThrownBy(() -> attempts.checkLogin("198.51.100.20", "target@example.com"))
            .isInstanceOf(RateLimitExceededException.class);
    }

    private AuthAttemptLimiter limiter() {
        var clock = Clock.fixed(Instant.parse("2026-07-10T00:00:00Z"), ZoneOffset.UTC);
        return new AuthAttemptLimiter(new InMemoryRateLimiter(clock, 1_000));
    }
}
