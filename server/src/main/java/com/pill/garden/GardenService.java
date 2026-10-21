package com.pill.garden;

import com.pill.model.GardenDay;
import com.pill.model.GardenStyle;
import com.pill.model.User;
import com.pill.repository.*;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class GardenService {
    private static final Map<String, Integer> POTS = Map.of("clay", 0, "cloud", 7, "sage", 14, "ink", 21);
    private static final Map<String, Integer> STAMPS = Map.of("leaf", 0, "flower", 7, "sun", 14, "star", 21);
    private final GardenDayRepository days;
    private final GardenStyleRepository styles;
    private final UserRepository users;
    private final UserSupplementRepository supplements;
    private final DoseScheduleRepository schedules;
    private final DoseLogRepository logs;
    private final Clock clock;

    public GardenService(GardenDayRepository days, GardenStyleRepository styles, UserRepository users,
        UserSupplementRepository supplements, DoseScheduleRepository schedules, DoseLogRepository logs, Clock clock) {
        this.days = days; this.styles = styles; this.users = users;
        this.supplements = supplements; this.schedules = schedules; this.logs = logs; this.clock = clock;
    }

    public record State(int totalStamps, int cycleStamps, int completedPlants, boolean todayEarned,
        LocalDate todayDate, List<LocalDate> stampDates, String selectedPot, String selectedStamp) {}

    @Transactional
    public State state(Long userId) {
        var user = lockUser(userId);
        var today = LocalDate.now(clock);
        var day = days.findByUserIdAndStampDate(userId, today).orElseGet(() -> {
            var initial = days.save(new GardenDay(user, today));
            // Only today's first observation may bootstrap existing completed records.
            // Old dates cannot be reconstructed from today's mutable schedule.
            awardIfComplete(userId, initial);
            return initial;
        });
        return response(userId, day);
    }

    @Transactional
    public State selectStyle(Long userId, String pot, String stamp) {
        var state = state(userId);
        if (pot == null || stamp == null || !POTS.containsKey(pot) || !STAMPS.containsKey(stamp)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "사용할 화분과 스탬프를 골라주세요.");
        }
        if (POTS.get(pot) > state.totalStamps() || STAMPS.get(stamp) > state.totalStamps()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "스탬프를 더 모으면 사용할 수 있어요.");
        }
        var style = styles.findById(userId).orElseGet(() -> new GardenStyle(userId));
        style.update(pot, stamp);
        styles.save(style);
        return new State(state.totalStamps(), state.cycleStamps(), state.completedPlants(),
            state.todayEarned(), state.todayDate(), state.stampDates(), pot, stamp);
    }

    /** Acquire before any dose/schedule write, using the same user lock as push actions. */
    @Transactional
    public void prepareChange(Long userId) {
        var user = lockUser(userId);
        var today = LocalDate.now(clock);
        if (days.findByUserIdAndStampDate(userId, today).isEmpty()) {
            var initial = days.save(new GardenDay(user, today));
            awardIfComplete(userId, initial);
        }
    }

    /**
     * Called after a flushed record mutation. A real new TAKEN transition can earn;
     * duplicate taps, deletion, rescheduling and past notification actions cannot.
     */
    @Transactional
    public void recordChanged(Long userId, Long supplementId, LocalDate date, String time,
        String status, boolean newlyTaken) {
        var user = lockUser(userId);
        if (!LocalDate.now(clock).equals(date)) return;
        var day = day(user, date);
        if (!"TAKEN".equals(status)) day.undo(key(supplementId, time));
        else if (!day.isEarned() && newlyTaken) awardIfComplete(userId, day);
    }

    private GardenDay day(User user, LocalDate date) {
        return days.findByUserIdAndStampDate(user.getId(), date)
            .orElseGet(() -> days.save(new GardenDay(user, date)));
    }

    private User lockUser(Long userId) {
        return users.lockById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private void awardIfComplete(Long userId, GardenDay day) {
        var completed = new ArrayList<String>();
        for (var product : supplements.findByUserIdOrderByCreatedAtDesc(userId)) {
            var times = schedules.findBySupplementIdOrderByConfirmedTimeAsc(product.getId()).stream()
                .map(schedule -> schedule.getConfirmedTime() == null ? "" : schedule.getConfirmedTime().trim())
                .filter(time -> !time.isBlank()).distinct().toList();
            if (times.isEmpty()) {
                times = java.util.Arrays.stream((product.getConfirmedDoseTime() == null ? "" : product.getConfirmedDoseTime()).split(","))
                    .map(String::trim).filter(time -> !time.isBlank()).distinct().toList();
            }
            // Do not invent an implicit 09:00 obligation for unconfigured legacy data.
            if (times.isEmpty() || times.stream().anyMatch(time -> !time.matches("(?:[01]\\d|2[0-3]):[0-5]\\d"))) return;
            var recorded = logs.findBySupplementIdAndDoseDate(product.getId(), day.getStampDate());
            for (var time : times) {
                if (recorded.stream().noneMatch(log -> time.equals(log.getDoseTime()) && "TAKEN".equals(log.getStatus()))) return;
                completed.add(key(product.getId(), time));
            }
        }
        if (!completed.isEmpty()) day.earn(completed);
    }

    private State response(Long userId, GardenDay today) {
        var dates = days.findByUserIdAndEarnedTrueOrderByStampDateAsc(userId).stream().map(GardenDay::getStampDate).toList();
        int total = dates.size();
        var style = styles.findById(userId).orElseGet(() -> new GardenStyle(userId));
        // Undoing today's milestone also withdraws its unlock; the selection is
        // remembered and becomes available again once seven completed days return.
        var pot = POTS.getOrDefault(style.getPot(), Integer.MAX_VALUE) <= total ? style.getPot() : "clay";
        var stamp = STAMPS.getOrDefault(style.getStamp(), Integer.MAX_VALUE) <= total ? style.getStamp() : "leaf";
        return new State(total, total % 7, total / 7, today.isEarned(), today.getStampDate(), dates, pot, stamp);
    }

    private static String key(Long supplementId, String time) { return supplementId + "|" + time; }
}
