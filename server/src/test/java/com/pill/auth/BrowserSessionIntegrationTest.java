package com.pill.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pill.model.AuthSession;
import com.pill.model.User;
import com.pill.repository.AuthSessionRepository;
import com.pill.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:browser-session-test;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa",
    "spring.datasource.password=", "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
@Transactional
class BrowserSessionIntegrationTest {
    private static final Instant NOW = Instant.parse("2026-10-19T00:00:00Z");
    private static final AtomicInteger CLIENT = new AtomicInteger();
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired AuthSessionRepository sessions;
    @Autowired UserRepository users;
    @Autowired SessionTokenService tokens;
    @MockitoBean Clock clock;

    @BeforeEach void time() {
        when(clock.instant()).thenReturn(NOW);
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    }

    @Test void browserReceivesOnlyMarkerAndPersistentSecureCookie() throws Exception {
        var result = signup();
        var header = result.getResponse().getHeader("Set-Cookie");
        assertThat(header).startsWith(BrowserSession.COOKIE + "=")
            .contains("Max-Age=15552000", "HttpOnly", "Secure", "SameSite=Lax", "Path=/")
            .doesNotContain("Domain=");
        assertThat(json.readTree(result.getResponse().getContentAsString()).path("token").asText())
            .isEqualTo(BrowserSession.MARKER);
        var cookie = cookie(result);
        assertThat(sessions.findAll()).singleElement().satisfies(session -> {
            assertThat(session.getTokenHash()).isEqualTo(tokens.hash(cookie.getValue()));
            assertThat(session.getExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(180)));
        });
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());
    }

    @Test void cookieSurvivesLongAbsenceButExpiresAtTheAbsoluteSixMonthLimit() throws Exception {
        var cookie = cookie(signup());
        when(clock.instant()).thenReturn(NOW.plus(Duration.ofDays(179)));
        mvc.perform(get("/api/auth/me").cookie(cookie).header(BrowserSession.CLIENT_HEADER,"web"))
            .andExpect(status().isOk()).andExpect(header().string("Set-Cookie",
                org.hamcrest.Matchers.containsString("Max-Age=86400")));
        when(clock.instant()).thenReturn(NOW.plus(Duration.ofDays(180)));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized())
            .andExpect(header().string("Set-Cookie",org.hamcrest.Matchers.containsString("Max-Age=0")));
    }

    @Test void logoutRevokesSessionAndClearsCookie() throws Exception {
        var cookie = cookie(signup());
        mvc.perform(post("/api/auth/logout").cookie(cookie).header(BrowserSession.CLIENT_HEADER,"web"))
            .andExpect(status().isNoContent())
            .andExpect(header().string("Set-Cookie",org.hamcrest.Matchers.containsString("Max-Age=0")));
        assertThat(sessions.findAll()).singleElement().satisfies(session -> assertThat(session.getRevokedAt()).isEqualTo(NOW));
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isUnauthorized());
    }

    @Test void cookieMutationsRejectForgedAndCrossOriginRequests() throws Exception {
        var cookie = cookie(signup());
        mvc.perform(post("/api/auth/logout").cookie(cookie)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").cookie(cookie).header(BrowserSession.CLIENT_HEADER,"web")
            .header("Origin","https://evil.example")).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/logout").cookie(cookie).header(BrowserSession.CLIENT_HEADER,"web")
            .header("Sec-Fetch-Site","cross-site")).andExpect(status().isForbidden());
        mvc.perform(get("/api/auth/me").cookie(cookie)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/logout").cookie(cookie).header(BrowserSession.CLIENT_HEADER,"web")
            .header("Origin","https://localhost").with(request -> {
                request.setScheme("https");request.setServerName("localhost");request.setServerPort(443);return request;
            })).andExpect(status().isNoContent());
    }

    @Test void publicPagesRemainAvailableEvenWithAnInvalidCookie() throws Exception {
        var invalid = new Cookie(BrowserSession.COOKIE,"expired-token");
        for (var path : new String[]{"/healthz","/manifest.webmanifest","/"}) {
            mvc.perform(get(path).cookie(invalid)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/auth/me").cookie(invalid)).andExpect(status().isUnauthorized());
    }

    @Test void anExpiredCookieDoesNotBlockAUserFromSigningInAgain() throws Exception {
        var email = UUID.randomUUID()+"@example.com";
        var result = signup(email);
        when(clock.instant()).thenReturn(NOW.plus(Duration.ofDays(181)));
        mvc.perform(post("/api/auth/login").cookie(cookie(result)).header(BrowserSession.CLIENT_HEADER,"web")
            .contentType("application/json").content(json.writeValueAsString(
                java.util.Map.of("email",email,"password","pass1234"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.token").value(BrowserSession.MARKER));
    }

    @Test void oldActiveBearerMigratesWithoutReplacingItsSessionOrExtendingFromToday() throws Exception {
        var user = users.save(new User(UUID.randomUUID()+"@example.com","hash"));
        var token = tokens.issue();
        var old = sessions.saveAndFlush(new AuthSession(user,tokens.hash(token),NOW,NOW.plus(Duration.ofDays(30))));
        when(clock.instant()).thenReturn(NOW.plus(Duration.ofDays(20)));
        var result = mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token)
            .header(BrowserSession.CLIENT_HEADER,"web")).andExpect(status().isOk()).andReturn();
        assertThat(cookie(result).getValue()).isEqualTo(token);
        assertThat(sessions.findAll()).singleElement().satisfies(session -> {
            assertThat(session.getId()).isEqualTo(old.getId());
            assertThat(session.getExpiresAt()).isEqualTo(NOW.plus(Duration.ofDays(180)));
        });
    }

    @Test void untrustedOriginCannotCreateABrowserLogin() throws Exception {
        mvc.perform(post("/api/auth/signup").header(BrowserSession.CLIENT_HEADER,"web")
            .header("Origin","https://evil.example").contentType("application/json")
            .content("{\"email\":\"forged@example.com\",\"password\":\"pass1234\"}"))
            .andExpect(status().isForbidden());
        assertThat(users.findAll()).isEmpty();
    }

    private MvcResult signup() throws Exception { return signup(UUID.randomUUID()+"@example.com"); }
    private MvcResult signup(String email) throws Exception {
        return mvc.perform(post("/api/auth/signup").header(BrowserSession.CLIENT_HEADER,"web")
            .with(request -> { request.setRemoteAddr("198.51.100."+CLIENT.incrementAndGet());return request; })
            .contentType("application/json").content(json.writeValueAsString(
                java.util.Map.of("email",email,"password","pass1234"))))
            .andExpect(status().isOk()).andReturn();
    }
    private Cookie cookie(MvcResult result) {
        var header = result.getResponse().getHeader("Set-Cookie");
        assertThat(header).isNotNull();
        return new Cookie(BrowserSession.COOKIE,header.substring(header.indexOf('=')+1,header.indexOf(';')));
    }
}
