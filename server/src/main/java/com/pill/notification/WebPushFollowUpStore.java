package com.pill.notification;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class WebPushFollowUpStore {
    private final JdbcTemplate db;
    public WebPushFollowUpStore(JdbcTemplate db) { this.db = db; }
    public record Key(long reminderId, LocalDate doseDate) {}
    public record Pending(long reminderId, LocalDate doseDate, String status, String mode,
        int sentCount, int attempts, Instant nextAt, Instant expiresAt) {}

    public FollowUpSettings settings(String subscriptionId) {
        return db.query("SELECT * FROM web_push_follow_up_settings WHERE subscription_id=?", (rs, n) ->
            new FollowUpSettings(rs.getBoolean("enabled"), rs.getInt("interval_minutes"), rs.getInt("max_follow_ups"),
                rs.getBoolean("quiet_enabled"), rs.getString("quiet_start"), rs.getString("quiet_end")), subscriptionId)
            .stream().findFirst().orElseGet(FollowUpSettings::defaults);
    }

    public void saveSettings(String subscriptionId, FollowUpSettings settings) {
        // The caller locks this subscription before the read/update pair.
        if (db.queryForList("SELECT subscription_id FROM web_push_follow_up_settings WHERE subscription_id=?", subscriptionId).isEmpty()) {
            db.update("INSERT INTO web_push_follow_up_settings (subscription_id,enabled,interval_minutes,max_follow_ups,quiet_enabled,quiet_start,quiet_end) VALUES (?,?,?,?,?,?,?)",
                subscriptionId, settings.enabled(), settings.intervalMinutes(), settings.maxFollowUps(), settings.quietEnabled(), settings.quietStart(), settings.quietEnd());
        } else {
            db.update("UPDATE web_push_follow_up_settings SET enabled=?,interval_minutes=?,max_follow_ups=?,quiet_enabled=?,quiet_start=?,quiet_end=? WHERE subscription_id=?",
                settings.enabled(), settings.intervalMinutes(), settings.maxFollowUps(), settings.quietEnabled(), settings.quietStart(), settings.quietEnd(), subscriptionId);
        }
        if (!settings.enabled()) db.update("""
            UPDATE web_push_follow_up SET status='CANCELLED' WHERE mode='AUTO' AND status='PENDING'
            AND reminder_id IN (SELECT id FROM web_push_reminder WHERE subscription_id=?)
            """, subscriptionId);
    }

    public List<Key> due(Instant now) {
        return db.query("SELECT reminder_id,dose_date FROM web_push_follow_up WHERE status='PENDING' AND next_at<=? ORDER BY next_at LIMIT 200",
            (rs, n) -> new Key(rs.getLong(1), rs.getObject(2, LocalDate.class)), WebPushStore.utc(now));
    }

    public Pending find(long id, LocalDate date) {
        return db.query("SELECT * FROM web_push_follow_up WHERE reminder_id=? AND dose_date=?", (rs, n) ->
            new Pending(id, date, rs.getString("status"), rs.getString("mode"), rs.getInt("sent_count"), rs.getInt("attempts"),
                rs.getObject("next_at", LocalDateTime.class).toInstant(ZoneOffset.UTC),
                rs.getObject("expires_at", LocalDateTime.class).toInstant(ZoneOffset.UTC)), id, date).stream().findFirst().orElse(null);
    }

    public void save(Pending pending) {
        boolean exists = find(pending.reminderId(), pending.doseDate()) != null;
        if (exists) db.update("UPDATE web_push_follow_up SET status=?,mode=?,sent_count=?,attempts=?,next_at=?,expires_at=? WHERE reminder_id=? AND dose_date=?",
            pending.status(), pending.mode(), pending.sentCount(), pending.attempts(), WebPushStore.utc(pending.nextAt()),
            WebPushStore.utc(pending.expiresAt()), pending.reminderId(), pending.doseDate());
        else db.update("INSERT INTO web_push_follow_up (reminder_id,dose_date,status,mode,sent_count,attempts,next_at,expires_at) VALUES (?,?,?,?,?,?,?,?)",
            pending.reminderId(), pending.doseDate(), pending.status(), pending.mode(), pending.sentCount(), pending.attempts(),
            WebPushStore.utc(pending.nextAt()), WebPushStore.utc(pending.expiresAt()));
    }

    public void finish(long id, LocalDate date, String status) {
        db.update("UPDATE web_push_follow_up SET status=? WHERE reminder_id=? AND dose_date=?", status, id, date);
    }

    public void purge(Instant now) {
        db.update("DELETE FROM web_push_follow_up WHERE dose_date<?", now.atZone(ZoneOffset.UTC).toLocalDate().minusDays(30));
    }
}
