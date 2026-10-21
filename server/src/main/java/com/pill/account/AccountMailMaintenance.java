package com.pill.account;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AccountMailMaintenance {
    private final JdbcTemplate db;
    private final Clock clock;
    public AccountMailMaintenance(JdbcTemplate db, Clock clock) { this.db = db; this.clock = clock; }

    @Scheduled(fixedDelay=86400000, initialDelay=600000)
    @Transactional
    public void purge() {
        var now = clock.instant();
        db.update("DELETE FROM account_challenge WHERE expires_at<?", LocalDateTime.ofInstant(now.minusSeconds(86400),ZoneOffset.UTC));
        db.update("DELETE FROM account_mail_budget WHERE last_requested_at<?", LocalDateTime.ofInstant(now.minusSeconds(172800),ZoneOffset.UTC));
    }
}
