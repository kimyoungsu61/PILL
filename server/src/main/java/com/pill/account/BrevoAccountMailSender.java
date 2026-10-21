package com.pill.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

@Component
public class BrevoAccountMailSender implements AccountMailSender {
    private final String key;
    private final String from;
    private final ObjectMapper json;
    private final HttpClient client;

    @Autowired
    public BrevoAccountMailSender(@Value("${PILL_ACCOUNT_MAIL_API_KEY:}") String key,
        @Value("${PILL_ACCOUNT_MAIL_FROM:}") String from, ObjectMapper json) {
        this(key, from, json, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    BrevoAccountMailSender(String key, String from, ObjectMapper json, HttpClient client) {
        this.key=key.trim(); this.from=from.trim(); this.json=json; this.client=client;
    }

    @Override public boolean available() {
        return !key.isBlank() && !key.contains("\r") && !key.contains("\n")
            && from.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+");
    }

    @Override public void send(String recipient, String subject, String text, String idempotencyKey) throws Exception {
        if (!available()) throw new IOException("Account mail is unavailable");
        var content=Map.of(
            "sender", Map.of("name","PILL","email",from),
            "to", List.of(Map.of("email",recipient)),
            "subject",subject,
            "textContent",text,
            "htmlContent","<html lang=\"ko\"><body><div style=\"white-space:pre-line;font-family:Arial,sans-serif;line-height:1.7\">"
                + HtmlUtils.htmlEscape(text) + "</div></body></html>",
            "headers", Map.of("IdempotencyKey",idempotencyKey));
        var request=HttpRequest.newBuilder(URI.create("https://api.brevo.com/v3/smtp/email"))
            .timeout(Duration.ofSeconds(10)).header("api-key",key)
            .header("Content-Type","application/json").header("Accept","application/json")
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(content))).build();
        // Provider bodies may contain private recipient data; never retain or log them.
        var response=client.send(request,HttpResponse.BodyHandlers.discarding());
        if(response.statusCode()<200 || response.statusCode()>=300)
            throw new IOException("Account mail provider did not accept the request");
    }
}
