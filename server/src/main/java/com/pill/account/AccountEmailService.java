package com.pill.account;

import com.pill.auth.InvalidSessionException;
import com.pill.common.InMemoryRateLimiter;
import com.pill.common.RateLimitExceededException;
import com.pill.model.User;
import com.pill.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountEmailService {
    private static final String INVALID_CODE = "코드가 올바르지 않거나 만료됐어요. 새 코드를 요청해 주세요.";
    private static final String RESET_REQUESTED = "등록된 이메일이라면 재설정 코드를 보내드려요. 받은 편지함과 스팸함을 확인해 주세요.";
    private final UserRepository users;
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final AccountMailSender sender;
    private final AccountMailDelivery delivery;
    private final InMemoryRateLimiter limiter;
    private final Clock clock;
    private final TransactionTemplate tx;
    private final SecureRandom random = new SecureRandom();
    private final String dummyCodeHash;

    public AccountEmailService(UserRepository users, JdbcTemplate db, PasswordEncoder passwords,
        AccountMailSender sender, AccountMailDelivery delivery, InMemoryRateLimiter limiter,
        Clock clock, PlatformTransactionManager transactionManager) {
        this.users = users; this.db = db; this.passwords = passwords; this.sender = sender;
        this.delivery = delivery; this.limiter = limiter; this.clock = clock;
        this.tx = new TransactionTemplate(transactionManager);
        this.dummyCodeHash = passwords.encode("not-a-valid-code");
    }

    public record Profile(String email, boolean emailVerified, boolean mailAvailable) {}
    public record Requested(String message, int resendAfterSeconds) {}
    public boolean mailAvailable() { return sender.available(); }
    public Profile profile(Long userId) {
        return tx.execute(status -> profile(users.findById(userId).orElseThrow(InvalidSessionException::new)));
    }

    public Requested requestVerification(Long userId, String address) {
        requireMail(); consumeRequestIp(address);
        return tx.execute(status -> {
            var user = users.lockById(userId).orElseThrow(InvalidSessionException::new);
            if (verified(user)) return new Requested("이미 인증된 이메일이에요.", 0);
            issue(user, normalize(user.getEmail()), "VERIFY");
            return new Requested("인증 코드를 요청했어요. 받은 편지함과 스팸함을 확인해 주세요.", 60);
        });
    }

    public Profile confirmVerification(Long userId, String code, String address) {
        consumeConfirmIp(address);
        var result = tx.execute(status -> {
            var user = users.lockById(userId).orElseThrow(InvalidSessionException::new);
            if (!consumeCode(user.getId(), normalize(user.getEmail()), "VERIFY", code)) return null;
            verify(user);
            return profile(user);
        });
        // Outside the transaction: wrong-attempt counters must commit, not roll back with the HTTP error.
        if (result == null) throw invalidCode();
        return result;
    }

    public Requested requestReset(String email, String address) {
        requireMail(); consumeRequestIp(address);
        return tx.execute(status -> {
            var normalized = normalize(email);
            var found = users.findByEmail(normalized).orElse(null);
            User user = found == null ? null : users.lockById(found.getId()).orElse(null);
            issue(user, normalized, "RESET");
            return new Requested(RESET_REQUESTED, 60);
        });
    }

    public void confirmReset(String email, String code, String newPassword, String address) {
        consumeConfirmIp(address);
        if (newPassword == null || newPassword.length() < 8 || newPassword.getBytes(StandardCharsets.UTF_8).length > 72)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호는 8자 이상, UTF-8 기준 72바이트 이내로 입력해 주세요.");
        var changed = tx.execute(status -> {
            var normalized = normalize(email);
            var found = users.findByEmail(normalized).orElse(null);
            User user = found == null ? null : users.lockById(found.getId()).orElse(null);
            if (!consumeCode(user == null ? null : user.getId(), normalized, "RESET", code)) return false;
            user.changePasswordHash(passwords.encode(newPassword));
            users.saveAndFlush(user);
            verify(user);
            var now = utc(clock.instant());
            db.update("UPDATE auth_session SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", now, user.getId());
            db.update("UPDATE web_push_subscription SET enabled=FALSE,updated_at=? WHERE user_id=?", now, user.getId());
            db.update("""
                UPDATE web_push_follow_up SET status='CANCELLED' WHERE status='PENDING' AND reminder_id IN
                (SELECT r.id FROM web_push_reminder r JOIN web_push_subscription s ON s.id=r.subscription_id WHERE s.user_id=?)
                """, user.getId());
            // Any other outstanding codes for this account lose their authority after recovery.
            db.update("UPDATE account_challenge SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL", now, user.getId());
            return true;
        });
        if (!Boolean.TRUE.equals(changed)) throw invalidCode();
    }

    private void issue(User user, String email, String purpose) {
        var now = clock.instant();
        var emailHash = emailHash(email);
        lockBudget(emailHash, now);
        var budget = db.queryForMap("SELECT * FROM account_mail_budget WHERE email_hash=? FOR UPDATE", emailHash);
        var last = instant(budget.get("last_requested_at"));
        var hourStart = instant(budget.get("hour_started_at"));
        var dayStart = instant(budget.get("day_started_at"));
        int hour = now.isBefore(hourStart.plusSeconds(3600)) ? ((Number)budget.get("hour_count")).intValue() : 0;
        int day = now.isBefore(dayStart.plusSeconds(86400)) ? ((Number)budget.get("day_count")).intValue() : 0;
        if (last != null && now.isBefore(last.plusSeconds(60))) throw new RateLimitExceededException(Math.max(1, Duration.between(now,last.plusSeconds(60)).toSeconds()));
        if (hour >= 5) throw new RateLimitExceededException(Math.max(1, Duration.between(now,hourStart.plusSeconds(3600)).toSeconds()));
        if (day >= 10) throw new RateLimitExceededException(Math.max(1, Duration.between(now,dayStart.plusSeconds(86400)).toSeconds()));
        db.update("UPDATE account_mail_budget SET last_requested_at=?,hour_started_at=?,hour_count=?,day_started_at=?,day_count=? WHERE email_hash=?",
            utc(now), utc(hour == 0 ? now : hourStart), hour + 1, utc(day == 0 ? now : dayStart), day + 1, emailHash);
        var code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
        var codeHash = passwords.encode(code);
        var key = digest(purpose + "|" + emailHash);
        var generation = UUID.randomUUID().toString();
        db.update("DELETE FROM account_challenge WHERE challenge_key=?", key);
        db.update("""
            INSERT INTO account_challenge(challenge_key,user_id,email_hash,purpose,generation,code_hash,expires_at,attempts,consumed_at,created_at)
            VALUES (?,?,?,?,?,?,?,0,NULL,?)
            """, key, user == null ? null : user.getId(), emailHash, purpose, generation, codeHash, utc(now.plusSeconds(600)), utc(now));
        // Unknown addresses perform the same database/BCrypt work but never receive mail.
        if (user != null) TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { delivery.enqueue(email, code, purpose, key, generation); }
        });
    }

    private boolean consumeCode(Long userId, String email, String purpose, String code) {
        var now = clock.instant();
        var key = digest(purpose + "|" + emailHash(email));
        var rows = db.query("SELECT * FROM account_challenge WHERE challenge_key=? FOR UPDATE", AccountEmailService::challenge, key);
        var challenge = rows.isEmpty() ? null : rows.getFirst();
        var available = challenge != null && userId != null && userId.equals(challenge.userId())
            && challenge.consumedAt() == null && now.isBefore(challenge.expiresAt()) && challenge.attempts() < 5;
        var matches = passwords.matches(code == null ? "" : code, available ? challenge.codeHash() : dummyCodeHash);
        if (!available) return false;
        if (!matches) {
            db.update("UPDATE account_challenge SET attempts=attempts+1 WHERE challenge_key=?", key);
            return false;
        }
        db.update("UPDATE account_challenge SET consumed_at=? WHERE challenge_key=?", utc(now), key);
        return true;
    }

    private void lockBudget(String emailHash, Instant now) {
        db.update("INSERT IGNORE INTO account_mail_budget(email_hash,last_requested_at,hour_started_at,hour_count,day_started_at,day_count) VALUES (?,NULL,?,0,?,0)", emailHash, utc(now), utc(now));
    }
    private Profile profile(User user) { return new Profile(user.getEmail(), verified(user), sender.available()); }
    private boolean verified(User user) {
        return db.queryForObject("SELECT COUNT(*) FROM email_verification WHERE user_id=? AND email_hash=?", Integer.class, user.getId(), emailHash(user.getEmail())) > 0;
    }
    private void verify(User user) {
        db.update("DELETE FROM email_verification WHERE user_id=?", user.getId());
        db.update("INSERT INTO email_verification(user_id,email_hash,verified_at) VALUES (?,?,?)", user.getId(), emailHash(user.getEmail()), utc(clock.instant()));
    }
    private void requireMail() {
        if (!sender.available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "이메일 기능을 준비하고 있어요. 잠시 후 다시 시도해 주세요.");
    }
    private void consumeRequestIp(String address) { limiter.consume("account-mail-request", safeAddress(address), 20, Duration.ofHours(1)); }
    private void consumeConfirmIp(String address) { limiter.consume("account-mail-confirm", safeAddress(address), 30, Duration.ofMinutes(15)); }
    private static String safeAddress(String address) { return address == null || address.isBlank() ? "unknown" : address; }
    private static ResponseStatusException invalidCode() { return new ResponseStatusException(HttpStatus.BAD_REQUEST, INVALID_CODE); }
    public static String emailHash(String email) { return digest(normalize(email)); }
    private static String normalize(String email) { return email == null ? "" : email.trim().toLowerCase(Locale.ROOT); }
    private static String digest(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256 unavailable"); }
    }
    private static LocalDateTime utc(Instant instant) { return LocalDateTime.ofInstant(instant, ZoneOffset.UTC); }
    private static Instant instant(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDateTime date) return date.toInstant(ZoneOffset.UTC);
        // DATETIME stores UTC wall-clock fields, not the host's local instant.
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime().toInstant(ZoneOffset.UTC);
        throw new IllegalStateException("Unexpected database timestamp type");
    }
    private record Challenge(Long userId, String codeHash, Instant expiresAt, int attempts, Instant consumedAt) {}
    private static Challenge challenge(ResultSet row, int index) throws SQLException {
        var id = row.getLong("user_id");
        var userId = row.wasNull() ? null : id;
        var consumed = row.getObject("consumed_at", LocalDateTime.class);
        return new Challenge(userId, row.getString("code_hash"), row.getObject("expires_at",LocalDateTime.class).toInstant(ZoneOffset.UTC),
            row.getInt("attempts"), consumed == null ? null : consumed.toInstant(ZoneOffset.UTC));
    }
}
