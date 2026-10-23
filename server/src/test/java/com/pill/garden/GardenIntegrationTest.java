package com.pill.garden;

import com.pill.auth.AuthSessionService;
import com.pill.model.DoseLog;
import com.pill.model.GardenDay;
import com.pill.model.SupplementScan;
import com.pill.model.User;
import com.pill.model.UserSupplement;
import com.pill.repository.*;
import com.pill.supplement.SupplementService;
import com.pill.supplement.dto.DoseLogRequest;
import com.pill.supplement.dto.ManualSupplementRequest;
import com.pill.supplement.dto.UpdateDoseTimesRequest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:garden-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "pill.web-push.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
@Sql("/db/web_push.sql")
@Transactional
class GardenIntegrationTest {
    @Autowired GardenService garden;
    @Autowired SupplementService service;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository products;
    @Autowired DoseLogRepository logs;
    @Autowired GardenDayRepository days;
    @Autowired AuthSessionService sessions;
    @Autowired MockMvc mvc;
    @MockitoBean Clock clock;
    User user;
    static final LocalDate TODAY = LocalDate.of(2026, 10, 20);

    @BeforeEach void prepare() {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-20T08:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
        user = users.save(new User(UUID.randomUUID() + "@example.test", "hash"));
    }

    @Test void emptyAndUnconfiguredDaysDoNotEarnStamps() {
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
        var product = product("");
        logs.saveAndFlush(new DoseLog(product, TODAY, "09:00", "TAKEN", "legacy fallback"));
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
        assertThat(days.findByUserIdAndStampDate(user.getId(), TODAY)).isPresent();
    }

