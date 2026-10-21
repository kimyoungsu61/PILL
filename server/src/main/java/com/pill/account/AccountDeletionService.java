package com.pill.account;

import com.pill.auth.InvalidSessionException;
import com.pill.common.InMemoryRateLimiter;
import com.pill.repository.UserRepository;
import java.time.Duration;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountDeletionService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate db;
    private final InMemoryRateLimiter limiter;
    private final Clock clock;

    public AccountDeletionService(UserRepository users, PasswordEncoder passwords, JdbcTemplate db,
        InMemoryRateLimiter limiter, Clock clock) {
        this.users = users;
        this.passwords = passwords;
        this.db = db;
        this.limiter = limiter;
        this.clock = clock;
    }

    @Transactional
    public void delete(Long userId, Long sessionId, String password, String confirmation) {
        if (userId == null) throw new InvalidSessionException();
        limiter.consume("account-delete", userId.toString(), 5, Duration.ofMinutes(15));
        if (!"탈퇴".equals(confirmation) || password == null || password.isBlank() || password.length() > 128) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호와 '탈퇴'를 입력해 주세요.");
        }
        // Every account mutation takes this same row lock, including email codes,
        // garden awards and push changes. No identifier is accepted from the body.
        var user = users.lockById(userId).orElseThrow(InvalidSessionException::new);
        var sessionLive = db.queryForObject("SELECT COUNT(*) FROM auth_session WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>?", Integer.class,
            sessionId, userId, LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
        if (sessionLive == null || sessionLive != 1) throw new InvalidSessionException();
        boolean matches;
        try {
            matches = passwords.matches(password, user.getPasswordHash());
        } catch (IllegalArgumentException invalidPassword) {
            matches = false;
        }
        if (!matches) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 비밀번호를 확인해 주세요.");
        }
        var emailHash = AccountEmailService.emailHash(user.getEmail());

        // The email flow uses user -> budget -> challenge locking as well.
        db.update("DELETE FROM account_mail_budget WHERE email_hash=?", emailHash);
        db.update("DELETE FROM account_challenge WHERE user_id=? OR email_hash=?", userId, emailHash);
        db.update("DELETE FROM email_verification WHERE user_id=?", userId);

        // Explicit child-first cleanup keeps every delete account-scoped and does
        // not depend on cascade behavior differing between existing databases.
        db.update("DELETE FROM web_push_follow_up WHERE reminder_id IN (SELECT r.id FROM web_push_reminder r JOIN web_push_subscription s ON s.id=r.subscription_id WHERE s.user_id=?)", userId);
        db.update("DELETE FROM web_push_delivery WHERE reminder_id IN (SELECT r.id FROM web_push_reminder r JOIN web_push_subscription s ON s.id=r.subscription_id WHERE s.user_id=?)", userId);
        db.update("DELETE FROM web_push_reminder WHERE subscription_id IN (SELECT s.id FROM web_push_subscription s WHERE s.user_id=?)", userId);
        db.update("DELETE FROM web_push_follow_up_settings WHERE subscription_id IN (SELECT s.id FROM web_push_subscription s WHERE s.user_id=?)", userId);
        db.update("DELETE FROM web_push_subscription WHERE user_id=?", userId);
        db.update("DELETE FROM garden_day WHERE user_id=?", userId);
        db.update("DELETE FROM garden_style WHERE user_id=?", userId);
        db.update("DELETE FROM supplement_warning WHERE supplement_id IN (SELECT id FROM user_supplement WHERE user_id=?)", userId);
        db.update("DELETE FROM user_supplement_ingredient WHERE supplement_id IN (SELECT id FROM user_supplement WHERE user_id=?)", userId);
        db.update("DELETE FROM dose_log WHERE supplement_id IN (SELECT id FROM user_supplement WHERE user_id=?)", userId);
        db.update("DELETE FROM dose_schedule WHERE supplement_id IN (SELECT id FROM user_supplement WHERE user_id=?)", userId);
        db.update("DELETE FROM user_supplement WHERE user_id=?", userId);
        // Includes failed/unconfirmed scans which never created a supplement.
        db.update("DELETE FROM supplement_scan WHERE user_id=?", userId);
        db.update("DELETE FROM auth_session WHERE user_id=?", userId);
        db.update("DELETE FROM users WHERE id=?", userId);
    }

}
