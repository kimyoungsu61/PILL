package com.pill.notification;

import com.pill.auth.SessionPrincipal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class WebPushStore {
    private final JdbcTemplate db;
    public WebPushStore(JdbcTemplate db) { this.db = db; }
    public record Device(String id, long userId, long sessionId, String endpoint, String p256dh, String auth, String zoneId, boolean enabled) {}
    public record Reminder(long id, Device device, long supplementId, String productName, String doseTime, String configuredTimes, Instant createdAt) {}
    public record ReminderView(long supplementId, String time) {}
    public record Delivery(String status, int attempts, Instant nextAttemptAt) {}
    public static LocalDateTime utc(Instant instant) { return LocalDateTime.ofInstant(instant, ZoneOffset.UTC); }

    public Device byEndpointHash(String hash) {
        return db.query("SELECT * FROM web_push_subscription WHERE endpoint_hash=? FOR UPDATE", this::device, hash).stream().findFirst().orElse(null);
    }
    public Device owned(SessionPrincipal principal, String id) {
        return db.query("SELECT * FROM web_push_subscription WHERE id=? AND user_id=? AND session_id=?", this::device,
            id, principal.userId(), principal.sessionId()).stream().findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "연결된 알림 기기를 찾지 못했어요."));
    }
    public void lockUser(long id) { db.queryForList("SELECT id FROM users WHERE id=? FOR UPDATE", id); }
    public int deviceCount(long userId) { return db.queryForObject("SELECT COUNT(*) FROM web_push_subscription s JOIN auth_session a ON a.id=s.session_id WHERE s.user_id=? AND s.enabled=TRUE AND a.revoked_at IS NULL", Integer.class, userId); }
    public void insert(Device d, String hash, Instant now) {
        db.update("INSERT INTO web_push_subscription (id,user_id,session_id,endpoint,endpoint_hash,p256dh,auth_secret,zone_id,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,TRUE,?,?)",
            d.id(), d.userId(), d.sessionId(), d.endpoint(), hash, d.p256dh(), d.auth(), d.zoneId(), utc(now), utc(now));
    }
    public void reconnect(Device d, Instant now) {
        db.update("UPDATE web_push_subscription SET session_id=?, zone_id=?, enabled=TRUE, updated_at=? WHERE id=?",
            d.sessionId(), d.zoneId(), utc(now), d.id());
    }
    public List<ReminderView> reminders(String id) {
        // The product's current dose schedule remains the source of truth.
        return db.query("""
            SELECT r.supplement_id,r.dose_time,u.confirmed_dose_time FROM web_push_reminder r
            JOIN user_supplement u ON u.id=r.supplement_id WHERE r.subscription_id=? ORDER BY r.supplement_id,r.dose_time
            """, (rs,n) -> new Object[]{rs.getLong(1),rs.getString(2),rs.getString(3)}, id).stream()
            .filter(row -> WebPushService.times((String)row[2]).contains((String)row[1]))
            .map(row -> new ReminderView((Long)row[0],(String)row[1])).toList();
    }
    public String ownedProductTimes(long userId, long supplementId) {
        return db.query("SELECT COALESCE(confirmed_dose_time,'') FROM user_supplement WHERE id=? AND user_id=?", (rs,n) -> rs.getString(1), supplementId,userId)
            .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"영양제를 찾지 못했어요."));
    }
    public void setReminders(String id, long supplementId, List<String> times, Instant now) {
        var existing = db.query("SELECT dose_time FROM web_push_reminder WHERE subscription_id=? AND supplement_id=?", (rs,n)->rs.getString(1),id,supplementId);
        for (var time : existing) if (!times.contains(time)) db.update("DELETE FROM web_push_reminder WHERE subscription_id=? AND supplement_id=? AND dose_time=?",id,supplementId,time);
        for (var time : times) if (!existing.contains(time)) db.update("INSERT INTO web_push_reminder (subscription_id,supplement_id,dose_time,created_at) VALUES (?,?,?,?)",id,supplementId,time,utc(now));
    }
    public void remove(String id) { db.update("DELETE FROM web_push_subscription WHERE id=?",id); }
    public void disable(String id) { db.update("UPDATE web_push_subscription SET enabled=FALSE WHERE id=?",id); }
    public List<Long> activeReminderIds(Instant now) {
        return db.query("""
            SELECT r.id FROM web_push_reminder r JOIN web_push_subscription s ON s.id=r.subscription_id
            JOIN auth_session a ON a.id=s.session_id WHERE s.enabled=TRUE AND a.revoked_at IS NULL AND a.expires_at>?
            ORDER BY r.id
            """,(rs,n)->rs.getLong(1),utc(now));
    }
    public Reminder lockReminder(long id, Instant now) {
        if (db.queryForList("SELECT id FROM web_push_reminder WHERE id=? FOR UPDATE",id).isEmpty()) return null;
        return db.query("""
            SELECT r.id AS reminder_id,r.supplement_id,r.dose_time,r.created_at AS reminder_created,
                   s.*,u.product_name,u.display_name_ko,u.confirmed_dose_time
            FROM web_push_reminder r JOIN web_push_subscription s ON s.id=r.subscription_id
            JOIN auth_session a ON a.id=s.session_id JOIN user_supplement u ON u.id=r.supplement_id
            WHERE r.id=? AND s.enabled=TRUE AND a.user_id=s.user_id AND u.user_id=s.user_id
              AND a.revoked_at IS NULL AND a.expires_at>?
            """,(rs,n)->new Reminder(rs.getLong("reminder_id"),device(rs,n),rs.getLong("supplement_id"),
                firstText(rs.getString("display_name_ko"),rs.getString("product_name")),rs.getString("dose_time"),
                rs.getString("confirmed_dose_time"),rs.getObject("reminder_created",LocalDateTime.class).toInstant(ZoneOffset.UTC)),id,utc(now))
            .stream().findFirst().orElse(null);
    }
    public boolean taken(long supplementId, LocalDate date, String time) {
        return db.queryForObject("SELECT COUNT(*) FROM dose_log WHERE supplement_id=? AND dose_date=? AND dose_time=? AND status='TAKEN'",Integer.class,supplementId,date,time)>0;
    }
    public Delivery delivery(long id, LocalDate date) {
        return db.query("SELECT * FROM web_push_delivery WHERE reminder_id=? AND dose_date=?",(rs,n)->new Delivery(rs.getString("status"),rs.getInt("attempts"),
            rs.getObject("next_attempt_at",LocalDateTime.class).toInstant(ZoneOffset.UTC)),id,date).stream().findFirst().orElse(null);
    }
    public void saveDelivery(long id, LocalDate date, String status, int attempts, Instant next, boolean exists) {
        if(exists) db.update("UPDATE web_push_delivery SET status=?,attempts=?,next_attempt_at=? WHERE reminder_id=? AND dose_date=?",status,attempts,utc(next),id,date);
        else db.update("INSERT INTO web_push_delivery (reminder_id,dose_date,status,attempts,next_attempt_at) VALUES (?,?,?,?,?)",id,date,status,attempts,utc(next));
    }
    public void purge(Instant now) {
        db.update("DELETE FROM web_push_delivery WHERE dose_date<?",now.atZone(ZoneOffset.UTC).toLocalDate().minusDays(30));
        db.update("DELETE FROM web_push_subscription WHERE session_id IN (SELECT id FROM auth_session WHERE expires_at<? OR revoked_at<?)",utc(now.minusSeconds(2592000)),utc(now.minusSeconds(2592000)));
    }
    private Device device(ResultSet rs,int index) throws SQLException {
        return new Device(rs.getString("id"),rs.getLong("user_id"),rs.getLong("session_id"),rs.getString("endpoint"),
            rs.getString("p256dh"),rs.getString("auth_secret"),rs.getString("zone_id"),rs.getBoolean("enabled"));
    }
    private static String firstText(String first,String second) { return first!=null&&!first.isBlank()?first:second!=null&&!second.isBlank()?second:"영양제"; }
}
