package com.pill.account;

import com.pill.auth.AuthSessionService;
import com.pill.auth.AuthService;
import com.pill.auth.InvalidSessionException;
import com.pill.common.RateLimitExceededException;
import com.pill.model.User;
import com.pill.repository.UserRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:account-email-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "pill.web-push.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
@Sql({"/db/web_push.sql", "/db/account_email.sql"})
class AccountEmailIntegrationTest {
    @Autowired AccountEmailService accounts;
    @Autowired AccountMailMaintenance maintenance;
    @Autowired UserRepository users;
    @Autowired AuthSessionService sessions;
    @Autowired AuthService auth;
    @MockitoSpyBean PasswordEncoder encoder;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean Clock clock;
    @MockitoBean AccountMailSender sender;
    @MockitoBean AccountMailDelivery delivery;
    User user;
    String address;
    final List<Mail> sent = new ArrayList<>();
    static final Instant NOW = Instant.parse("2026-10-21T03:00:00Z");
    record Mail(String email, String code, String purpose, String key, String generation) {}

    @BeforeEach void prepare() {
        when(clock.instant()).thenReturn(NOW);
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
        when(sender.available()).thenReturn(true);
        doAnswer(invocation -> {
            synchronized(sent) { sent.add(new Mail(invocation.getArgument(0), invocation.getArgument(1),
                invocation.getArgument(2), invocation.getArgument(3), invocation.getArgument(4))); }
            return null;
        }).when(delivery).enqueue(anyString(), anyString(), anyString(), anyString(), anyString());
        user = users.saveAndFlush(new User(UUID.randomUUID()+"@example.test", encoder.encode("old-pass123")));
        address = UUID.randomUUID().toString();
    }

    @Test void profileStartsUnverifiedAndDisabledMailNeverPretendsToSend() {
        assertThat(accounts.profile(user.getId()).emailVerified()).isFalse();
        when(sender.available()).thenReturn(false);
        assertThat(accounts.profile(user.getId()).mailAvailable()).isFalse();
        assertThatThrownBy(() -> accounts.requestVerification(user.getId(),address)).hasMessageContaining("503");
        assertThatThrownBy(() -> accounts.requestReset(user.getEmail(),address)).hasMessageContaining("503");
        assertThat(sent).isEmpty();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM account_challenge WHERE user_id=?",Integer.class,user.getId())).isZero();
    }

