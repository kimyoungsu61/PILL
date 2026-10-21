package com.pill.account;

import com.pill.auth.AuthSessionService;
import com.pill.auth.BrowserSession;
import com.pill.auth.InvalidSessionException;
import com.pill.model.User;
import com.pill.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcInsert;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.doThrow;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:account-delete-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "pill.web-push.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
@Sql({"/db/web_push.sql", "/db/account_email.sql"})
class AccountDeletionIntegrationTest {
    private static final String PASSWORD = "correct1234";
    @Autowired MockMvc mvc;
    @MockitoSpyBean JdbcTemplate db;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired AuthSessionService sessions;
    @Autowired AccountDeletionService deletion;

    @Test void deletesEveryOwnedRecordAndAllSessionsButPreservesOtherAccountAndCatalog() throws Exception {
        var owner = account();
        var other = account();
        var otherBefore = ownedRows(other);
        var catalogBefore = db.queryForList("SELECT * FROM blocked_ingredient ORDER BY id");
        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + owner.token())
            .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\",\"confirmation\":\"탈퇴\",\"userId\":" + other.id() + "}"))
            .andExpect(status().isNoContent()).andExpect(header().doesNotExist("Set-Cookie"));
        ownedRows(owner).forEach((table, rows) -> assertThat(rows).as(table + " owned data").isEmpty());
        assertThat(ownedRows(other)).usingRecursiveComparison().isEqualTo(otherBefore);
        assertThat(db.queryForList("SELECT * FROM blocked_ingredient ORDER BY id")).usingRecursiveComparison().isEqualTo(catalogBefore);
        assertThatThrownBy(() -> sessions.authenticate(owner.token())).isInstanceOf(InvalidSessionException.class);
        assertThatThrownBy(() -> sessions.authenticate(owner.secondToken())).isInstanceOf(InvalidSessionException.class);
        assertThat(sessions.authenticate(other.token()).userId()).isEqualTo(other.id());
        assertThat(sessions.authenticate(other.secondToken()).userId()).isEqualTo(other.id());
    }

    @Test void wrongPasswordDoesNotDeleteOrSignOut() throws Exception {
        var owner = account();
        var before = ownedRows(owner);
        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + owner.token())
            .contentType("application/json").content("{\"password\":\"wrong-password\",\"confirmation\":\"탈퇴\"}"))
            .andExpect(status().isBadRequest()).andExpect(header().doesNotExist("Set-Cookie"));
        assertThat(ownedRows(owner)).usingRecursiveComparison().isEqualTo(before);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + owner.token())).andExpect(status().isOk());
    }

    @Test void explicitConfirmationIsRequiredAndAnonymousRequestsCannotDelete() throws Exception {
        var owner = account();
        var before = ownedRows(owner);
        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + owner.token())
            .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\",\"confirmation\":\"확인\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/account").contentType("application/json")
            .content("{\"password\":\"" + PASSWORD + "\",\"confirmation\":\"탈퇴\"}"))
            .andExpect(status().isUnauthorized());
        assertThat(ownedRows(owner)).usingRecursiveComparison().isEqualTo(before);
    }

    @Test void browserDeletionInvalidatesOldCookieWithoutOverwritingANewerAccountCookie() throws Exception {
        var owner = account();
        var other = account();
        var cookie = new Cookie(BrowserSession.COOKIE, owner.token());
        mvc.perform(delete("/api/account").cookie(cookie).header(BrowserSession.CLIENT_HEADER, "web")
            .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\",\"confirmation\":\"탈퇴\"}"))
            .andExpect(status().isNoContent()).andExpect(header().doesNotExist("Set-Cookie"));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").cookie(new Cookie(BrowserSession.COOKIE, other.token())))
            .andExpect(status().isOk());
    }

    @Test void revokedSessionCannotDeleteEvenIfItWasAuthenticatedBeforeTheUserLock() throws Exception {
        var owner = account();
        db.update("UPDATE auth_session SET revoked_at=? WHERE id=?", Timestamp.from(Instant.now()), owner.sessionId());
        var before = ownedRows(owner);
        assertThatThrownBy(() -> deletion.delete(owner.id(), owner.sessionId(), PASSWORD, "탈퇴"))
            .isInstanceOf(InvalidSessionException.class);
        assertThat(ownedRows(owner)).usingRecursiveComparison().isEqualTo(before);
    }

    @Test void passwordGuessingIsLimitedWithoutDeletingData() throws Exception {
        var owner = account();
        var before = ownedRows(owner);
        for (int attempt = 0; attempt < 5; attempt++) {
            mvc.perform(delete("/api/account").header("Authorization", "Bearer " + owner.token())
                .contentType("application/json").content("{\"password\":\"wrong-password\",\"confirmation\":\"탈퇴\"}"))
                .andExpect(status().isBadRequest());
        }
        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + owner.token())
            .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\",\"confirmation\":\"탈퇴\"}"))
            .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
        assertThat(ownedRows(owner)).usingRecursiveComparison().isEqualTo(before);
    }

    @Test void lateDatabaseFailureRollsBackEveryEarlierDelete() throws Exception {
        var owner = account();
        var before = ownedRows(owner);
        doThrow(new DataIntegrityViolationException("isolated test failure"))
            .when(db).update("DELETE FROM users WHERE id=?", owner.id());
        mvc.perform(delete("/api/account").header("Authorization", "Bearer " + owner.token())
            .contentType("application/json").content("{\"password\":\"" + PASSWORD + "\",\"confirmation\":\"탈퇴\"}"))
            .andExpect(status().isInternalServerError()).andExpect(header().doesNotExist("Set-Cookie"));
        assertThat(ownedRows(owner)).usingRecursiveComparison().isEqualTo(before);
        assertThat(sessions.authenticate(owner.token()).userId()).isEqualTo(owner.id());
    }

    @Test void expiredSessionCannotDeleteAfterTheAuthenticationCheck() throws Exception {
        var owner = account();
        db.update("UPDATE auth_session SET expires_at=? WHERE id=?", Timestamp.from(Instant.now().minusSeconds(86400)), owner.sessionId());
        var before = ownedRows(owner);
        assertThatThrownBy(() -> deletion.delete(owner.id(), owner.sessionId(), PASSWORD, "탈퇴"))
            .isInstanceOf(InvalidSessionException.class);
        assertThat(ownedRows(owner)).usingRecursiveComparison().isEqualTo(before);
    }

    private Account account() throws Exception {
        var user = users.saveAndFlush(new User(UUID.randomUUID() + "@example.test", passwords.encode(PASSWORD)));
        var token = sessions.issue(user).token();
        var secondToken = sessions.issue(user).token();
        var sessionId = sessions.authenticate(token).sessionId();
        var now = Timestamp.from(Instant.now());
        var scan = insert("supplement_scan", Map.of("user_id", user.getId(), "status", "COMPLETED", "created_at", now, "updated_at", now));
        insert("supplement_scan", Map.of("user_id", user.getId(), "status", "FAILED", "failure_reason", "fixture failure", "created_at", now, "updated_at", now));
        var product = insert("user_supplement", Map.of("user_id", user.getId(), "scan_id", scan, "product_name", "Fixture magnesium", "confirmed_dose_time", "09:00", "created_at", now, "updated_at", now));
        insert("user_supplement_ingredient", Map.of("supplement_id", product, "name", "Magnesium", "needs_review", false, "created_at", now));
        var blocked = insert("blocked_ingredient", Map.of("name", UUID.randomUUID().toString(), "aliases", "[]", "warning_message", "fixture warning", "created_at", now));
        insert("supplement_warning", Map.of("supplement_id", product, "ingredient_id", blocked, "matched_text", "fixture", "warning_message", "fixture warning", "created_at", now));
        insert("dose_schedule", Map.of("supplement_id", product, "confirmed_time", "09:00", "repeat_days", "MON,TUE,WED,THU,FRI,SAT,SUN", "created_at", now, "updated_at", now));
        insert("dose_log", Map.of("supplement_id", product, "dose_date", LocalDate.now(), "dose_time", "09:00", "status", "TAKEN", "checked_at", now, "created_at", now));
        db.update("INSERT INTO garden_day (user_id,stamp_date,earned,completion_keys) VALUES (?,?,TRUE,?)", user.getId(), LocalDate.now(), "\n" + product + "|09:00\n");
        db.update("INSERT INTO garden_style (user_id,pot,stamp) VALUES (?,'cloud','flower')", user.getId());
        var subscription = UUID.randomUUID().toString();
        var endpointHash = hash(subscription);
        db.update("INSERT INTO web_push_subscription (id,user_id,session_id,endpoint,endpoint_hash,p256dh,auth_secret,zone_id,enabled,created_at,updated_at) VALUES (?,?,?,?,?,'fixture-key','fixture-auth','Asia/Seoul',TRUE,?,?)",
            subscription, user.getId(), sessionId, "https://push.example.test/" + subscription, endpointHash, now, now);
        var reminder = insert("web_push_reminder", Map.of("subscription_id", subscription, "supplement_id", product, "dose_time", "09:00", "created_at", now));
        insert("web_push_delivery", Map.of("reminder_id", reminder, "dose_date", LocalDate.now(), "status", "SENT", "attempts", 1, "next_attempt_at", now));
        db.update("INSERT INTO web_push_follow_up_settings (subscription_id) VALUES (?)", subscription);
        db.update("INSERT INTO web_push_follow_up (reminder_id,dose_date,status,mode,sent_count,attempts,next_at,expires_at) VALUES (?,?,'PENDING','AUTO',0,0,?,?)", reminder, LocalDate.now(), now, now);
        var emailHash = hash(user.getEmail());
        seedEmailData(user.getId(), emailHash, now);
        return new Account(user.getId(), token, secondToken, sessionId, emailHash);
    }

    private void seedEmailData(long userId, String emailHash, Timestamp now) throws Exception {
        db.update("INSERT INTO account_mail_budget (email_hash,last_requested_at,hour_started_at,hour_count,day_started_at,day_count) VALUES (?,?,?,1,?,1)", emailHash, now, now, now);
        db.update("INSERT INTO email_verification (user_id,email_hash,verified_at) VALUES (?,?,?)", userId, emailHash, now);
        var expires = Timestamp.from(now.toInstant().plusSeconds(600));
        db.update("INSERT INTO account_challenge (challenge_key,user_id,email_hash,purpose,generation,code_hash,expires_at,created_at) VALUES (?,?,?,'VERIFY',?,?,?,?)",
            hash("verify:" + emailHash), userId, emailHash, UUID.randomUUID().toString(), passwords.encode("123456"), expires, now);
        // A reset challenge requested before signup can have no user_id but must
        // still be removed with the verified owner's email.
        db.update("INSERT INTO account_challenge (challenge_key,user_id,email_hash,purpose,generation,code_hash,expires_at,created_at) VALUES (?,NULL,?,'RESET',?,?,?,?)",
            hash("reset:" + emailHash), emailHash, UUID.randomUUID().toString(), passwords.encode("654321"), expires, now);
    }

    private Map<String, List<Map<String, Object>>> ownedRows(Account account) {
        var result = new LinkedHashMap<String, List<Map<String, Object>>>();
        for (var table : List.of("auth_session", "supplement_scan", "user_supplement", "garden_day", "garden_style", "web_push_subscription", "email_verification"))
            result.put(table, db.queryForList("SELECT * FROM " + table + " WHERE user_id=? ORDER BY user_id", account.id()));
        for (var table : List.of("dose_schedule", "dose_log", "user_supplement_ingredient", "supplement_warning"))
            result.put(table, db.queryForList("SELECT * FROM " + table + " WHERE supplement_id IN (SELECT id FROM user_supplement WHERE user_id=?) ORDER BY id", account.id()));
        result.put("web_push_reminder", db.queryForList("SELECT * FROM web_push_reminder WHERE subscription_id IN (SELECT id FROM web_push_subscription WHERE user_id=?) ORDER BY id", account.id()));
        result.put("web_push_follow_up_settings", db.queryForList("SELECT * FROM web_push_follow_up_settings WHERE subscription_id IN (SELECT id FROM web_push_subscription WHERE user_id=?)", account.id()));
        for (var table : List.of("web_push_delivery", "web_push_follow_up"))
            result.put(table, db.queryForList("SELECT * FROM " + table + " WHERE reminder_id IN (SELECT r.id FROM web_push_reminder r JOIN web_push_subscription s ON s.id=r.subscription_id WHERE s.user_id=?)", account.id()));
        result.put("users", db.queryForList("SELECT * FROM users WHERE id=?", account.id()));
        result.put("account_challenge", db.queryForList("SELECT * FROM account_challenge WHERE user_id=? OR email_hash=? ORDER BY challenge_key", account.id(), account.emailHash()));
        result.put("account_mail_budget", db.queryForList("SELECT * FROM account_mail_budget WHERE email_hash=?", account.emailHash()));
        return result;
    }

    private long insert(String table, Map<String, Object> values) {
        return new SimpleJdbcInsert(db).withTableName(table).usingColumns(values.keySet().toArray(String[]::new))
            .usingGeneratedKeyColumns("id").executeAndReturnKey(values).longValue();
    }

    private static String hash(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private record Account(Long id, String token, String secondToken, Long sessionId, String emailHash) {}
}
