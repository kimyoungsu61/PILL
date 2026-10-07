package com.pill.auth;

import com.pill.auth.dto.AuthRequest;
import com.pill.auth.dto.AuthResponse;
import com.pill.auth.dto.MeResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final AuthAttemptLimiter attempts;

    public AuthController(AuthService authService, AuthAttemptLimiter attempts) {
        this.authService = authService;
        this.attempts = attempts;
    }

    @PostMapping("/signup")
    public AuthResponse signup(@Valid @RequestBody AuthRequest request, HttpServletRequest servletRequest) {
        attempts.consumeSignup(servletRequest.getRemoteAddr());
        return authService.signup(request.email(), request.password());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody AuthRequest request, HttpServletRequest servletRequest) {
        var clientAddress = servletRequest.getRemoteAddr();
        attempts.checkLogin(clientAddress, request.email());
        try {
            var response = authService.login(request.email(), request.password());
            attempts.resetLoginFailures(clientAddress, request.email());
            return response;
        } catch (InvalidCredentialsException ex) {
            attempts.recordLoginFailure(clientAddress, request.email());
            throw ex;
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal SessionPrincipal principal) {
        authService.logout(principal.sessionId());
    }

    @GetMapping("/me")
    public MeResponse me(@CurrentUser Long userId) {
        return new MeResponse(authService.email(userId));
    }
}
