package com.pill.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pill.auth.dto.AuthRequest;
import com.pill.repository.AuthSessionRepository;
import com.pill.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:auth-controller-test;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=false",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AuthControllerTest {
    private static final AtomicInteger CLIENT_SEQUENCE = new AtomicInteger(1);

    @Autowired MockMvc mockMvc;
    @Autowired ApplicationContext applicationContext;
    @Autowired ObjectMapper objectMapper;
    @Autowired AuthSessionRepository sessions;
    @Autowired SessionTokenService sessionTokens;
    @Autowired UserRepository users;

    @Test
    void doesNotCreateFallbackPasswordUser() {
        assertThat(applicationContext.getBeansOfType(UserDetailsService.class)).isEmpty();
    }

    @Test
    void signupSessionSupportsMeAndIsRevokedByLogout() throws Exception {
        var signupResult = postJson(
                "/api/auth/signup",
                new AuthRequest("SESSION@EXAMPLE.COM", "pass1234")
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("session@example.com"))
            .andReturn();
        var token = objectMapper.readTree(signupResult.getResponse().getContentAsString()).path("token").asText();

        assertThat(token).isNotBlank();
        assertThat(users.findByEmail("session@example.com")).isPresent();
        assertThat(sessions.findAll())
            .extracting(com.pill.model.AuthSession::getTokenHash)
            .contains(sessionTokens.hash(token))
            .doesNotContain(token);

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("session@example.com"));

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void duplicateSignupReturnsConflict() throws Exception {
        var request = new AuthRequest("duplicate@example.com", "pass1234");

        postJson("/api/auth/signup", request).andExpect(status().isOk());

        postJson("/api/auth/signup", request)
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("DUPLICATE_EMAIL"));
    }

    @Test
    void wrongPasswordLoginReturnsUnauthorized() throws Exception {
        postJson("/api/auth/signup", new AuthRequest("login@example.com", "pass1234"))
            .andExpect(status().isOk());

        postJson("/api/auth/login", new AuthRequest("login@example.com", "wrongpass"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void missingEmailReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
            .content("{\"password\":\"pass1234\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void overlongEmailReturnsBadRequest() throws Exception {
        var email = "a".repeat(64)
            + "@"
            + "b".repeat(63)
            + "."
            + "c".repeat(63)
            + "."
            + "d".repeat(60)
            + ".com";

        postJson("/api/auth/signup", new AuthRequest(email, "pass1234"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void overlongPasswordReturnsBadRequest() throws Exception {
        postJson("/api/auth/signup", new AuthRequest("long-password@example.com", "a".repeat(129)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void signupIsLimitedToFiveRequestsPerClientAddress() throws Exception {
        var clientAddress = "203.0.113.11";
        for (var index = 0; index < 5; index++) {
            postJson(
                "/api/auth/signup",
                new AuthRequest("signup-limit-" + index + "@example.com", "pass1234"),
                clientAddress,
                null
            ).andExpect(status().isOk());
        }

        postJson(
            "/api/auth/signup",
            new AuthRequest("signup-limit-blocked@example.com", "pass1234"),
            clientAddress,
            null
        )
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void loginFailuresIgnoreForwardedForAndLimitByRemoteAddressAndEmail() throws Exception {
        var email = "login-limit@example.com";
        var clientAddress = "203.0.113.12";
        postJson("/api/auth/signup", new AuthRequest(email, "pass1234"))
            .andExpect(status().isOk());

        for (var index = 0; index < 5; index++) {
            postJson(
                "/api/auth/login",
                new AuthRequest(email.toUpperCase(), "wrongpass"),
                clientAddress,
                "198.51.100." + (index + 1)
            )
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }

        postJson(
            "/api/auth/login",
            new AuthRequest(email, "wrongpass"),
            clientAddress,
            "198.51.100.99"
        )
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void malformedJsonReturnsStableError() throws Exception {
        mockMvc.perform(post("/api/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void shortPasswordReturnsBadRequest() throws Exception {
        postJson("/api/auth/signup", new AuthRequest("short-password@example.com", "short"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    private org.springframework.test.web.servlet.ResultActions postJson(String path, AuthRequest request) throws Exception {
        return postJson(path, request, nextClientAddress(), null);
    }

    private org.springframework.test.web.servlet.ResultActions postJson(
        String path,
        AuthRequest request,
        String remoteAddress,
        String forwardedFor
    ) throws Exception {
        var builder = post(path)
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request))
            .with(servletRequest -> {
                servletRequest.setRemoteAddr(remoteAddress);
                return servletRequest;
            });
        if (forwardedFor != null) {
            builder.header("X-Forwarded-For", forwardedFor);
        }
        return mockMvc.perform(builder);
    }

    private static String nextClientAddress() {
        return "198.51.100." + CLIENT_SEQUENCE.getAndIncrement();
    }
}
