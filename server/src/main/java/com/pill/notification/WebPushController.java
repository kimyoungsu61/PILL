package com.pill.notification;

import com.pill.auth.SessionPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/web-push")
public class WebPushController {
    private final WebPushService service;
    public WebPushController(WebPushService service) { this.service=service; }
    public record Connect(@NotBlank @Size(max=2048) String endpoint,@NotBlank @Size(max=160) String p256dh,
        @NotBlank @Size(max=40) String auth,@NotBlank @Size(max=60) String timeZone) {}
    public record Times(@NotNull @Size(max=8) List<@NotBlank @Size(max=5) String> times) {}
    @GetMapping("/config") public Map<String,Object> config() { return service.config(); }
    @PostMapping("/subscriptions") public WebPushService.State connect(@AuthenticationPrincipal SessionPrincipal p,@Valid @RequestBody Connect body) throws Exception {
        return service.connect(p,body.endpoint(),body.p256dh(),body.auth(),body.timeZone());
    }
    @GetMapping("/subscriptions/{id}") public WebPushService.State state(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id) { return service.state(p,id); }
    @PutMapping("/subscriptions/{id}/reminders/{supplementId}") public WebPushService.State times(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id,@PathVariable long supplementId,@Valid @RequestBody Times body) {
        return service.setTimes(p,id,supplementId,body.times());
    }
    @DeleteMapping("/subscriptions/{id}") public ResponseEntity<Void> disconnect(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id) { service.disconnect(p,id);return ResponseEntity.noContent().build(); }
    @PostMapping("/subscriptions/{id}/test") public ResponseEntity<Void> test(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id) throws Exception { service.test(p,id);return ResponseEntity.accepted().build(); }
}
