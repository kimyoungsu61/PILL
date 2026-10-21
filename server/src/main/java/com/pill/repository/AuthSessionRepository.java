package com.pill.repository;

import com.pill.model.AuthSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface AuthSessionRepository extends JpaRepository<AuthSession, Long> {
    Optional<AuthSession> findByTokenHashAndRevokedAtIsNullAndExpiresAtAfter(String tokenHash, Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
        update AuthSession s
        set s.expiresAt = case when s.expiresAt < :deadline then :deadline else s.expiresAt end
        where s.id = :id and s.revokedAt is null and s.expiresAt > :now
        """)
    int rememberActive(@Param("id") Long id, @Param("now") Instant now, @Param("deadline") Instant deadline);
}
