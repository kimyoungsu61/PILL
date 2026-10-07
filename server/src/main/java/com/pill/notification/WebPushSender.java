package com.pill.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.security.Security;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.AbstractPushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Component;

@Component
public class WebPushSender {
    private final WebPushConfiguration config;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    private final PreparedService push;

    public WebPushSender(WebPushConfiguration config, ObjectMapper json) throws Exception {
        this.config = config;
        this.json = json;
        if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
        push = config.enabled ? new PreparedService(config.publicKey, config.privateKey, config.subject) : null;
    }
    public boolean enabled() { return config.enabled; }
    public String publicKey() { return config.enabled ? config.publicKey : ""; }
    public int send(WebPushStore.Device device, Object payload) throws Exception {
        return http.send(prepare(device,payload), HttpResponse.BodyHandlers.discarding()).statusCode();
    }
    HttpRequest prepare(WebPushStore.Device device,Object payload) throws Exception {
        if (!enabled()) throw new IllegalStateException("Web push is disabled");
        WebPushEndpoint.validate(device.endpoint(), device.p256dh(), device.auth(), device.zoneId());
        var notification = new Notification(device.endpoint(), device.p256dh(), device.auth(), json.writeValueAsBytes(payload), ttl(payload));
        var prepared = push.prepare(notification);
        var request = HttpRequest.newBuilder(java.net.URI.create(prepared.getUrl())).timeout(Duration.ofSeconds(8))
            .POST(HttpRequest.BodyPublishers.ofByteArray(prepared.getBody()));
        prepared.getHeaders().forEach(request::header);
        return request.build();
    }
    private int ttl(Object payload) {
        var expiry = json.valueToTree(payload).path("data").path("expiresAt");
        if (!expiry.isNumber()) return 300;
        long remaining = (expiry.asLong() - System.currentTimeMillis()) / 1000;
        return (int)Math.max(1, Math.min(300, remaining));
    }
    private static final class PreparedService extends AbstractPushService<PreparedService> {
        PreparedService(String publicKey,String privateKey,String subject) throws Exception { super(publicKey,privateKey,subject); }
        nl.martijndwars.webpush.HttpRequest prepare(Notification notification) throws Exception { return prepareRequest(notification,nl.martijndwars.webpush.Encoding.AES128GCM); }
    }
}
