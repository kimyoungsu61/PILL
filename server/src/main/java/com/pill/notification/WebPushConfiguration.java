package com.pill.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class WebPushConfiguration {
    public final boolean enabled;
    public final String publicKey;
    public final String privateKey;
    public final String subject;

    public WebPushConfiguration(
        @Value("${PILL_WEB_PUSH_ENABLED:false}") boolean enabled,
        @Value("${PILL_VAPID_PUBLIC_KEY:}") String publicKey,
        @Value("${PILL_VAPID_PRIVATE_KEY:}") String privateKey,
        @Value("${PILL_VAPID_SUBJECT:}") String subject
    ) {
        this.enabled = enabled;
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
        if (enabled && (publicKey.isBlank() || privateKey.isBlank()
            || !(subject.startsWith("mailto:") || subject.startsWith("https://")))) {
            throw new IllegalStateException("Web push needs persistent VAPID keys and a contact subject.");
        }
    }
}
