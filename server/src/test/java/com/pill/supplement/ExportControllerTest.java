package com.pill.supplement;

import com.pill.auth.AuthSessionService;
import com.pill.gemini.GeminiClient;
import com.pill.model.DoseLog;
import com.pill.model.SupplementScan;
import com.pill.model.User;
import com.pill.model.UserSupplement;
import com.pill.model.UserSupplementIngredient;
import com.pill.repository.DoseLogRepository;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:export-controller-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ExportControllerTest {
    @Autowired MockMvc mvc;
    @Autowired AuthSessionService sessions;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository supplements;
    @Autowired DoseLogRepository doseLogs;
    @MockitoBean GeminiClient gemini;

    @Test
    void exportsOnlyAuthenticatedUsersSupplementsIngredientsAndDoseHistory() throws Exception {
        var user = users.save(new User("export-owner@example.com", "hash"));
        var other = users.save(new User("export-other@example.com", "hash"));
        var mine = saveSupplement(user, "Export Vitamin");
        saveSupplement(other, "Private Vitamin");
        doseLogs.save(new DoseLog(mine, LocalDate.now(), "09:00", "TAKEN", "after breakfast"));
        var token = sessions.issue(user).token();

        mvc.perform(get("/api/export")
                .param("days", "7")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("export-owner@example.com"))
            .andExpect(jsonPath("$.generatedAt").isString())
            .andExpect(jsonPath("$.supplements", hasSize(1)))
            .andExpect(jsonPath("$.supplements[0].productName").value("Export Vitamin"))
            .andExpect(jsonPath("$.supplements[0].doseTimes[0]").value("09:00"))
            .andExpect(jsonPath("$.supplements[0].ingredients[0].name").value("Vitamin C"))
            .andExpect(jsonPath("$.doseHistory.summary.taken").value(1))
            .andExpect(jsonPath("$.doseHistory.entries[*].productName", everyItem(is("Export Vitamin"))));
    }

    @Test
    void validatesRangeAndRequiresAuthentication() throws Exception {
        var user = users.save(new User("export-range@example.com", "hash"));
        var token = sessions.issue(user).token();

        mvc.perform(get("/api/export")
                .param("days", "91")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());

        mvc.perform(get("/api/export"))
            .andExpect(status().isUnauthorized());
    }

    private UserSupplement saveSupplement(User user, String productName) {
        var scan = scans.save(new SupplementScan(user, "{}", "COMPLETED"));
        var supplement = new UserSupplement(
            user,
            scan,
            "Healthy Labs",
            productName,
            productName,
            "file:///phone/export.jpg",
            "하루 한 번",
            "Take one tablet daily.",
            "기본 요약",
            "Supplement Facts",
            "",
            "09:00"
        );
        supplement.addIngredient(new UserSupplementIngredient(
            "Vitamin C",
            "500",
            "mg",
            "Vitamin C 500 mg",
            0.95,
            false
        ));
        return supplements.save(supplement);
    }
}
