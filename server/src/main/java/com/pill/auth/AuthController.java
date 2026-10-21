package com.pill.auth;

import com.pill.auth.dto.AuthRequest;
import com.pill.auth.dto.AuthResponse;
import com.pill.auth.dto.MeResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Clock;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final AuthAttemptLimiter attempts;
    private final AuthSessionService sessions;
    private final Clock clock;

    public AuthController(AuthService authService, AuthAttemptLimiter attempts, AuthSessionService sessions, Clock clock) {
        this.authService = authService;
        this.attempts = attempts;
        this.sessions = sessions;
        this.clock = clock;
    }

    @PostMapping("/signup")
    public AuthResponse signup(@Valid @RequestBody AuthRequest request, HttpServletRequest servletRequest,
                               HttpServletResponse servletResponse) {
        attempts.consumeSignup(servletRequest.getRemoteAddr());
        return finishAuth(authService.signup(request.email(), request.password()), servletRequest, servletResponse);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthRequest request, HttpServletRequest servletRequest,
                              HttpServletResponse servletResponse) {
        var clientAddress = servletRequest.getRemoteAddr();
        attempts.checkLogin(clientAddress, request.email());
        try {
            var response = authService.login(request.email(), request.password());
            attempts.resetLoginFailures(clientAddress, request.email());
            return finishAuth(response, servletRequest, servletResponse);
        } catch (InvalidCredentialsException exception) {
            attempts.recordLoginFailure(clientAddress, request.email());
            throw exception;
        }
    }

    private AuthResponse finishAuth(AuthResponse response, HttpServletRequest request, HttpServletResponse servletResponse) {
        if (!BrowserSession.requested(request)) return response;
        var previous = BrowserSession.cookieToken(request);
        if (previous != null) {
            try { sessions.revoke(sessions.authenticate(previous).sessionId()); }
            catch (InvalidSessionException ignored) { /* An expired cookie must not prevent signing in. */ }
        }
        var principal = sessions.authenticate(response.token());
        BrowserSession.write(servletResponse, response.token(), sessions.remember(principal.sessionId()), clock.instant());
        return new AuthResponse(BrowserSession.MARKER, response.email());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal SessionPrincipal principal) {
        authService.logout(principal.sessionId());
        // A delayed logout response must not erase a newer login cookie in another tab.
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal SessionPrincipal principal, HttpServletRequest request,
                         HttpServletResponse response) {
        if (BrowserSession.requested(request) && request.getHeader("Authorization") != null) {
            // Only explicit legacy bearer migration writes a cookie. Ordinary
            // identity probes may finish after a different account signs in.
            BrowserSession.write(response, BrowserSession.presentedToken(request),
                sessions.remember(principal.sessionId()), clock.instant());
        }
        return new MeResponse(authService.email(principal.userId()));
    }
}
