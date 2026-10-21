package com.pill.account;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.Flow;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class BrevoAccountMailSenderTest {
    @Test void missingOrUnsafeCredentialsAreUnavailable() {
        var client=mock(HttpClient.class);
        assertThat(new BrevoAccountMailSender("","mail@example.test",new ObjectMapper(),client).available()).isFalse();
        assertThat(new BrevoAccountMailSender("key","",new ObjectMapper(),client).available()).isFalse();
        assertThat(new BrevoAccountMailSender("key\r\nInjected: yes","mail@example.test",new ObjectMapper(),client).available()).isFalse();
        assertThat(new BrevoAccountMailSender("key","PILL <mail@example.test>",new ObjectMapper(),client).available()).isFalse();
        assertThat(new BrevoAccountMailSender("key","mail@example.test",new ObjectMapper(),client).available()).isTrue();
    }

    @SuppressWarnings("unchecked")
    @Test void sendsOnlyToOfficialHttpsEndpointWithExpectedPayloadAndTimeout() throws Exception {
        var client=mock(HttpClient.class);
        HttpResponse<Void> response=mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(201);
        when(client.send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class))).thenReturn(response);
        var sender=new BrevoAccountMailSender("test-key","mail@example.test",new ObjectMapper(),client);
        sender.send("recipient@example.test","subject","test <message> & code 123456","test-generation");
        var captured=ArgumentCaptor.forClass(HttpRequest.class);
        verify(client).send(captured.capture(),any(HttpResponse.BodyHandler.class));
        var request=captured.getValue();
        assertThat(request.uri().toString()).isEqualTo("https://api.brevo.com/v3/smtp/email");
        assertThat(request.timeout()).contains(Duration.ofSeconds(10));
        assertThat(request.headers().firstValue("api-key")).contains("test-key");
        assertThat(request.method()).isEqualTo("POST");
        var bytes=new ByteArrayOutputStream();
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer buffer) { var chunk=new byte[buffer.remaining()];buffer.get(chunk);bytes.writeBytes(chunk); }
            public void onError(Throwable error) { throw new AssertionError(error); }
            public void onComplete() {}
        });
        var payload=new ObjectMapper().readTree(bytes.toString(StandardCharsets.UTF_8));
        assertThat(payload.path("sender").path("name").asText()).isEqualTo("PILL");
        assertThat(payload.path("sender").path("email").asText()).isEqualTo("mail@example.test");
        assertThat(payload.path("to").get(0).path("email").asText()).isEqualTo("recipient@example.test");
        assertThat(payload.path("headers").path("IdempotencyKey").asText()).isEqualTo("test-generation");
        assertThat(payload.path("htmlContent").asText()).contains("&lt;message&gt; &amp;");
        assertThat(payload.path("textContent").asText()).contains("<message> & code 123456");
        when(response.statusCode()).thenReturn(429);
        assertThatThrownBy(() -> sender.send("recipient@example.test","subject","test message","other-generation"))
            .isInstanceOf(IOException.class).hasMessage("Account mail provider did not accept the request");
    }
}
