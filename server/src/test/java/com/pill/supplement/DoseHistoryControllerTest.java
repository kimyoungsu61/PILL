package com.pill.supplement;

import com.pill.auth.AuthSessionService;
import com.pill.model.DoseLog;
import com.pill.model.SupplementScan;
import com.pill.model.User;
import com.pill.model.UserSupplement;
import com.pill.repository.DoseLogRepository;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:dose-history-controller-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class DoseHistoryControllerTest {
    @Autowired MockMvc mvc;
    @Autowired AuthSessionService sessions;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository userSupplements;
    @Autowired DoseLogRepository doseLogs;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager entityManager;

    @Test
    void historyReturnsOnlyCurrentUsersLogsAndSummary() throws Exception {
        var user = users.save(new User("history-owner@example.com", "hash"));
        var other = users.save(new User("history-other@example.com", "hash"));
        var mine = saveSupplement(user, "Morning Vitamin");
        var hidden = saveSupplement(other, "Hidden Vitamin");
        var today = LocalDate.now();

        doseLogs.save(new DoseLog(mine, today, "09:00", "TAKEN", "after breakfast"));
        doseLogs.save(new DoseLog(mine, today.minusDays(1), "09:00", "SKIPPED", ""));
        doseLogs.save(new DoseLog(hidden, today, "10:00", "TAKEN", "private"));

        mvc.perform(get("/api/dose-history")
                .param("days", "7")
                .header("Authorization", "Bearer " + sessions.issue(user).token()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.total").value(2))
            .andExpect(jsonPath("$.summary.taken").value(1))
            .andExpect(jsonPath("$.summary.skipped").value(1))
            .andExpect(jsonPath("$.summary.missed").value(0))
            .andExpect(jsonPath("$.summary.completionRate").value(50))
            .andExpect(jsonPath("$.entries", hasSize(2)))
            .andExpect(jsonPath("$.entries[0].productName").value("Morning Vitamin"));
    }

    @Test
    void historyCountsPastUnmarkedScheduleOccurrencesAsMissedButNotFutureTimes() throws Exception {
        var user = users.save(new User("history-missed@example.com", "hash"));
        var supplement = saveSupplement(user, "Twice Daily", "00:00,23:59");
        jdbc.update(
            "update user_supplement set created_at = ? where id = ?",
            LocalDateTime.now().minusDays(1).withHour(0).withMinute(0).withSecond(0).withNano(0),
            supplement.getId()
        );
        entityManager.clear();

        mvc.perform(get("/api/dose-history")
                .param("days", "7")
                .header("Authorization", "Bearer " + sessions.issue(user).token()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.total").value(3))
            .andExpect(jsonPath("$.summary.taken").value(0))
            .andExpect(jsonPath("$.summary.skipped").value(0))
            .andExpect(jsonPath("$.summary.missed").value(3))
            .andExpect(jsonPath("$.summary.completionRate").value(0))
            .andExpect(jsonPath("$.entries", hasSize(3)))
            .andExpect(jsonPath("$.entries[0].status").value("MISSED"));
    }

    @Test
    void historyValidatesRangeAndRequiresAuthentication() throws Exception {
        var user = users.save(new User("history-range@example.com", "hash"));
        var token = sessions.issue(user).token();

        mvc.perform(get("/api/dose-history").param("days", "1")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());

        mvc.perform(get("/api/dose-history"))
            .andExpect(status().isUnauthorized());
    }

    private UserSupplement saveSupplement(User user, String productName) {
        return saveSupplement(user, productName, "09:00");
    }

    private UserSupplement saveSupplement(User user, String productName, String doseTimes) {
        var scan = scans.save(new SupplementScan(user, "{}", "COMPLETED"));
        return userSupplements.save(new UserSupplement(
            user,
            scan,
            "Healthy Labs",
            productName,
            "하루 1정",
            "Take one tablet daily.",
            "기본 요약",
            "Supplement Facts",
            "",
            doseTimes
        ));
    }
}
