package com.pill.supplement;

import com.pill.model.BlockedIngredient;
import com.pill.model.DoseLog;
import com.pill.model.DoseSchedule;
import com.pill.model.SupplementScan;
import com.pill.model.SupplementWarning;
import com.pill.model.User;
import com.pill.model.UserSupplement;
import com.pill.model.UserSupplementIngredient;
import com.pill.repository.BlockedIngredientRepository;
import com.pill.repository.DoseLogRepository;
import com.pill.repository.DoseScheduleRepository;
import com.pill.repository.SupplementWarningRepository;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import com.pill.supplement.dto.DoseLogRequest;
import com.pill.supplement.dto.HomeResponse;
import com.pill.supplement.dto.ManualSupplementRequest;
import com.pill.supplement.dto.UpdateDoseTimesRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.test.context.TestPropertySource;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.SoftAssertions.assertSoftly;
import static org.assertj.core.api.Assertions.tuple;

@DataJpaTest
@Import({SupplementService.class, SupplementServiceTest.FixedClockConfiguration.class})
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class SupplementServiceTest {
    @Autowired SupplementService supplements;
    @Autowired Clock clock;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository userSupplements;
    @Autowired DoseLogRepository doseLogs;
    @Autowired DoseScheduleRepository doseSchedules;
    @Autowired SupplementWarningRepository supplementWarnings;
    @Autowired BlockedIngredientRepository blockedIngredients;

    @Test
    void takenAndSkippedAreAcceptedDoseStatuses() {
        assertThat(SupplementService.isValidDoseStatus("TAKEN")).isTrue();
        assertThat(SupplementService.isValidDoseStatus("SKIPPED")).isTrue();
        assertThat(SupplementService.isValidDoseStatus("DONE")).isFalse();
    }

    @Test
    void homeOnlyReturnsCurrentUsersSupplementsAndTodayDoseStatuses() {
        var user = users.save(new User("user@example.com", "hash"));
        var otherUser = users.save(new User("other@example.com", "hash"));
        var mine = saveSupplement(user, "Healthy Labs", "Morning Vitamin", "MORNING");
        saveSupplement(otherUser, "Other Labs", "Other Vitamin", "NIGHT");
        supplements.logDose(user.getId(), mine.getId(), new DoseLogRequest("TAKEN", "after breakfast"));

        var home = supplements.home(user.getId());

        assertThat(home.supplements()).singleElement()
            .satisfies(summary -> {
                assertThat(summary.id()).isEqualTo(mine.getId());
                assertThat(summary.productName()).isEqualTo("Morning Vitamin");
                assertThat(summary.displayNameKo()).isEqualTo("Morning Vitamin");
            });
        assertThat(home.todayDoses()).singleElement()
            .satisfies(dose -> {
                assertThat(dose.supplementId()).isEqualTo(mine.getId());
                assertThat(dose.displayNameKo()).isEqualTo("Morning Vitamin");
                assertThat(dose.confirmedTime()).isEqualTo("MORNING");
                assertThat(dose.status()).isEqualTo("TAKEN");
            });
    }

    @Test
    void homeUsesComputedKoreanDisplayNameWhenStoredDisplayNameIsMissing() {
        var user = users.save(new User("computed-display@example.com", "hash"));
        var supplement = saveSupplement(user, "nanowell", "HOVENIA-Rx MILK THISTLE Silymarin 80% Extract", "09:00");
        supplement.addIngredient(new UserSupplementIngredient("Milk Thistle", "500", "mg", "Silymarin 80%", 0.91, false));
        userSupplements.save(supplement);

        var home = supplements.home(user.getId());

        assertThat(home.todayDoses()).singleElement()
            .satisfies(dose -> assertThat(dose.displayNameKo()).isEqualTo("밀크씨슬"));
    }

    @Test
    void homeExpandsTodayDosesByScheduleTimeAndTracksEachTimeSeparately() {
        var user = users.save(new User("scheduled-doses@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Twice Daily Vitamin", "09:00,19:00");
        doseSchedules.save(new DoseSchedule(supplement, "09:00", "09:00"));
        doseSchedules.save(new DoseSchedule(supplement, "19:00", "19:00"));

        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("TAKEN", "after dinner", "19:00"));

        var home = supplements.home(user.getId());

        assertThat(home.todayDoses())
            .extracting(HomeResponse.TodayDose::confirmedTime, HomeResponse.TodayDose::status)
            .containsExactly(
                tuple("09:00", null),
                tuple("19:00", "TAKEN")
            );
    }

    @Test
    void homeLogAndClearUseKoreaBusinessDateAtUtcBoundary() {
        var user = users.save(new User("korea-date-boundary@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Boundary Vitamin", "09:00,19:00");
        doseSchedules.save(new DoseSchedule(supplement, "09:00", "09:00"));
        doseSchedules.save(new DoseSchedule(supplement, "19:00", "19:00"));
        var koreaBusinessDate = LocalDate.now(clock);
        doseLogs.save(new DoseLog(supplement, koreaBusinessDate, "09:00", "SKIPPED", "seeded on Korea date"));

        var homeBeforeChanges = supplements.home(user.getId());
        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("TAKEN", "logged on Korea date", "19:00"));
        supplements.clearDoseLog(user.getId(), supplement.getId(), "09:00");

        assertSoftly(softly -> {
            softly.assertThat(koreaBusinessDate).isEqualTo(LocalDate.of(2026, 7, 11));
            softly.assertThat(homeBeforeChanges.todayDoses())
                .extracting(HomeResponse.TodayDose::confirmedTime, HomeResponse.TodayDose::status)
                .containsExactly(
                    tuple("09:00", "SKIPPED"),
                    tuple("19:00", null)
                );
            softly.assertThat(doseLogs.findBySupplementIdAndDoseDateAndDoseTime(
                supplement.getId(),
                koreaBusinessDate,
                "19:00"
            )).hasValueSatisfying(log -> softly.assertThat(log.getStatus()).isEqualTo("TAKEN"));
            softly.assertThat(doseLogs.findBySupplementIdAndDoseDateAndDoseTime(
                supplement.getId(),
                koreaBusinessDate,
                "09:00"
            )).isEmpty();
        });
    }

    @Test
    void updateDoseTimesReplacesConfirmedTimesAndSchedules() {
        var user = users.save(new User("update-times@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Twice Daily Vitamin", "09:00");
        doseSchedules.save(new DoseSchedule(supplement, "09:00", "09:00"));

        supplements.updateDoseTimes(user.getId(), supplement.getId(), new UpdateDoseTimesRequest(List.of("08:00", "20:30")));

        var updated = userSupplements.findByIdAndUserId(supplement.getId(), user.getId()).orElseThrow();
        assertThat(updated.getConfirmedDoseTime()).isEqualTo("08:00,20:30");
        assertThat(doseSchedules.findBySupplementIdOrderByConfirmedTimeAsc(supplement.getId()))
            .extracting(DoseSchedule::getConfirmedTime)
            .containsExactly("08:00", "20:30");
    }

    @Test
    void createManualSupplementStoresRoutineWithoutAiScan() {
        var user = users.save(new User("manual@example.com", "hash"));

        var supplementId = supplements.createManualSupplement(user.getId(), new ManualSupplementRequest(
            "Manual Labs",
            "Manual Probiotic",
            "하루 1캡슐",
            List.of("08:00", "20:00"),
            "file:///front-label.jpg"
        ));

        var detail = supplements.detail(user.getId(), supplementId);
        assertThat(detail.brandName()).isEqualTo("Manual Labs");
        assertThat(detail.productName()).isEqualTo("Manual Probiotic");
        assertThat(detail.imageUri()).isEqualTo("file:///front-label.jpg");
        assertThat(detail.suggestedUseKo()).isEqualTo("하루 1캡슐");
        assertThat(detail.confirmedDoseTime()).isEqualTo("08:00,20:00");
        assertThat(doseSchedules.findBySupplementIdOrderByConfirmedTimeAsc(supplementId))
            .extracting(DoseSchedule::getConfirmedTime)
            .containsExactly("08:00", "20:00");
    }

    @Test
    void createManualSupplementRequiresProductName() {
        var user = users.save(new User("manual-invalid@example.com", "hash"));

        assertThatThrownBy(() -> supplements.createManualSupplement(user.getId(), new ManualSupplementRequest(
            "Manual Labs",
            " ",
            "하루 1캡슐",
            List.of("08:00"),
            null
        )))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("product name is required");
    }

    @Test
    void detailIncludesIngredientsAndRecentDoseLogsForCurrentUserOnly() {
        var user = users.save(new User("detail@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Morning Vitamin", "MORNING");
        supplement.addIngredient(new UserSupplementIngredient("Vitamin C", "500", "mg", "Vitamin C 500 mg", 0.91, false));
        userSupplements.save(supplement);
        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("SKIPPED", "forgot"));

        var detail = supplements.detail(user.getId(), supplement.getId());

        assertThat(detail.productName()).isEqualTo("Morning Vitamin");
        assertThat(detail.ingredients()).singleElement()
            .satisfies(ingredient -> {
                assertThat(ingredient.name()).isEqualTo("Vitamin C");
                assertThat(ingredient.needsReview()).isFalse();
            });
        assertThat(detail.doseLogs()).singleElement()
            .satisfies(log -> {
                assertThat(log.doseDate()).isEqualTo(LocalDate.now(clock));
                assertThat(log.doseTime()).isEqualTo("MORNING");
                assertThat(log.status()).isEqualTo("SKIPPED");
            });
    }

    @Test
    void logDoseRejectsInvalidStatusAndOtherUsersSupplement() {
        var owner = users.save(new User("owner@example.com", "hash"));
        var other = users.save(new User("viewer@example.com", "hash"));
        var supplement = saveSupplement(owner, "Healthy Labs", "Morning Vitamin", "MORNING");

        assertThatThrownBy(() -> supplements.logDose(owner.getId(), supplement.getId(), new DoseLogRequest("DONE", null)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("invalid dose status");
        assertThatThrownBy(() -> supplements.logDose(other.getId(), supplement.getId(), new DoseLogRequest("TAKEN", null)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("supplement not found");
    }

    @Test
    void logDoseUpdatesExistingTodayLogInsteadOfCreatingDuplicate() {
        var user = users.save(new User("upsert@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Morning Vitamin", "MORNING");

        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("TAKEN", "first"));
        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("SKIPPED", "changed"));

        assertThat(doseLogs.findTop30BySupplementIdOrderByDoseDateDesc(supplement.getId())).singleElement()
            .satisfies(log -> {
                assertThat(log.getStatus()).isEqualTo("SKIPPED");
                assertThat(log.getMemo()).isEqualTo("changed");
            });
    }

    @Test
    void clearDoseLogRemovesOnlyRequestedTodayDoseTime() {
        var user = users.save(new User("clear-dose@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Twice Daily Vitamin", "09:00,19:00");
        doseSchedules.save(new DoseSchedule(supplement, "09:00", "09:00"));
        doseSchedules.save(new DoseSchedule(supplement, "19:00", "19:00"));
        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("TAKEN", "morning", "09:00"));
        supplements.logDose(user.getId(), supplement.getId(), new DoseLogRequest("SKIPPED", "evening", "19:00"));

        supplements.clearDoseLog(user.getId(), supplement.getId(), "09:00");

        assertThat(supplements.home(user.getId()).todayDoses())
            .extracting(HomeResponse.TodayDose::confirmedTime, HomeResponse.TodayDose::status)
            .containsExactly(
                tuple("09:00", null),
                tuple("19:00", "SKIPPED")
            );
    }

    @Test
    void doseLogsRejectTimesThatAreNotConfiguredForTheSupplement() {
        var user = users.save(new User("unconfigured-dose@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Twice Daily Vitamin", "09:00,19:00");
        doseSchedules.save(new DoseSchedule(supplement, "09:00", "09:00"));
        doseSchedules.save(new DoseSchedule(supplement, "19:00", "19:00"));

        assertThatThrownBy(() -> supplements.logDose(
            user.getId(),
            supplement.getId(),
            new DoseLogRequest("TAKEN", "unexpected", "12:00")
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("invalid dose time");
        assertThatThrownBy(() -> supplements.clearDoseLog(user.getId(), supplement.getId(), "12:00"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("invalid dose time");
    }

    @Test
    void updateDoseTimesRejectsDuplicateTimes() {
        var user = users.save(new User("duplicate-dose-time@example.com", "hash"));
        var supplement = saveSupplement(user, "Healthy Labs", "Morning Vitamin", "09:00");

        assertThatThrownBy(() -> supplements.updateDoseTimes(
            user.getId(),
            supplement.getId(),
            new UpdateDoseTimesRequest(List.of("09:00", "09:00"))
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("duplicate dose time");
    }

    @Test
    void deleteSupplementRemovesOnlyOwnedSupplementAndDoseLogs() {
        var owner = users.save(new User("delete-owner@example.com", "hash"));
        var other = users.save(new User("delete-other@example.com", "hash"));
        var mine = saveSupplement(owner, "Healthy Labs", "Morning Vitamin", "MORNING");
        var theirs = saveSupplement(other, "Other Labs", "Hidden Vitamin", "NIGHT");
        var mineScanId = mine.getScan().getId();
        var theirScanId = theirs.getScan().getId();
        var blockedIngredient = blockedIngredients.save(new BlockedIngredient("Vitamin K", "[\"K\"]", "주의", "test"));
        supplements.logDose(owner.getId(), mine.getId(), new DoseLogRequest("TAKEN", "done"));
        doseSchedules.save(new DoseSchedule(mine, "MORNING", "MORNING"));
        supplementWarnings.save(new SupplementWarning(mine, blockedIngredient, "Vitamin K", "주의"));

        supplements.deleteSupplement(owner.getId(), mine.getId());

        assertThat(userSupplements.findByIdAndUserId(mine.getId(), owner.getId())).isEmpty();
        assertThat(doseLogs.findTop30BySupplementIdOrderByDoseDateDesc(mine.getId())).isEmpty();
        assertThat(doseSchedules.findAll()).noneMatch(schedule -> schedule.getSupplement().getId().equals(mine.getId()));
        assertThat(supplementWarnings.findAll()).noneMatch(warning -> warning.getSupplement().getId().equals(mine.getId()));
        assertThat(scans.findById(mineScanId)).isEmpty();
        assertThat(scans.findById(theirScanId)).isPresent();
        assertThat(userSupplements.findByIdAndUserId(theirs.getId(), other.getId())).isPresent();
    }

    @Test
    void deleteSupplementKeepsScanStillUsedByAnotherSupplement() {
        var user = users.save(new User("shared-scan@example.com", "hash"));
        var scan = scans.save(new SupplementScan(user, "{}", "COMPLETED"));
        var first = userSupplements.save(new UserSupplement(
            user, scan, "Labs", "First", "", "", "", "", "", "09:00"
        ));
        userSupplements.save(new UserSupplement(
            user, scan, "Labs", "Second", "", "", "", "", "", "09:00"
        ));

        supplements.deleteSupplement(user.getId(), first.getId());

        assertThat(scans.findById(scan.getId())).isPresent();
    }

    @Test
    void deleteSupplementRejectsOtherUsersSupplement() {
        var owner = users.save(new User("delete-real-owner@example.com", "hash"));
        var other = users.save(new User("delete-viewer@example.com", "hash"));
        var supplement = saveSupplement(owner, "Healthy Labs", "Morning Vitamin", "MORNING");

        assertThatThrownBy(() -> supplements.deleteSupplement(other.getId(), supplement.getId()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("supplement not found");
        assertThat(userSupplements.findByIdAndUserId(supplement.getId(), owner.getId())).isPresent();
    }

    private UserSupplement saveSupplement(User user, String brandName, String productName, String confirmedDoseTime) {
        var scan = scans.save(new SupplementScan(user, "{}", "COMPLETED"));
        return userSupplements.save(new UserSupplement(
            user,
            scan,
            brandName,
            productName,
            "하루 1정",
            "Take one tablet daily.",
            "기본 요약",
            "Supplement Facts",
            "",
            confirmedDoseTime
        ));
    }

    @TestConfiguration
    static class FixedClockConfiguration {
        @Bean
        Clock clock() {
            return Clock.fixed(
                Instant.parse("2026-07-10T15:30:00Z"),
                ZoneId.of("Asia/Seoul")
            );
        }
    }
}
