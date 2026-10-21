package com.pill.notification;

import com.pill.auth.SessionPrincipal;
import com.pill.garden.GardenService;
import com.pill.model.DoseLog;
import com.pill.repository.DoseLogRepository;
import com.pill.repository.UserSupplementRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WebPushFollowUps {
    private final WebPushStore store;
    private final WebPushFollowUpStore followUps;
    private final WebPushSender sender;
    private final Clock clock;
    private final DoseLogRepository logs;
    private final UserSupplementRepository supplements;
    private final GardenService garden;

    public WebPushFollowUps(WebPushStore store, WebPushFollowUpStore followUps, WebPushSender sender,
        Clock clock, DoseLogRepository logs, UserSupplementRepository supplements, GardenService garden) {
        this.store = store; this.followUps = followUps; this.sender = sender; this.clock = clock;
        this.logs = logs; this.supplements = supplements;
        this.garden = garden;
    }

    public record DoseView(long supplementId, String name, LocalDate doseDate, String doseTime,
        String status, boolean active, boolean canSnooze, Instant nextReminderAt) {}

    // Called inside the original dispatch transaction while its reminder is locked.
    public void afterInitialDelivery(WebPushStore.Reminder reminder, LocalDate date, Instant now) {
        var settings = followUps.settings(reminder.device().id());
        if (settings.enabled()) schedule(reminder, date, now.plus(Duration.ofMinutes(settings.intervalMinutes())), 0, "AUTO", settings);
    }

    private void schedule(WebPushStore.Reminder reminder, LocalDate date, Instant next, int sent, String mode, FollowUpSettings settings) {
        var end = ReminderOccurrence.end(reminder, date);
        if (!next.isBefore(end) || settings.quietAt(next.atZone(ZoneId.of(reminder.device().zoneId())).toLocalTime())) {
            followUps.finish(reminder.id(), date, "CANCELLED");
            return;
        }
        var expires = next.plus(Duration.ofMinutes(5));
        if (end.isBefore(expires)) expires = end;
        followUps.save(new WebPushFollowUpStore.Pending(reminder.id(), date, "PENDING", mode, sent, 0, next, expires));
    }

    @Transactional
    public void dispatch(WebPushFollowUpStore.Key key) {
        if (!sender.enabled()) return;
        var now = clock.instant();
        var reminder = store.lockReminder(key.reminderId(), now);
        if (reminder == null) { followUps.finish(key.reminderId(), key.doseDate(), "CANCELLED"); return; }
        var pending = followUps.find(key.reminderId(), key.doseDate());
        if (pending == null || !"PENDING".equals(pending.status()) || now.isBefore(pending.nextAt())) return;
        var settings = followUps.settings(reminder.device().id());
        if (!WebPushService.times(reminder.configuredTimes()).contains(reminder.doseTime())
            || !ReminderOccurrence.active(reminder, key.doseDate(), now) || !now.isBefore(pending.expiresAt())
            || store.recorded(reminder.supplementId(), key.doseDate(), reminder.doseTime())
            || pending.sentCount() >= 3 || ("AUTO".equals(pending.mode()) && (!settings.enabled() || pending.sentCount() >= settings.maxFollowUps()))
            || settings.quietAt(now.atZone(ZoneId.of(reminder.device().zoneId())).toLocalTime())) {
            followUps.finish(reminder.id(), key.doseDate(), "CANCELLED"); return;
        }
        int response = 503;
        try {
            response = sender.send(reminder.device(), payload(reminder, key.doseDate(), pending.expiresAt(), pending.sentCount() + 1));
        } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
        catch (Exception ignored) { /* Only retry within this occurrence's bounded delivery window. */ }
        if (response >= 200 && response < 300) {
            int sent = pending.sentCount() + 1;
            followUps.save(new WebPushFollowUpStore.Pending(reminder.id(), key.doseDate(), "DONE", pending.mode(), sent, 0, pending.nextAt(), pending.expiresAt()));
            if (settings.enabled() && sent < settings.maxFollowUps()) {
                schedule(reminder, key.doseDate(), now.plus(Duration.ofMinutes(settings.intervalMinutes())), sent, "AUTO", settings);
            }
        } else if (response == 404 || response == 410) {
            store.disable(reminder.device().id()); followUps.finish(reminder.id(), key.doseDate(), "EXPIRED");
        } else {
            int attempts = pending.attempts() + 1;
            var status = attempts >= 3 || (response != 429 && response < 500) ? "FAILED" : "PENDING";
            followUps.save(new WebPushFollowUpStore.Pending(reminder.id(), key.doseDate(), status, pending.mode(),
                pending.sentCount(), attempts, now.plusSeconds(30L * attempts), pending.expiresAt()));
        }
    }

    @Transactional
    public DoseView view(SessionPrincipal principal, String deviceId, long supplementId, LocalDate date, String time) {
        var reminder = ownedReminder(principal, deviceId, supplementId, time);
        return view(reminder, date);
    }

    @Transactional
    public DoseView action(SessionPrincipal principal, String deviceId, long supplementId, LocalDate date, String time, String action) {
        store.lockUser(principal.userId());
        var reminder = ownedReminder(principal, deviceId, supplementId, time);
        var now = clock.instant();
        var current = view(reminder, date);
        if (!current.active()) throw new ResponseStatusException(HttpStatus.CONFLICT, "지난 알림이에요. 오늘의 복용에서 현재 일정을 확인해 주세요.");
        if ("SNOOZE".equals(action)) {
            if (!current.canSnooze()) throw new ResponseStatusException(HttpStatus.CONFLICT, "이 일정은 더 이상 미룰 수 없어요. 복용 기록을 확인해 주세요.");
            var settings = followUps.settings(deviceId);
            var next = now.plus(Duration.ofMinutes(15));
            if (settings.quietAt(next.atZone(ZoneId.of(reminder.device().zoneId())).toLocalTime())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "15분 뒤는 알림 쉬는 시간이에요. 설정에서 쉬는 시간을 확인해 주세요.");
            }
            var previous = followUps.find(reminder.id(), date);
            schedule(reminder, date, next, previous == null ? 0 : previous.sentCount(), "SNOOZE", settings);
        } else if ("TAKEN".equals(action) || "SKIPPED".equals(action)) {
            garden.prepareChange(principal.userId());
            // A repeated tap must not change a completed occurrence into a different state.
            if (current.status().isBlank()) {
                var supplement = supplements.findByIdAndUserId(supplementId, principal.userId()).orElseThrow();
                var log = logs.findBySupplementIdAndDoseDateAndDoseTime(supplementId, date, time)
                    .orElseGet(() -> new DoseLog(supplement, date, time, action, ""));
                log.update(action, log.getMemo()); logs.saveAndFlush(log);
                garden.recordChanged(principal.userId(), supplementId, date, time, action, "TAKEN".equals(action));
            }
            store.cancelFollowUps(supplementId, date, time);
        } else throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "복용 완료, 미루기 또는 건너뛰기를 선택해 주세요.");
        return view(reminder, date);
    }

    private WebPushStore.Reminder ownedReminder(SessionPrincipal principal, String deviceId, long supplementId, String time) {
        store.owned(principal, deviceId);
        var id = store.reminderId(deviceId, supplementId, time);
        var reminder = id == null ? null : store.lockReminder(id, clock.instant());
        if (reminder == null || !WebPushService.times(reminder.configuredTimes()).contains(time)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "이 복용 알림은 꺼졌거나 일정이 변경됐어요.");
        }
        return reminder;
    }

    private DoseView view(WebPushStore.Reminder reminder, LocalDate date) {
        var delivery = store.delivery(reminder.id(), date);
        var active = delivery != null && "SENT".equals(delivery.status()) && ReminderOccurrence.active(reminder, date, clock.instant());
        var status = store.doseStatus(reminder.supplementId(), date, reminder.doseTime());
        var pending = followUps.find(reminder.id(), date);
        boolean canSnooze = sender.enabled() && active && status.isBlank() && (pending == null || pending.sentCount() < 3)
            && clock.instant().plus(Duration.ofMinutes(15)).isBefore(ReminderOccurrence.end(reminder, date));
        return new DoseView(reminder.supplementId(), reminder.productName(), date, reminder.doseTime(), status, active, canSnooze,
            active && status.isBlank() && pending != null && "PENDING".equals(pending.status()) ? pending.nextAt() : null);
    }

    public static Map<String, Object> payload(WebPushStore.Reminder reminder, LocalDate date, Instant expires, int followUpNumber) {
        var time = reminder.doseTime();
        boolean followUp = followUpNumber > 0;
        return Map.of("title", reminder.productName() + (followUp ? ", 챙겨 드셨나요? 💊" : " 챙기실 시간이에요 💊"),
            "body", followUp ? "드셨다면 PILL에서 체크해 주세요." : "드신 뒤 PILL에서 체크해 주세요.",
            // A new logical alert needs a new tag: replacing the initial notification can
            // be silent, and renotify is not supported consistently across browsers.
            // A transport retry reuses this sequence, preserving notification deduplication.
            "tag", "pill-dose-" + reminder.id() + "-" + date + (followUp ? "-follow-" + followUpNumber : ""),
            "data", Map.of("url", "/?supplementId=" + reminder.supplementId() + "&doseDate=" + date + "&doseTime=" + time,
                "supplementId", reminder.supplementId(), "doseDate", date.toString(), "doseTime", time, "expiresAt", expires.toEpochMilli()));
    }
}
