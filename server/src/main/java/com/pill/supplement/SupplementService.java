package com.pill.supplement;

import com.pill.model.DoseLog;
import com.pill.model.DoseSchedule;
import com.pill.model.SupplementScan;
import com.pill.model.UserSupplement;
import com.pill.model.UserSupplementIngredient;
import com.pill.repository.DoseLogRepository;
import com.pill.repository.DoseScheduleRepository;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.SupplementWarningRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import com.pill.supplement.dto.DoseLogRequest;
import com.pill.supplement.dto.DoseHistoryResponse;
import com.pill.supplement.dto.ExportDataResponse;
import com.pill.supplement.dto.HomeResponse;
import com.pill.supplement.dto.ManualSupplementRequest;
import com.pill.supplement.dto.SupplementDetailResponse;
import com.pill.supplement.dto.UpdateDoseTimesRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class SupplementService {
    private final UserSupplementRepository supplements;
    private final UserRepository users;
    private final SupplementScanRepository scans;
    private final DoseLogRepository doseLogs;
    private final DoseScheduleRepository doseSchedules;
    private final SupplementWarningRepository supplementWarnings;
    private final Clock clock;

    public SupplementService(
        UserSupplementRepository supplements,
        UserRepository users,
        SupplementScanRepository scans,
        DoseLogRepository doseLogs,
        DoseScheduleRepository doseSchedules,
        SupplementWarningRepository supplementWarnings,
        Clock clock
    ) {
        this.supplements = supplements;
        this.users = users;
        this.scans = scans;
        this.doseLogs = doseLogs;
        this.doseSchedules = doseSchedules;
        this.supplementWarnings = supplementWarnings;
        this.clock = clock;
    }

    public static boolean isValidDoseStatus(String status) {
        return "TAKEN".equals(status) || "SKIPPED".equals(status);
    }

    @Transactional(readOnly = true)
    public HomeResponse home(Long userId) {
        var userSupplements = supplements.findTop20ByUserIdOrderByCreatedAtDesc(userId);
        var summaries = userSupplements.stream()
            .map(this::toSummary)
            .toList();
        var today = LocalDate.now(clock);
        var todayDoses = userSupplements.stream()
            .flatMap(supplement -> {
                var logs = doseLogs.findBySupplementIdAndDoseDate(supplement.getId(), today);
                return doseTimesFor(supplement).stream()
                    .map(doseTime -> new HomeResponse.TodayDose(
                        supplement.getId(),
                        supplement.getProductName(),
                        displayNameKo(supplement),
                        supplement.getImageUri(),
                        doseTime,
                        statusFor(logs, doseTime)
                    ));
            })
            .toList();
        return new HomeResponse(summaries, todayDoses);
    }

    @Transactional(readOnly = true)
    public List<HomeResponse.SupplementSummary> list(Long userId) {
        return supplements.findTop20ByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(this::toSummary)
            .toList();
    }

    @Transactional(readOnly = true)
    public DoseHistoryResponse doseHistory(Long userId, int days) {
        if (days < 7 || days > 90) {
            throw new IllegalArgumentException("history range must be between 7 and 90 days");
        }
        var now = LocalDateTime.now(clock);
        var to = now.toLocalDate();
        var from = to.minusDays(days - 1L);
        var logs = doseLogs.findHistoryByUserIdAndDoseDateBetween(userId, from, to);
        Map<String, DoseLog> logsByOccurrence = new HashMap<>();
        for (var log : logs) {
            logsByOccurrence.put(historyKey(log.getSupplement().getId(), log.getDoseDate(), log.getDoseTime()), log);
        }

        var entries = new ArrayList<DoseHistoryResponse.Entry>();
        for (var supplement : supplements.findByUserIdOrderByCreatedAtDesc(userId)) {
            var createdAt = supplement.getCreatedAt();
            var firstDate = createdAt.toLocalDate().isAfter(from) ? createdAt.toLocalDate() : from;
            for (var date = firstDate; !date.isAfter(to); date = date.plusDays(1)) {
                for (var doseTime : doseTimesFor(supplement)) {
                    var key = historyKey(supplement.getId(), date, doseTime);
                    var log = logsByOccurrence.remove(key);
                    if (log != null) {
                        entries.add(toHistoryEntry(log));
                    } else if (isDueOccurrence(createdAt, date, doseTime, now)) {
                        entries.add(new DoseHistoryResponse.Entry(
                            supplement.getId(),
                            supplement.getProductName(),
                            displayNameKo(supplement),
                            supplement.getImageUri(),
                            date,
                            doseTime,
                            "MISSED",
                            "",
                            null
                        ));
                    }
                }
            }
        }
        logsByOccurrence.values().stream()
            .map(this::toHistoryEntry)
            .forEach(entries::add);
        entries.sort(Comparator
            .comparing(DoseHistoryResponse.Entry::doseDate, Comparator.reverseOrder())
            .thenComparing(DoseHistoryResponse.Entry::doseTime, Comparator.nullsLast(Comparator.naturalOrder())));

        var taken = entries.stream().filter(entry -> "TAKEN".equals(entry.status())).count();
        var skipped = entries.stream().filter(entry -> "SKIPPED".equals(entry.status())).count();
        var missed = entries.stream().filter(entry -> "MISSED".equals(entry.status())).count();
        var total = taken + skipped + missed;
        var completionRate = total == 0 ? 0 : (int) Math.round(taken * 100.0 / total);
        return new DoseHistoryResponse(
            from,
            to,
            new DoseHistoryResponse.Summary(total, taken, skipped, missed, completionRate),
            entries
        );
    }

    @Transactional(readOnly = true)
    public ExportDataResponse exportData(Long userId, int days) {
        var user = users.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("user not found"));
        var history = doseHistory(userId, days);
        var exportSupplements = supplements.findByUserIdOrderByCreatedAtDesc(userId).stream()
            .map(supplement -> new ExportDataResponse.Supplement(
                supplement.getId(),
                text(supplement.getBrandName()),
                text(supplement.getProductName()),
                displayNameKo(supplement),
                text(supplement.getSuggestedUseKo()),
                doseTimesFor(supplement),
                text(supplement.getWarningSummary()),
                supplement.getCreatedAt(),
                supplement.getIngredients().stream()
                    .map(ingredient -> new ExportDataResponse.Ingredient(
                        text(ingredient.getName()),
                        text(ingredient.getAmount()),
                        text(ingredient.getUnit()),
                        ingredient.isNeedsReview()
                    ))
                    .toList(),
                text(supplement.getServingBasisKo())
            ))
            .toList();

        return new ExportDataResponse(
            user.getEmail(),
            LocalDateTime.now(clock),
            exportSupplements,
            history
        );
    }

    @Transactional(readOnly = true)
    public SupplementDetailResponse detail(Long userId, Long supplementId) {
        var supplement = findUserSupplement(userId, supplementId);
        var logs = doseLogs.findTop30BySupplementIdOrderByDoseDateDesc(supplement.getId()).stream()
            .map(log -> new SupplementDetailResponse.DoseLogEntry(
                log.getDoseDate(),
                log.getDoseTime(),
                log.getStatus(),
                log.getMemo(),
                log.getCheckedAt()
            ))
            .toList();

        return new SupplementDetailResponse(
            supplement.getId(),
            supplement.getBrandName(),
            supplement.getProductName(),
            displayNameKo(supplement),
            supplement.getImageUri(),
            supplement.getSuggestedUseKo(),
            supplement.getSuggestedUseOriginal(),
            supplement.getSummaryKo(),
            supplement.getOriginalLabelText(),
            supplement.getWarningSummary(),
            supplement.getConfirmedDoseTime(),
            supplement.getIngredients().stream().map(this::toIngredient).toList(),
            logs,
            text(supplement.getServingBasisKo()),
            ProductInformation.fromStored(supplement.getScan().getNormalizedAiResultJson())
        );
    }

    @Transactional
    public void logDose(Long userId, Long supplementId, DoseLogRequest request) {
        if (request == null || !isValidDoseStatus(request.status())) {
            throw new IllegalArgumentException("invalid dose status");
        }

        var supplement = findUserSupplement(userId, supplementId);
        var today = LocalDate.now(clock);
        var doseTime = normalizeDoseTime(request.doseTime(), supplement);
        var doseLog = doseLogs.findBySupplementIdAndDoseDateAndDoseTime(supplement.getId(), today, doseTime)
            .orElseGet(() -> new DoseLog(supplement, today, doseTime, request.status(), request.memo()));
        doseLog.update(request.status(), request.memo());
        doseLogs.save(doseLog);
    }

    @Transactional
    public void clearDoseLog(Long userId, Long supplementId, String requestedDoseTime) {
        var supplement = findUserSupplement(userId, supplementId);
        var today = LocalDate.now(clock);
        var doseTime = normalizeDoseTime(requestedDoseTime, supplement);
        doseLogs.findBySupplementIdAndDoseDateAndDoseTime(supplement.getId(), today, doseTime)
            .ifPresent(doseLogs::delete);
    }

    @Transactional
    public Long createManualSupplement(Long userId, ManualSupplementRequest request) {
        if (request == null || text(request.productName()).isBlank()) {
            throw new IllegalArgumentException("product name is required");
        }
        var times = normalizeRequestedDoseTimes(new UpdateDoseTimesRequest(request.doseTimes()));
        var user = users.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("user not found"));
        var scan = scans.save(new SupplementScan(user, "{\"source\":\"manual\"}", "MANUAL"));
        var productName = text(request.productName()).trim();
        var brandName = text(request.brandName()).trim();
        var suggestedUseKo = text(request.suggestedUseKo()).trim();
        var imageUri = text(request.imageUri()).trim();
        var summaryKo = String.join(" ", List.of(brandName, productName).stream()
            .filter(value -> !value.isBlank())
            .toList());
        var supplement = supplements.save(new UserSupplement(
            user,
            scan,
            brandName,
            productName,
            SupplementDisplayName.choose(productName, List.of(suggestedUseKo)),
            imageUri,
            suggestedUseKo,
            "",
            summaryKo,
            "",
            "",
            String.join(",", times)
        ));
        for (var time : times) {
            doseSchedules.save(new DoseSchedule(supplement, time, time));
        }
        return supplement.getId();
    }

    @Transactional
    public void updateDoseTimes(Long userId, Long supplementId, UpdateDoseTimesRequest request) {
        var times = normalizeRequestedDoseTimes(request);
        var supplement = findUserSupplement(userId, supplementId);
        supplement.updateConfirmedDoseTime(String.join(",", times));
        doseSchedules.deleteBySupplementId(supplement.getId());
        for (var time : times) {
            doseSchedules.save(new DoseSchedule(supplement, time, time));
        }
    }

    @Transactional
    public void deleteSupplement(Long userId, Long supplementId) {
        var supplement = findUserSupplement(userId, supplementId);
        var scan = supplement.getScan();
        supplementWarnings.deleteBySupplementId(supplement.getId());
        doseSchedules.deleteBySupplementId(supplement.getId());
        doseLogs.deleteBySupplementId(supplement.getId());
        supplements.delete(supplement);
        supplements.flush();
        if (!supplements.existsByScanId(scan.getId())) {
            scans.delete(scan);
        }
    }

    private UserSupplement findUserSupplement(Long userId, Long supplementId) {
        return supplements.findByIdAndUserId(supplementId, userId)
            .orElseThrow(() -> new IllegalArgumentException("supplement not found"));
    }

    private HomeResponse.SupplementSummary toSummary(UserSupplement supplement) {
        return new HomeResponse.SupplementSummary(
            supplement.getId(),
            supplement.getBrandName(),
            supplement.getProductName(),
            displayNameKo(supplement),
            supplement.getImageUri(),
            supplement.getWarningSummary()
        );
    }

    private String displayNameKo(UserSupplement supplement) {
        if (supplement.getDisplayNameKo() != null && !supplement.getDisplayNameKo().isBlank()) {
            return supplement.getDisplayNameKo();
        }
        var context = supplement.getIngredients().stream()
            .flatMap(ingredient -> List.of(ingredient.getName(), ingredient.getOriginalText()).stream())
            .toList();
        return SupplementDisplayName.choose(supplement.getProductName(), context);
    }

    private List<String> doseTimesFor(UserSupplement supplement) {
        var scheduledTimes = doseSchedules.findBySupplementIdOrderByConfirmedTimeAsc(supplement.getId()).stream()
            .map(schedule -> text(schedule.getConfirmedTime()))
            .filter(time -> !time.isBlank())
            .distinct()
            .toList();
        if (!scheduledTimes.isEmpty()) {
            return scheduledTimes;
        }

        var times = new ArrayList<String>();
        for (var time : text(supplement.getConfirmedDoseTime()).split(",")) {
            var normalized = time.trim();
            if (!normalized.isBlank() && !times.contains(normalized)) {
                times.add(normalized);
            }
        }
        if (times.isEmpty()) {
            times.add("09:00");
        }
        return times;
    }

    private String normalizeDoseTime(String requestedTime, UserSupplement supplement) {
        var configuredTimes = doseTimesFor(supplement);
        var time = text(requestedTime).trim();
        if (time.isBlank()) {
            return configuredTimes.getFirst();
        }
        if (!configuredTimes.contains(time)) {
            throw new IllegalArgumentException("invalid dose time");
        }
        return time;
    }

    private List<String> normalizeRequestedDoseTimes(UpdateDoseTimesRequest request) {
        if (request == null || request.doseTimes() == null) {
            throw new IllegalArgumentException("dose times are required");
        }

        var times = new ArrayList<String>();
        for (var rawTime : request.doseTimes()) {
            var time = text(rawTime).trim();
            if (time.isBlank() || !time.matches("^([01]\\d|2[0-3]):[0-5]\\d$")) {
                throw new IllegalArgumentException("invalid dose time");
            }
            if (times.contains(time)) {
                throw new IllegalArgumentException("duplicate dose time");
            }
            times.add(time);
        }
        if (times.isEmpty() || times.size() > 3) {
            throw new IllegalArgumentException("dose times must contain 1 to 3 times");
        }
        return times;
    }

    private String statusFor(List<DoseLog> logs, String doseTime) {
        return logs.stream()
            .filter(log -> doseTime.equals(text(log.getDoseTime())))
            .findFirst()
            .map(DoseLog::getStatus)
            .orElse(null);
    }

    private DoseHistoryResponse.Entry toHistoryEntry(DoseLog log) {
        var supplement = log.getSupplement();
        return new DoseHistoryResponse.Entry(
            supplement.getId(),
            supplement.getProductName(),
            displayNameKo(supplement),
            supplement.getImageUri(),
            log.getDoseDate(),
            log.getDoseTime(),
            log.getStatus(),
            log.getMemo(),
            log.getCheckedAt()
        );
    }

    private boolean isDueOccurrence(
        LocalDateTime supplementCreatedAt,
        LocalDate doseDate,
        String doseTime,
        LocalDateTime now
    ) {
        var scheduledAt = LocalDateTime.of(doseDate, LocalTime.parse(doseTime));
        return !scheduledAt.isBefore(supplementCreatedAt) && !scheduledAt.isAfter(now);
    }

    private String historyKey(Long supplementId, LocalDate doseDate, String doseTime) {
        return supplementId + "|" + doseDate + "|" + text(doseTime);
    }

    private String text(String value) {
        return value == null ? "" : value;
    }

    private SupplementDetailResponse.Ingredient toIngredient(UserSupplementIngredient ingredient) {
        return new SupplementDetailResponse.Ingredient(
            ingredient.getName(),
            ingredient.getAmount(),
            ingredient.getUnit(),
            ingredient.getOriginalText(),
            ingredient.getConfidence(),
            ingredient.isNeedsReview()
        );
    }
}
