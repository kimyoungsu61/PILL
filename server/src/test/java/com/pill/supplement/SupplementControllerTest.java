package com.pill.supplement;

import com.pill.auth.AuthSessionService;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:supplement-controller-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class SupplementControllerTest {
    @Autowired MockMvc mvc;
    @Autowired AuthSessionService sessions;
    @Autowired UserRepository users;
    @Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository userSupplements;

    @Test
    void homeUsesBearerTokenUserAndDoesNotReturnOtherUsersSupplements() throws Exception {
        var user = users.save(new User("api@example.com", "hash"));
        var other = users.save(new User("other-api@example.com", "hash"));
        saveSupplement(user, "Morning Vitamin");
        saveSupplement(other, "Hidden Vitamin");

        mvc.perform(get("/api/home").header("Authorization", "Bearer " + tokenFor(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.supplements", hasSize(1)))
            .andExpect(jsonPath("$.supplements[0].productName").value("Morning Vitamin"));
    }

    @Test
    void productGuideRequiresLoginAndDoesNotExposeOtherUsersProducts() throws Exception {
        mvc.perform(post("/api/supplements/1/guide")).andExpect(status().isUnauthorized());
        var owner = users.save(new User("guide-owner@example.com", "hash"));
        var other = users.save(new User("guide-other@example.com", "hash"));
        var supplement = saveSupplement(owner, "Magnesium");
        mvc.perform(post("/api/supplements/" + supplement.getId() + "/guide")
            .header("Authorization", "Bearer " + tokenFor(other)))
            .andExpect(status().isNotFound());
    }

    @Test
    void supplementEndpointsRejectMissingBearerToken() throws Exception {
        mvc.perform(get("/api/home"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void logDoseUsesBearerTokenUserScope() throws Exception {
        var user = users.save(new User("dose-api@example.com", "hash"));
        var supplement = saveSupplement(user, "Morning Vitamin");

        mvc.perform(post("/api/supplements/" + supplement.getId() + "/dose-logs")
                .header("Authorization", "Bearer " + tokenFor(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"TAKEN\",\"memo\":\"after breakfast\"}"))
            .andExpect(status().isOk());

        mvc.perform(get("/api/home").header("Authorization", "Bearer " + tokenFor(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.todayDoses[0].status").value("TAKEN"));
    }

    @Test
    void clearDoseLogUsesBearerTokenUserScope() throws Exception {
        var user = users.save(new User("clear-dose-api@example.com", "hash"));
        var supplement = saveSupplement(user, "Morning Vitamin");
        var token = tokenFor(user);

        mvc.perform(post("/api/supplements/" + supplement.getId() + "/dose-logs")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"TAKEN\"}"))
            .andExpect(status().isOk());

        mvc.perform(delete("/api/supplements/" + supplement.getId() + "/dose-logs")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());

        mvc.perform(get("/api/home").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.todayDoses[0].status").doesNotExist());
    }

    @Test
    void logDoseRejectsInvalidStatusAsBadRequest() throws Exception {
        var user = users.save(new User("invalid-dose-api@example.com", "hash"));
        var supplement = saveSupplement(user, "Morning Vitamin");

        mvc.perform(post("/api/supplements/" + supplement.getId() + "/dose-logs")
                .header("Authorization", "Bearer " + tokenFor(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void createManualSupplementUsesBearerTokenUserScope() throws Exception {
        var user = users.save(new User("manual-api@example.com", "hash"));

        var result = mvc.perform(post("/api/supplements/manual")
                .header("Authorization", "Bearer " + tokenFor(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "brandName": "Manual Labs",
                      "productName": "Manual Probiotic",
                      "suggestedUseKo": "하루 1캡슐",
                      "doseTimes": ["08:00", "20:00"]
                    }
                    """))
            .andExpect(status().isOk())
            .andReturn();

        var supplementId = result.getResponse().getContentAsString();
        mvc.perform(get("/api/supplements/" + supplementId)
                .header("Authorization", "Bearer " + tokenFor(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.productName").value("Manual Probiotic"))
            .andExpect(jsonPath("$.confirmedDoseTime").value("08:00,20:00"));
    }

    @Test
    void manualSupplementRejectsMalformedTooManyAndOverlongInputs() throws Exception {
        var user = users.save(new User("manual-validation-api@example.com", "hash"));
        var token = tokenFor(user);

        mvc.perform(post("/api/supplements/manual")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"productName\":\"Vitamin\",\"doseTimes\":[\"9:00\"]}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        mvc.perform(post("/api/supplements/manual")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"productName\":\"Vitamin\",\"doseTimes\":[\"08:00\",\"12:00\",\"16:00\",\"20:00\"]}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        mvc.perform(post("/api/supplements/manual")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"productName\":\"" + "a".repeat(256) + "\",\"doseTimes\":[\"08:00\"]}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void doseLogRejectsOverlongMemo() throws Exception {
        var user = users.save(new User("dose-memo-limit-api@example.com", "hash"));
        var supplement = saveSupplement(user, "Morning Vitamin");

        mvc.perform(post("/api/supplements/" + supplement.getId() + "/dose-logs")
                .header("Authorization", "Bearer " + tokenFor(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"TAKEN\",\"memo\":\"" + "a".repeat(1001) + "\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void detailRejectsOtherUsersSupplementAsNotFound() throws Exception {
        var owner = users.save(new User("owner-api@example.com", "hash"));
        var viewer = users.save(new User("viewer-api@example.com", "hash"));
        var supplement = saveSupplement(owner, "Hidden Vitamin");

        mvc.perform(get("/api/supplements/" + supplement.getId())
                .header("Authorization", "Bearer " + tokenFor(viewer)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void deleteSupplementUsesBearerTokenUserScope() throws Exception {
        var user = users.save(new User("delete-api@example.com", "hash"));
        var supplement = saveSupplement(user, "Morning Vitamin");

        mvc.perform(delete("/api/supplements/" + supplement.getId())
                .header("Authorization", "Bearer " + tokenFor(user)))
            .andExpect(status().isOk());

        mvc.perform(get("/api/supplements/" + supplement.getId())
                .header("Authorization", "Bearer " + tokenFor(user)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void deleteSupplementRejectsOtherUsersSupplementAsNotFound() throws Exception {
        var owner = users.save(new User("delete-owner-api@example.com", "hash"));
        var viewer = users.save(new User("delete-viewer-api@example.com", "hash"));
        var supplement = saveSupplement(owner, "Hidden Vitamin");

        mvc.perform(delete("/api/supplements/" + supplement.getId())
                .header("Authorization", "Bearer " + tokenFor(viewer)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    private UserSupplement saveSupplement(User user, String productName) {
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
            "MORNING"
        ));
    }

    private String tokenFor(User user) {
        return sessions.issue(user).token();
    }
}
