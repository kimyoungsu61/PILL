package com.pill.common;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemoryRateLimiterTest {
    @Test
    void rejectsAfterLimitAndResetsAfterWindow() {
        var clock = new MutableClock(Instant.parse("2026-07-10T00:00:00Z"));
        var limiter = new InMemoryRateLimiter(clock, 100);

        limiter.consume("login", "127.0.0.1|user@example.com", 2, Duration.ofMinutes(15));
        limiter.consume("login", "127.0.0.1|user@example.com", 2, Duration.ofMinutes(15));

        assertThatThrownBy(() -> limiter.consume(
            "login",
            "127.0.0.1|user@example.com",
            2,
            Duration.ofMinutes(15)
        ))
            .isInstanceOf(RateLimitExceededException.class)
            .satisfies(ex -> assertThat(((RateLimitExceededException) ex).retryAfterSeconds()).isEqualTo(900));

        clock.advance(Duration.ofMinutes(15));

        assertThatCode(() -> limiter.consume(
            "login",
            "127.0.0.1|user@example.com",
            2,
            Duration.ofMinutes(15)
        )).doesNotThrowAnyException();
    }

    @Test
    void rejectsNewKeysAtCapacityUntilExpiredEntriesArePurged() {
        var clock = new MutableClock(Instant.parse("2026-07-10T00:00:00Z"));
        var limiter = new InMemoryRateLimiter(clock, 2);

        limiter.consume("signup", "client-a", 5, Duration.ofHours(1));
        limiter.consume("signup", "client-b", 5, Duration.ofHours(1));

        assertThatThrownBy(() -> limiter.consume("signup", "client-c", 5, Duration.ofHours(1)))
            .isInstanceOf(RateLimitExceededException.class);

        clock.advance(Duration.ofHours(1));

        assertThatCode(() -> limiter.consume("signup", "client-c", 5, Duration.ofHours(1)))
            .doesNotThrowAnyException();
    }

    static final class MutableClock extends Clock {
        private Instant instant;

        MutableClock(Instant instant) {
            this.instant = instant;
        }

        void advance(Duration duration) {
            instant = instant.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }
    }
}
