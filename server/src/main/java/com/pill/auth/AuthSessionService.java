package com.pill.auth;

import com.pill.model.AuthSession;
import com.pill.model.User;
import com.pill.repository.AuthSessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

@Service
public class AuthSessionService {
    private final AuthSessionRepository sessions;
    private final SessionTokenService tokens;
    private final Clock clock;
    private final Duration sessionTtl;

    public AuthSessionService(
        AuthSessionRepository sessions,
        SessionTokenService tokens,
        Clock clock,
        @Value("${pill.auth.session-ttl:PT720H}") Duration sessionTtl
    ) {
        if (sessionTtl == null || sessionTtl.isZero() || sessionTtl.isNegative()) {
            throw new IllegalArgumentException("session ttl must be positive");
        }
        this.sessions = sessions;
        this.tokens = tokens;
        this.clock = clock;
        this.sessionTtl = sessionTtl;
    }

    @Transactional
    public IssuedSession issue(User user) {
        var now = clock.instant();
        var token = tokens.issue();
        var session = sessions.saveAndFlush(new AuthSession(
            user,
            tokens.hash(token),
            now,
            now.plus(sessionTtl)
        ));
        return new IssuedSession(token, session.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public SessionPrincipal authenticate(String token) {
        var session = sessions.findByTokenHashAndRevokedAtIsNullAndExpiresAtAfter(
                tokens.hash(token),
                clock.instant()
            )
            .orElseThrow(InvalidSessionException::new);
        return new SessionPrincipal(session.getUser().getId(), session.getId());
    }

    @Transactional
    public void revoke(Long sessionId) {
        if (sessionId == null) {
            throw new InvalidSessionException();
        }
        var session = sessions.findById(sessionId).orElseThrow(InvalidSessionException::new);
        session.revoke(clock.instant());
    }

    public record IssuedSession(String token, Instant expiresAt) {
    }
}
