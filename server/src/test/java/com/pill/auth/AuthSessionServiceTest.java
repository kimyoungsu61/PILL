package com.pill.auth;

import com.pill.model.User;
import com.pill.repository.AuthSessionRepository;
import com.pill.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class AuthSessionServiceTest {
    private static final Instant NOW = Instant.parse("2026-07-10T00:00:00Z");
    private static final Duration SESSION_TTL = Duration.ofDays(30);

    @Autowired AuthSessionRepository sessions;
    @Autowired UserRepository users;

    @Test
    void persistsOnlyHashAndAuthenticatesActiveSession() {
        var user = users.save(new User("session@example.com", "hash"));
        var service = serviceAt(NOW);

        var issued = service.issue(user);
        var stored = sessions.findAll().getFirst();

        assertThat(stored.getTokenHash()).hasSize(64).isNotEqualTo(issued.token());
        assertThat(stored.getExpiresAt()).isEqualTo(NOW.plus(SESSION_TTL));
        assertThat(service.authenticate(issued.token()))
            .isEqualTo(new SessionPrincipal(user.getId(), stored.getId()));
    }

    @Test
    void rejectsExpiredSession() {
        var user = users.save(new User("expired@example.com", "hash"));
        var issued = serviceAt(NOW).issue(user);

        assertThatThrownBy(() -> serviceAt(NOW.plus(SESSION_TTL).plusSeconds(1)).authenticate(issued.token()))
            .isInstanceOf(InvalidSessionException.class);
    }

    @Test
    void revocationImmediatelyInvalidatesSession() {
        var user = users.save(new User("revoked@example.com", "hash"));
        var service = serviceAt(NOW);
        var issued = service.issue(user);
        var sessionId = sessions.findAll().getFirst().getId();

        service.revoke(sessionId);

        assertThat(sessions.findById(sessionId).orElseThrow().getRevokedAt()).isEqualTo(NOW);
        assertThatThrownBy(() -> service.authenticate(issued.token()))
            .isInstanceOf(InvalidSessionException.class);
    }

    private AuthSessionService serviceAt(Instant instant) {
        return new AuthSessionService(
            sessions,
            new SessionTokenService(new SecureRandom()),
            Clock.fixed(instant, ZoneOffset.UTC),
            SESSION_TTL
        );
    }
}
