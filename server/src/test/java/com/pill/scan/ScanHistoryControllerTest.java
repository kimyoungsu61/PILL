package com.pill.scan;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pill.auth.AuthSessionService;
import com.pill.gemini.GeminiClient;
import com.pill.model.SupplementScan;
import com.pill.model.User;
import com.pill.model.UserSupplement;
import com.pill.repository.SupplementScanRepository;
import com.pill.repository.UserRepository;
import com.pill.repository.UserSupplementRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:scan-history-controller-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ScanHistoryControllerTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AuthSessionService sessions;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository supplements;
    @MockitoBean GeminiClient gemini;

    @Test
    void returnsOnlyAuthenticatedUsersRealScansWithSavedState() throws Exception {
        var user = users.save(new User("scan-history@example.com", "hash"));
        var otherUser = users.save(new User("other-scan-history@example.com", "hash"));

        var savedScan = completedScan(user, "Saved Omega 3", 0.95, "");
        var savedSupplement = supplements.save(new UserSupplement(
            user,
            savedScan,
            "Ocean Lab",
            "Saved Omega 3",
            "오메가3",
            "file:///phone/omega.jpg",
            "하루 한 번",
            "Take once daily",
            "",
            "Omega 3",
            "",
            "09:00"
        ));
        var reviewScan = completedScan(user, "Unstored Vitamin", 0.62, "Check with a professional");
        var failedScan = scans.save(new SupplementScan(user, "{}", "PROCESSING"));
        failedScan.fail("analysis failed");
        scans.save(failedScan);
        var manualScan = scans.save(new SupplementScan(user, "{\"source\":\"manual\"}", "MANUAL"));
        var otherScan = completedScan(otherUser, "Other User Product", 0.99, "");
        var token = sessions.issue(user).token();

        var result = mvc.perform(get("/api/scans")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.total").value(3))
            .andExpect(jsonPath("$.summary.saved").value(1))
            .andExpect(jsonPath("$.summary.needsReview").value(1))
            .andExpect(jsonPath("$.summary.failed").value(1))
            .andReturn();

        var root = mapper.readTree(result.getResponse().getContentAsString());
        assertThat(ids(root.path("entries")))
            .containsExactlyInAnyOrder(savedScan.getId(), reviewScan.getId(), failedScan.getId())
            .doesNotContain(manualScan.getId(), otherScan.getId());

        var savedEntry = entry(root.path("entries"), savedScan.getId());
        assertThat(savedEntry.path("saved").asBoolean()).isTrue();
        assertThat(savedEntry.path("supplementId").asLong()).isEqualTo(savedSupplement.getId());
        assertThat(savedEntry.path("displayNameKo").asText()).isEqualTo("오메가3");
        assertThat(savedEntry.path("imageUri").asText()).isEqualTo("file:///phone/omega.jpg");

        var reviewEntry = entry(root.path("entries"), reviewScan.getId());
        assertThat(reviewEntry.path("saved").asBoolean()).isFalse();
        assertThat(reviewEntry.path("reviewIngredientCount").asInt()).isEqualTo(1);
        assertThat(reviewEntry.path("hasWarnings").asBoolean()).isTrue();
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/scans"))
            .andExpect(status().isUnauthorized());
    }

    private SupplementScan completedScan(User user, String productName, double confidence, String warningsKo) {
        var scan = scans.save(new SupplementScan(user, "{}", "PROCESSING"));
        scan.complete("{}", """
            {
              "brandName": "Test Lab",
              "productName": "%s",
              "suggestedUseOriginal": "Take once daily",
              "suggestedUseKo": "하루 한 번",
              "warningsOriginal": "",
              "warningsKo": "%s",
              "originalLabelText": "Supplement Facts",
              "recommendedDoseTime": "09:00",
              "ingredients": [
                {
                  "name": "Vitamin C",
                  "amount": "500",
                  "unit": "mg",
                  "originalText": "Vitamin C 500 mg",
                  "confidence": %s,
                  "needsReview": %s
                }
              ]
            }
            """.formatted(productName, warningsKo, confidence, confidence < 0.8));
        return scans.save(scan);
    }

    private JsonNode entry(JsonNode entries, Long scanId) {
        return StreamSupport.stream(entries.spliterator(), false)
            .filter(entry -> entry.path("scanId").asLong() == scanId)
            .findFirst()
            .orElseThrow();
    }

    private java.util.List<Long> ids(JsonNode entries) {
        return StreamSupport.stream(entries.spliterator(), false)
            .map(entry -> entry.path("scanId").asLong())
            .toList();
    }
}
