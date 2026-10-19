package com.pill.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    private final AuthSessionService sessions;
    private final JsonAuthenticationEntryPoint authenticationEntryPoint;

    public SessionAuthenticationFilter(AuthSessionService sessions, JsonAuthenticationEntryPoint authenticationEntryPoint) {
        this.sessions = sessions;
        this.authenticationEntryPoint = authenticationEntryPoint;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        if (BrowserSession.requested(request) && !BrowserSession.trustedOrigin(request)) {
            authenticationEntryPoint.write(response, 403, "FORBIDDEN", "Cross-origin authentication is not allowed.");
            return;
        }
        var authorization = request.getHeader("Authorization");
        var path = request.getServletPath().isEmpty() ? request.getRequestURI() : request.getServletPath();
        var publicLogin = path.equals("/api/auth/login") || path.equals("/api/auth/signup");
        var cookieToken = path.startsWith("/api/") && !publicLogin ? BrowserSession.cookieToken(request) : null;
        if (authorization == null && cookieToken == null) {
            filterChain.doFilter(request, response);
            return;
        }
        if (authorization != null && !authorization.startsWith("Bearer ")) {
            authenticationEntryPoint.commence(request, response, new BadCredentialsException("invalid bearer token"));
            return;
        }
        var usingCookie = authorization == null;
        if (usingCookie && BrowserSession.unsafe(request)
            && (!BrowserSession.requested(request) || !BrowserSession.trustedOrigin(request))) {
            authenticationEntryPoint.write(response, 403, "FORBIDDEN", "A same-origin app request is required.");
            return;
        }
        SessionPrincipal principal;
        try {
            principal = sessions.authenticate(usingCookie ? cookieToken : authorization.substring(7));
        } catch (InvalidSessionException exception) {
            SecurityContextHolder.clearContext();
            if (usingCookie) BrowserSession.clear(response);
            authenticationEntryPoint.commence(request, response, new BadCredentialsException("invalid session", exception));
            return;
        }
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, List.of());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        filterChain.doFilter(request, response);
    }
}
