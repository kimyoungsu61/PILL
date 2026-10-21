package com.pill.account;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.concurrent.Executor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class AccountMailDelivery {
    private static final Logger log = LoggerFactory.getLogger(AccountMailDelivery.class);
    private final AccountMailSender sender;
    private final JdbcTemplate db;
    private final Executor executor;
    private final Clock clock;
    private final TransactionTemplate invalidation;
    public AccountMailDelivery(AccountMailSender sender, JdbcTemplate db,
        @Qualifier("accountMailExecutor") Executor executor, Clock clock, PlatformTransactionManager transactions) {
        this.sender = sender; this.db = db; this.executor = executor; this.clock = clock;
        this.invalidation = new TransactionTemplate(transactions);
        this.invalidation.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void enqueue(String email, String code, String purpose, String key, String generation) {
        try {
            executor.execute(() -> {
                try {
                    // A queued request can be superseded or its account deleted before sending.
                    var live = db.queryForObject("""
                        SELECT COUNT(*) FROM account_challenge c JOIN users u ON u.id=c.user_id
                        WHERE c.challenge_key=? AND c.generation=? AND c.consumed_at IS NULL AND c.expires_at>?
                        """, Integer.class, key, generation, LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC));
                    if (live == null || live == 0) return;
                    var reset = "RESET".equals(purpose);
                    sender.send(email, reset ? "[PILL] 비밀번호 재설정 코드" : "[PILL] 이메일 인증 코드",
                        "PILL " + (reset ? "비밀번호 재설정" : "이메일 인증") + " 코드입니다.\n\n" + code
                            + "\n\n10분 안에 입력해 주세요. 이 코드는 한 번만 사용할 수 있어요.\n"
                            + "본인이 요청하지 않았다면 이 메일을 무시해 주세요. 코드를 다른 사람에게 알려주지 마세요.",
                        "pill-account-" + generation);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt(); invalidate(key, generation);
                } catch (Exception exception) {
                    invalidate(key, generation);
                }
            });
        } catch (RuntimeException rejected) { invalidate(key, generation); }
    }

    private void invalidate(String key, String generation) {
        try {
            // Rejection may run in afterCommit while the original connection is still bound.
            // Always commit invalidation in its own transaction.
            invalidation.executeWithoutResult(status -> db.update(
                "UPDATE account_challenge SET consumed_at=? WHERE challenge_key=? AND generation=? AND consumed_at IS NULL",
                LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC), key, generation));
        } catch (RuntimeException ignored) { /* An expired or removed challenge cannot be confirmed either. */ }
        // Deliberately omit the recipient, purpose, code, provider body and exception message.
        log.warn("Account mail delivery failed; request a new code after the resend interval.");
    }
}
