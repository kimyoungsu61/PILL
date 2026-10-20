package com.pill.notification;

import java.time.LocalTime;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public record FollowUpSettings(boolean enabled, int intervalMinutes, int maxFollowUps,
    boolean quietEnabled, String quietStart, String quietEnd) {
    public static FollowUpSettings defaults() {
        return new FollowUpSettings(false, 30, 1, false, "22:00", "08:00");
    }

    public void validate() {
        if (!Set.of(1, 5, 15, 30, 60).contains(intervalMinutes) || maxFollowUps < 1 || maxFollowUps > 3
            || !time(quietStart) || !time(quietEnd) || (quietEnabled && quietStart.equals(quietEnd))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "후속 알림 간격, 횟수와 쉬는 시간을 확인해 주세요.");
        }
    }

    public boolean quietAt(LocalTime time) {
        if (!quietEnabled) return false;
        var start = LocalTime.parse(quietStart);
        var end = LocalTime.parse(quietEnd);
        return start.isBefore(end) ? !time.isBefore(start) && time.isBefore(end)
            : !time.isBefore(start) || time.isBefore(end);
    }

    private static boolean time(String value) {
        return value != null && value.matches("(?:[01]\\d|2[0-3]):[0-5]\\d");
    }
}
