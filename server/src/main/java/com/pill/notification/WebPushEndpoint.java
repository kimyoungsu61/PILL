package com.pill.notification;

import java.net.URI;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class WebPushEndpoint {
    private WebPushEndpoint() {}
    public static void validate(String endpoint, String p256dh, String auth, String zone) {
        try {
            var uri = URI.create(endpoint);
            var host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            boolean allowed = host.equals("fcm.googleapis.com") || host.equals("web.push.apple.com")
                || host.endsWith(".push.apple.com") || host.equals("updates.push.services.mozilla.com")
                || host.endsWith(".push.services.mozilla.com");
            var key = Base64.getUrlDecoder().decode(p256dh);
            var secret = Base64.getUrlDecoder().decode(auth);
            if (!allowed || !"https".equals(uri.getScheme()) || uri.getUserInfo() != null
                || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getFragment() != null
                || uri.getRawPath() == null || uri.getRawPath().length() < 2
                || key.length != 65 || key[0] != 4 || secret.length != 16) throw new IllegalArgumentException();
            ZoneId.of(zone);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "알림 정보를 확인하고 다시 연결해 주세요.");
        }
    }
}
