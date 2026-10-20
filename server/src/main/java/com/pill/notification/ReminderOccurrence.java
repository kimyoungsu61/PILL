package com.pill.notification;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;

final class ReminderOccurrence {
    private ReminderOccurrence() {}
    static Instant due(WebPushStore.Reminder reminder, LocalDate date) {
        return date.atTime(LocalTime.parse(reminder.doseTime())).atZone(ZoneId.of(reminder.device().zoneId())).toInstant();
    }
    static Instant end(WebPushStore.Reminder reminder, LocalDate date) {
        var due = due(reminder, date);
        var end = due.plus(Duration.ofHours(24));
        var zone = ZoneId.of(reminder.device().zoneId());
        for (var day : new LocalDate[]{date, date.plusDays(1)}) {
            for (var time : WebPushService.times(reminder.configuredTimes())) {
                var next = day.atTime(LocalTime.parse(time)).atZone(zone).toInstant();
                if (next.isAfter(due) && next.isBefore(end)) end = next;
            }
        }
        return end;
    }
    static boolean active(WebPushStore.Reminder reminder, LocalDate date, Instant now) {
        var due = due(reminder, date);
        return !now.isBefore(due) && now.isBefore(end(reminder, date)) && !reminder.createdAt().isAfter(due);
    }
}
