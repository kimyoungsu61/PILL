package com.pill.scan;

import com.pill.common.InMemoryRateLimiter;
import com.pill.common.RateLimitExceededException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScanRateLimiterTest {
    @Test
    void limitsEachUserToThreeScansPerMinute() {
        var limiter = new ScanRateLimiter(new InMemoryRateLimiter(
            new MutableClock(Instant.parse("2026-07-10T00:00:00Z")),
            100
        ));

        limiter.consume(1L);
        limiter.consume(1L);
        limiter.consume(1L);

        assertThatThrownBy(() -> limiter.consume(1L))
            .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void limitsEachUserToTwentyScansPerTwentyFourHours() {
        var clock = new MutableClock(Instant.parse("2026-07-10T00:00:00Z"));
        var limiter = new ScanRateLimiter(new InMemoryRateLimiter(clock, 100));

        for (var index = 0; index < 20; index++) {
            if (index > 0 && index % 3 == 0) {
                clock.advance(Duration.ofMinutes(1));
            }
            limiter.consume(7L);
        }

        assertThatThrownBy(() -> limiter.consume(7L))
            .isInstanceOf(RateLimitExceededException.class);
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
