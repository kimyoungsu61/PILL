package com.pill.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

public final class BrowserSession {
    public static final String COOKIE = "__Host-pill_session";
    public static final String CLIENT_HEADER = "X-Pill-Client";
    public static final String MARKER = "pill.browser-session";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private BrowserSession() {}

    public static boolean requested(HttpServletRequest request) {
        return "web".equals(request.getHeader(CLIENT_HEADER));
    }

    public static boolean unsafe(HttpServletRequest request) {
        return !SAFE_METHODS.contains(request.getMethod());
    }

    public static boolean trustedOrigin(HttpServletRequest request) {
        if ("cross-site".equals(request.getHeader("Sec-Fetch-Site"))) return false;
        var origin = request.getHeader("Origin");
        if (origin == null) return true;
        try {
            var uri = URI.create(origin);
            var port = uri.getPort() == -1 ? ("https".equals(uri.getScheme()) ? 443 : 80) : uri.getPort();
            return uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
                && (uri.getPath() == null || uri.getPath().isEmpty())
                && request.getScheme().equalsIgnoreCase(uri.getScheme())
                && request.getServerName().equalsIgnoreCase(uri.getHost())
                && request.getServerPort() == port;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    public static String cookieToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (COOKIE.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }

    public static String presentedToken(HttpServletRequest request) {
        var authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        return authorization != null && authorization.startsWith("Bearer ")
            ? authorization.substring(7) : cookieToken(request);
    }

    public static void write(HttpServletResponse response, String token, Instant expiresAt, Instant now) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie(token)
            .maxAge(Duration.ofSeconds(Math.max(0, Duration.between(now, expiresAt).getSeconds()))).build().toString());
    }

    public static void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookie("").maxAge(Duration.ZERO).build().toString());
    }

    private static ResponseCookie.ResponseCookieBuilder cookie(String token) {
        return ResponseCookie.from(COOKIE, token).httpOnly(true).secure(true).sameSite("Lax").path("/");
    }
}