    @Test void allScheduledOccurrencesMustBeRecordedAndDuplicateTapsEarnOnlyOnce() {
        var first = product("09:00,19:00");
        var second = product("21:00");
        taken(first, "09:00");
        service.logDose(user.getId(), first.getId(), new DoseLogRequest("UNKNOWN", "", "19:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
        service.logDose(user.getId(), second.getId(), new DoseLogRequest("SKIPPED", "", "21:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
        taken(second, "21:00");
        taken(second, "21:00");
        var result = garden.state(user.getId());
        assertThat(result.totalStamps()).isEqualTo(1);
        assertThat(result.todayEarned()).isTrue();
        assertThat(result.stampDates()).containsExactly(TODAY);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"SKIPPED", "UNKNOWN"})
    void everyExplicitAnswerEarnsTheSameDailyStamp(String status) {
        var product = product("09:00,19:00");
        service.logDose(user.getId(), product.getId(), new DoseLogRequest(status, "", "09:00"));
        assertThat(garden.state(user.getId()).todayEarned()).isFalse();
        service.logDose(user.getId(), product.getId(), new DoseLogRequest(status, "", "19:00"));
        var result = garden.state(user.getId());
        assertThat(result.totalStamps()).isEqualTo(1);
        assertThat(result.todayEarned()).isTrue();
        assertThat(service.doseHistory(user.getId(), 7).summary().taken()).isZero();
        assertThat(service.doseHistory(user.getId(), 7).summary().completionRate()).isZero();
    }

    @Test void legacyUnawardedDayCanEarnOnCorrectionButNotOnDuplicateInput() {
        var product = product("09:00");
        assertThat(garden.state(user.getId()).todayEarned()).isFalse();
        logs.saveAndFlush(new DoseLog(product, TODAY, "09:00", "SKIPPED", "existing record before upgrade"));
        service.logDose(user.getId(), product.getId(), new DoseLogRequest("SKIPPED", "updated memo", "09:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
        service.logDose(user.getId(), product.getId(), new DoseLogRequest("UNKNOWN", "", "09:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
    }

    @Test void moreThanTwentyProductsRemainVisibleAndPartOfTheSameDailyGoal() {
        var pending = product("21:00");
        for (int index = 0; index < 20; index++) {
            var done = product("09:00");
            logs.saveAndFlush(new DoseLog(done, TODAY, "09:00", "TAKEN", ""));
        }
        assertThat(service.home(user.getId()).todayDoses()).hasSize(21);
        assertThat(service.list(user.getId())).hasSize(21);
        assertThat(garden.state(user.getId()).todayEarned()).isFalse();
        taken(pending, "21:00");
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
    }

    @Test void correctionsAndClearingKeepTodaysRewardWithoutCreatingAnother() {
        var product = product("09:00");
        previousStamp(TODAY.minusDays(3));
        taken(product, "09:00");
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(2);
        service.clearDoseLog(user.getId(), product.getId(), "09:00");
        var undone = garden.state(user.getId());
        assertThat(undone.totalStamps()).isEqualTo(2);
        assertThat(undone.todayEarned()).isTrue();
        assertThat(undone.stampDates()).containsExactly(TODAY.minusDays(3), TODAY);
        taken(product, "09:00");
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(2);
        service.logDose(user.getId(), product.getId(), new DoseLogRequest("SKIPPED", "", "09:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(2);
        service.logDose(user.getId(), product.getId(), new DoseLogRequest("UNKNOWN", "", "09:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(2);
        assertThat(service.home(user.getId()).todayDoses()).allMatch(dose -> "UNKNOWN".equals(dose.status()));
    }

    @Test void firstObservationRecognizesExistingTodayButNeverBackfillsHistory() {
        var product = product("09:00");
        logs.saveAndFlush(new DoseLog(product, TODAY.minusDays(1), "09:00", "TAKEN", ""));
        logs.saveAndFlush(new DoseLog(product, TODAY, "09:00", "TAKEN", ""));
        assertThat(garden.state(user.getId()).stampDates()).containsExactly(TODAY);
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
    }

    @Test void deletingPendingProductCannotTurnPartialDayIntoAward() {
        var done = product("09:00");
        var pending = product("21:00");
        // Existing records before the garden is first opened.
        logs.saveAndFlush(new DoseLog(done, TODAY, "09:00", "TAKEN", ""));
        service.deleteSupplement(user.getId(), pending.getId());
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
        taken(done, "09:00");
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
    }

    @Test void removingPendingTimeCannotManufactureStampButNewRecordCanEarn() {
        var product = product("09:00,19:00");
        logs.saveAndFlush(new DoseLog(product, TODAY, "09:00", "TAKEN", ""));
        service.updateDoseTimes(user.getId(), product.getId(), new UpdateDoseTimesRequest(List.of("09:00")));
        assertThat(garden.state(user.getId()).totalStamps()).isZero();
        service.clearDoseLog(user.getId(), product.getId(), "09:00");
        service.logDose(user.getId(), product.getId(), new DoseLogRequest("UNKNOWN", "", "09:00"));
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
    }

    @Test void earnedDaysSurviveScheduleChangesAndProductDeletion() {
        var product = product("09:00");
        taken(product, "09:00");
        service.updateDoseTimes(user.getId(), product.getId(), new UpdateDoseTimesRequest(List.of("09:00", "21:00")));
        assertThat(garden.state(user.getId()).todayEarned()).isTrue();
        service.clearDoseLog(user.getId(), product.getId(), "21:00");
        assertThat(garden.state(user.getId()).todayEarned()).isTrue();
        service.deleteSupplement(user.getId(), product.getId());
        assertThat(garden.state(user.getId()).stampDates()).containsExactly(TODAY);
    }

    @Test void gapsPreserveStampsAndSevenUnlocksPlantAndStyle() {
        for (int index = 1; index <= 6; index++) previousStamp(TODAY.minusDays(index * 2L));
        var product = product("09:00");
        assertThat(garden.state(user.getId()).cycleStamps()).isEqualTo(6);
        assertThatThrownBy(() -> garden.selectStyle(user.getId(), "cloud", "flower"))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        taken(product, "09:00");
        var result = garden.selectStyle(user.getId(), "cloud", "flower");
        assertThat(result.totalStamps()).isEqualTo(7);
        assertThat(result.completedPlants()).isEqualTo(1);
        assertThat(result.cycleStamps()).isZero();
        assertThat(result.selectedPot()).isEqualTo("cloud");
        assertThat(result.selectedStamp()).isEqualTo("flower");
        service.clearDoseLog(user.getId(), product.getId(), "09:00");
        var undone = garden.state(user.getId());
        assertThat(undone.completedPlants()).isEqualTo(1);
        assertThat(undone.selectedPot()).isEqualTo("cloud");
        assertThat(undone.selectedStamp()).isEqualTo("flower");
        assertThat(garden.selectStyle(user.getId(), "cloud", "flower").totalStamps()).isEqualTo(7);
    }

    @Test void laterDayDoesNotRecomputeOrErasePreviousEarnedDay() {
        var product = product("09:00");
        taken(product, "09:00");
        when(clock.instant()).thenReturn(Instant.parse("2026-10-22T08:00:00Z"));
        var later = garden.state(user.getId());
        assertThat(later.todayEarned()).isFalse();
        assertThat(later.totalStamps()).isEqualTo(1);
        garden.recordChanged(user.getId(), TODAY, "SKIPPED", false);
        assertThat(garden.state(user.getId()).stampDates()).containsExactly(TODAY);
    }

    @Test void laterCollectionsUnlockOnlyTheirEarnedStyles() {
        for (int index = 1; index <= 14; index++) previousStamp(TODAY.minusDays(index));
        var second = garden.selectStyle(user.getId(), "sage", "sun");
        assertThat(second.completedPlants()).isEqualTo(2);
        assertThat(second.selectedPot()).isEqualTo("sage");
        assertThat(second.selectedStamp()).isEqualTo("sun");
        assertThatThrownBy(() -> garden.selectStyle(user.getId(), "ink", "star"))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        for (int index = 15; index <= 21; index++) previousStamp(TODAY.minusDays(index));
        var third = garden.selectStyle(user.getId(), "ink", "star");
        assertThat(third.completedPlants()).isEqualTo(3);
        assertThat(third.selectedPot()).isEqualTo("ink");
        assertThat(third.selectedStamp()).isEqualTo("star");
    }

    @Test void addingProductPreservesAlreadyEarnedStampAndDoesNotCreateAnother() {
        var product = product("09:00");
        logs.saveAndFlush(new DoseLog(product, TODAY, "09:00", "TAKEN", ""));
        service.createManualSupplement(user.getId(), new ManualSupplementRequest("Brand", "New", "", List.of("21:00"), ""));
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
    }

    @Test void endpointsRequireLoginAndIsolateStylesAndDatesByAuthenticatedUser() throws Exception {
        mvc.perform(get("/api/garden")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/garden/style").contentType("application/json").content("{\"pot\":\"clay\",\"stamp\":\"leaf\"}"))
            .andExpect(status().isUnauthorized());
        previousStamp(TODAY.minusDays(2));
        var other = users.save(new User(UUID.randomUUID() + "@example.test", "hash"));
        var token = sessions.issue(other).token();
        mvc.perform(get("/api/garden").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk()).andExpect(jsonPath("$.totalStamps").value(0));
        mvc.perform(put("/api/garden/style").header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"pot\":\"cloud\",\"stamp\":\"leaf\"}"))
            .andExpect(status().isConflict());
        mvc.perform(put("/api/garden/style").header("Authorization", "Bearer " + token).contentType("application/json")
            .content("{\"pot\":\"unknown\",\"stamp\":\"leaf\"}"))
            .andExpect(status().isBadRequest());
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
    }

    @Test @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentDevicesCannotDuplicateDoseOrStamp() throws Exception {
        var product = product("09:00");
        try (var workers = Executors.newFixedThreadPool(2)) {
            var first = workers.submit(() -> taken(product, "09:00"));
            var second = workers.submit(() -> taken(product, "09:00"));
            first.get(10, TimeUnit.SECONDS);
            second.get(10, TimeUnit.SECONDS);
        }
        assertThat(garden.state(user.getId()).totalStamps()).isEqualTo(1);
        assertThat(logs.findBySupplementIdAndDoseDate(product.getId(), TODAY)).hasSize(1);
    }

    private UserSupplement product(String times) {
        var scan = scans.save(new SupplementScan(user, "{}", "COMPLETED"));
        return products.saveAndFlush(new UserSupplement(user, scan, "PILL", "Vitamin", "", "", "", "", "", times));
    }
    private void taken(UserSupplement product, String time) {
        service.logDose(user.getId(), product.getId(), new DoseLogRequest("TAKEN", "", time));
    }
    private void previousStamp(LocalDate date) {
        var day = new GardenDay(user, date);
        day.earn(List.of("historical|09:00"));
        days.saveAndFlush(day);
    }
}
