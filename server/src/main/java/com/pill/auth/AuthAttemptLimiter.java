package com.pill.auth;

import com.pill.common.InMemoryRateLimiter;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class AuthAttemptLimiter {
    private static final String SIGNUP_SCOPE = "auth-signup";
    private static final String LOGIN_ADDRESS_SCOPE = "auth-login-address-failure";
    private static final String LOGIN_EMAIL_SCOPE = "auth-login-email-failure";
    private static final String LOGIN_COMBINATION_SCOPE = "auth-login-combination-failure";
    private static final int SIGNUP_LIMIT = 5;
    private static final int LOGIN_ADDRESS_FAILURE_LIMIT = 30;
    private static final int LOGIN_EMAIL_FAILURE_LIMIT = 10;
    private static final int LOGIN_COMBINATION_FAILURE_LIMIT = 5;
    private static final Duration SIGNUP_WINDOW = Duration.ofHours(1);
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);

    private final InMemoryRateLimiter limiter;

    public AuthAttemptLimiter(InMemoryRateLimiter limiter) {
        this.limiter = limiter;
    }

    public void consumeSignup(String clientAddress) {
        limiter.consume(SIGNUP_SCOPE, normalizedAddress(clientAddress), SIGNUP_LIMIT, SIGNUP_WINDOW);
    }

    public void checkLogin(String clientAddress, String email) {
        limiter.check(
            LOGIN_ADDRESS_SCOPE,
            addressKey(clientAddress),
            LOGIN_ADDRESS_FAILURE_LIMIT,
            LOGIN_WINDOW
        );
        limiter.check(LOGIN_EMAIL_SCOPE, emailKey(email), LOGIN_EMAIL_FAILURE_LIMIT, LOGIN_WINDOW);
        limiter.check(
            LOGIN_COMBINATION_SCOPE,
            loginKey(clientAddress, email),
            LOGIN_COMBINATION_FAILURE_LIMIT,
            LOGIN_WINDOW
        );
    }

    public void recordLoginFailure(String clientAddress, String email) {
        limiter.consume(
            LOGIN_ADDRESS_SCOPE,
            addressKey(clientAddress),
            LOGIN_ADDRESS_FAILURE_LIMIT,
            LOGIN_WINDOW
        );
        limiter.consume(LOGIN_EMAIL_SCOPE, emailKey(email), LOGIN_EMAIL_FAILURE_LIMIT, LOGIN_WINDOW);
        limiter.consume(
            LOGIN_COMBINATION_SCOPE,
            loginKey(clientAddress, email),
            LOGIN_COMBINATION_FAILURE_LIMIT,
            LOGIN_WINDOW
        );
    }

    public void resetLoginFailures(String clientAddress, String email) {
        limiter.reset(LOGIN_EMAIL_SCOPE, emailKey(email));
        limiter.reset(LOGIN_COMBINATION_SCOPE, loginKey(clientAddress, email));
    }

    private String loginKey(String clientAddress, String email) {
        var address = addressKey(clientAddress);
        var normalizedEmail = emailKey(email);
        return address.length() + ":" + address + normalizedEmail;
    }

    private String addressKey(String clientAddress) {
        return "address:" + normalizedAddress(clientAddress);
    }

    private String emailKey(String email) {
        return "email:" + AuthService.normalizeEmail(email);
    }

    private String normalizedAddress(String clientAddress) {
        return clientAddress == null || clientAddress.isBlank() ? "unknown" : clientAddress;
    }
}