    @Test void verificationIsUserScopedHashedAndConsumedOnlyOnce() {
        accounts.requestVerification(user.getId(),address);
        var mail=sent.getFirst();
        assertThat(mail.code()).matches("[0-9]{6}");
        var digest=db.queryForObject("SELECT code_hash FROM account_challenge WHERE user_id=?",String.class,user.getId());
        assertThat(digest).isNotEqualTo(mail.code());
        assertThat(encoder.matches(mail.code(),digest)).isTrue();
        var stranger=users.saveAndFlush(new User(UUID.randomUUID()+"@example.test","hash"));
        assertThatThrownBy(() -> accounts.confirmVerification(stranger.getId(),mail.code(),address)).hasMessageContaining("400");
        assertThat(accounts.confirmVerification(user.getId(),mail.code(),address).emailVerified()).isTrue();
        assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),mail.code(),address)).hasMessageContaining("400");
        assertThat(accounts.profile(stranger.getId()).emailVerified()).isFalse();
    }

    @Test void wrongCodeAttemptsCommitAcrossSeparateRequestsAndCorrectCodeThenLocksOut() {
        accounts.requestVerification(user.getId(),address);
        var correct=sent.getFirst().code();
        var wrong=correct.equals("000000")?"111111":"000000";
        for(int attempt=0;attempt<5;attempt++)
            assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),wrong,address)).hasMessageContaining("400");
        assertThat(db.queryForObject("SELECT attempts FROM account_challenge WHERE user_id=?",Integer.class,user.getId())).isEqualTo(5);
        assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),correct,address)).hasMessageContaining("400");
        assertThat(accounts.profile(user.getId()).emailVerified()).isFalse();
    }

    @Test void expirationAndResendInvalidateEarlierCode() {
        accounts.requestVerification(user.getId(),address);
        var first=sent.getFirst().code();
        when(clock.instant()).thenReturn(NOW.plusSeconds(600));
        assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),first,address)).hasMessageContaining("400");
        accounts.requestVerification(user.getId(),address);
        assertThat(sent).hasSize(2);
        assertThat(db.queryForObject("SELECT generation FROM account_challenge WHERE user_id=?",String.class,user.getId())).isEqualTo(sent.getLast().generation());
        if(!first.equals(sent.getLast().code()))
            assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),first,address)).hasMessageContaining("400");
        assertThat(accounts.confirmVerification(user.getId(),sent.getLast().code(),address).emailVerified()).isTrue();
    }

    @Test void requestingResetNeverRevealsWhetherEmailIsRegistered() {
        var existing=accounts.requestReset(user.getEmail(),address);
        var unknown=accounts.requestReset(UUID.randomUUID()+"@example.test",address);
        assertThat(existing).isEqualTo(unknown);
        assertThat(sent).hasSize(1);
        assertThat(sent.getFirst().email()).isEqualTo(user.getEmail());
        assertThat(accounts.profile(user.getId()).emailVerified()).isFalse();
    }

    @Test void resetReplacesPasswordRevokesEverySessionAndStopsPendingPush() {
        var token1=sessions.issue(user).token();
        var token2=sessions.issue(user).token();
        var session=sessions.authenticate(token1).sessionId();
        var device=UUID.randomUUID().toString();
        db.update("INSERT INTO web_push_subscription(id,user_id,session_id,endpoint,endpoint_hash,p256dh,auth_secret,zone_id,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
            device,user.getId(),session,"https://example.test/push",UUID.randomUUID().toString(),"key","auth","Asia/Seoul");
        accounts.requestReset(user.getEmail(),address);
        var code=sent.getFirst().code();
        accounts.confirmReset("  "+user.getEmail().toUpperCase()+"  ",code,"new-pass123",address);
        var stored=users.findById(user.getId()).orElseThrow();
        assertThat(encoder.matches("new-pass123",stored.getPasswordHash())).isTrue();
        assertThat(encoder.matches("old-pass123",stored.getPasswordHash())).isFalse();
        assertThatThrownBy(() -> sessions.authenticate(token1)).isInstanceOf(InvalidSessionException.class);
        assertThatThrownBy(() -> sessions.authenticate(token2)).isInstanceOf(InvalidSessionException.class);
        assertThat(db.queryForObject("SELECT enabled FROM web_push_subscription WHERE id=?",Boolean.class,device)).isFalse();
        assertThat(accounts.profile(user.getId()).emailVerified()).isTrue();
        assertThatThrownBy(() -> accounts.confirmReset(user.getEmail(),code,"another-pass123",address)).hasMessageContaining("400");
    }

    @Test void resetCodeCannotBeUsedForVerificationOrAnotherAccount() {
        accounts.requestReset(user.getEmail(),address);
        var code=sent.getFirst().code();
        assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),code,address)).hasMessageContaining("400");
        var other=users.saveAndFlush(new User(UUID.randomUUID()+"@example.test",encoder.encode("unchanged123")));
        assertThatThrownBy(() -> accounts.confirmReset(other.getEmail(),code,"new-pass123",address)).hasMessageContaining("400");
        assertThat(encoder.matches("unchanged123",users.findById(other.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test void resetRejectsOversizedUtf8PasswordWithoutConsumingValidCode() {
        accounts.requestReset(user.getEmail(),address);
        var code=sent.getFirst().code();
        assertThatThrownBy(() -> accounts.confirmReset(user.getEmail(),code,"가".repeat(25),address)).hasMessageContaining("400");
        assertThatThrownBy(() -> accounts.confirmReset(user.getEmail(),code,"short",address)).hasMessageContaining("400");
        accounts.confirmReset(user.getEmail(),code,"가".repeat(24),address);
        assertThat(encoder.matches("가".repeat(24),users.findById(user.getId()).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test void resendCooldownAndHourlyLimitArePersistentAndSharedAcrossPurposes() {
        accounts.requestVerification(user.getId(),address);
        assertThatThrownBy(() -> accounts.requestReset(user.getEmail(),address)).isInstanceOf(RateLimitExceededException.class);
        for(int index=1;index<5;index++) {
            when(clock.instant()).thenReturn(NOW.plusSeconds(index*61L));
            accounts.requestReset(user.getEmail(),address);
        }
        when(clock.instant()).thenReturn(NOW.plusSeconds(400));
        assertThatThrownBy(() -> accounts.requestVerification(user.getId(),address)).isInstanceOf(RateLimitExceededException.class);
        assertThat(db.queryForObject("SELECT hour_count FROM account_mail_budget WHERE email_hash=?",Integer.class,AccountEmailService.emailHash(user.getEmail()))).isEqualTo(5);
    }

    @Test void dailyLimitSurvivesHourlyWindowChanges() {
        for(int index=0;index<10;index++) {
            when(clock.instant()).thenReturn(NOW.plusSeconds(index*3700L));
            accounts.requestReset(user.getEmail(),address);
        }
        when(clock.instant()).thenReturn(NOW.plusSeconds(37000));
        assertThatThrownBy(() -> accounts.requestReset(user.getEmail(),address)).isInstanceOf(RateLimitExceededException.class);
        assertThat(sent).hasSize(10);
    }

    @Test void simultaneousResetConfirmationsHaveOnlyOneWinner() throws Exception {
        accounts.requestReset(user.getEmail(),address);
        var code=sent.getFirst().code();
        var executor=Executors.newFixedThreadPool(2);
        try {
            var first=executor.submit(() -> attemptReset(code,"new-password-one"));
            var second=executor.submit(() -> attemptReset(code,"new-password-two"));
            assertThat(List.of(first.get(15,TimeUnit.SECONDS),second.get(15,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        } finally { executor.shutdownNow(); }
    }

    @Test void loginThatLocksFirstCannotLeaveAnOldPasswordSessionAfterConcurrentReset() throws Exception {
        accounts.requestReset(user.getEmail(),address);
        var code=sent.getFirst().code();
        var checkingOldPassword=new CountDownLatch(1);
        var releaseLogin=new CountDownLatch(1);
        doAnswer(invocation -> {
            checkingOldPassword.countDown();
            if(!releaseLogin.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("test login release timed out");
            return invocation.callRealMethod();
        }).when(encoder).matches(eq("old-pass123"),anyString());
        var executor=Executors.newFixedThreadPool(2);
        try {
            var login=executor.submit(() -> auth.login(user.getEmail(),"old-pass123"));
            assertThat(checkingOldPassword.await(10,TimeUnit.SECONDS)).isTrue();
            var resetStarted=new CountDownLatch(1);
            var reset=executor.submit(() -> { resetStarted.countDown(); accounts.confirmReset(user.getEmail(),code,"new-pass123",address); });
            assertThat(resetStarted.await(10,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> reset.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            releaseLogin.countDown();
            var oldSession=login.get(10,TimeUnit.SECONDS).token();
            reset.get(10,TimeUnit.SECONDS);
            assertThatThrownBy(() -> sessions.authenticate(oldSession)).isInstanceOf(InvalidSessionException.class);
            assertThat(auth.login(user.getEmail(),"new-pass123").email()).isEqualTo(user.getEmail());
        } finally { releaseLogin.countDown(); executor.shutdownNow(); }
    }

    @Test void resetThatLocksFirstRejectsConcurrentLoginUsingTheOldPassword() throws Exception {
        accounts.requestReset(user.getEmail(),address);
        var code=sent.getFirst().code();
        var checkingResetCode=new CountDownLatch(1);
        var releaseReset=new CountDownLatch(1);
        doAnswer(invocation -> {
            checkingResetCode.countDown();
            if(!releaseReset.await(10,TimeUnit.SECONDS)) throw new IllegalStateException("test reset release timed out");
            return invocation.callRealMethod();
        }).when(encoder).matches(eq(code),anyString());
        var executor=Executors.newFixedThreadPool(2);
        try {
            var reset=executor.submit(() -> accounts.confirmReset(user.getEmail(),code,"new-pass123",address));
            assertThat(checkingResetCode.await(10,TimeUnit.SECONDS)).isTrue();
            var loginStarted=new CountDownLatch(1);
            var login=executor.submit(() -> { loginStarted.countDown(); return auth.login(user.getEmail(),"old-pass123"); });
            assertThat(loginStarted.await(10,TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> login.get(150,TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
            releaseReset.countDown();
            reset.get(10,TimeUnit.SECONDS);
            assertThatThrownBy(() -> login.get(10,TimeUnit.SECONDS)).hasCauseInstanceOf(IllegalArgumentException.class)
                .hasRootCauseMessage("invalid credentials");
            assertThat(db.queryForObject("SELECT COUNT(*) FROM auth_session WHERE user_id=? AND revoked_at IS NULL",Integer.class,user.getId())).isZero();
        } finally { releaseReset.countDown(); executor.shutdownNow(); }
    }

    @Test void failedDeliveryInvalidatesItsCodeAndLateOldDeliveryCannotInvalidateReplacement() throws Exception {
        accounts.requestVerification(user.getId(),address);
        var first=sent.getFirst();
        var realDelivery=new AccountMailDelivery(sender,db,Runnable::run,clock,transactions);
        doThrow(new java.io.IOException("private provider error")).when(sender).send(anyString(),anyString(),anyString(),anyString());
        realDelivery.enqueue(first.email(),first.code(),first.purpose(),first.key(),first.generation());
        assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),first.code(),address)).hasMessageContaining("400");
        when(clock.instant()).thenReturn(NOW.plusSeconds(61));
        accounts.requestVerification(user.getId(),address);
        var replacement=sent.getLast();
        realDelivery.enqueue(first.email(),first.code(),first.purpose(),first.key(),first.generation());
        assertThat(accounts.confirmVerification(user.getId(),replacement.code(),address).emailVerified()).isTrue();
        verify(sender,times(1)).send(anyString(),anyString(),anyString(),anyString());
    }

    @Test void queueRejectionAfterCommitPersistsCodeInvalidationInItsOwnTransaction() throws Exception {
        accounts.requestVerification(user.getId(),address);
        var mail=sent.getFirst();
        var rejected=new AccountMailDelivery(sender,db,task->{throw new java.util.concurrent.RejectedExecutionException();},clock,transactions);
        new TransactionTemplate(transactions).executeWithoutResult(status ->
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    rejected.enqueue(mail.email(),mail.code(),mail.purpose(),mail.key(),mail.generation());
                }
            }));
        assertThat(db.queryForObject("SELECT consumed_at FROM account_challenge WHERE challenge_key=?",java.sql.Timestamp.class,mail.key())).isNotNull();
        assertThatThrownBy(() -> accounts.confirmVerification(user.getId(),mail.code(),address)).hasMessageContaining("400");
        verify(sender,never()).send(anyString(),anyString(),anyString(),anyString());
    }

    @Test void publicResetAndConfigWorkWithoutSessionAndProfileRequiresLogin() throws Exception {
        mvc.perform(get("/api/auth/account-config")).andExpect(status().isOk()).andExpect(jsonPath("$.mailAvailable").value(true));
        mvc.perform(get("/api/account/profile")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/account/email-verification/request")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/password-reset/request").contentType("application/json")
            .content("{\"email\":\""+user.getEmail()+"\"}"))
            .andExpect(status().isAccepted()).andExpect(jsonPath("$.resendAfterSeconds").value(60));
        mvc.perform(post("/api/auth/password-reset/confirm").contentType("application/json")
            .content("{\"email\":\""+user.getEmail()+"\",\"code\":\""+sent.getFirst().code()+"\",\"newPassword\":\"new-pass123\"}"))
            .andExpect(status().isNoContent());
    }

    @Test void malformedCodesAndEmailsAreRejectedByHttpValidation() throws Exception {
        mvc.perform(post("/api/auth/password-reset/request").contentType("application/json").content("{\"email\":\"not-an-email\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/password-reset/confirm").contentType("application/json")
            .content("{\"email\":\"user@example.test\",\"code\":\"bad\",\"newPassword\":\"new-pass123\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test void maintenanceRemovesExpiredChallengesAndBudgetsButPreservesVerifiedAddress() {
        accounts.requestVerification(user.getId(),address);
        accounts.confirmVerification(user.getId(),sent.getFirst().code(),address);
        when(clock.instant()).thenReturn(NOW.plusSeconds(173401));
        maintenance.purge();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM account_challenge WHERE user_id=?",Integer.class,user.getId())).isZero();
        assertThat(db.queryForObject("SELECT COUNT(*) FROM account_mail_budget WHERE email_hash=?",Integer.class,AccountEmailService.emailHash(user.getEmail()))).isZero();
        assertThat(accounts.profile(user.getId()).emailVerified()).isTrue();
    }

    private boolean attemptReset(String code,String password) {
        try { accounts.confirmReset(user.getEmail(),code,password,address); return true; }
        catch(org.springframework.web.server.ResponseStatusException expected) { return false; }
    }
}
