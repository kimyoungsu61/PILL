package com.pill.notification;

import com.pill.auth.SessionPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/web-push")
public class WebPushController {
    private final WebPushService service;
    private final WebPushFollowUps followUps;
    public WebPushController(WebPushService service,WebPushFollowUps followUps) { this.service=service;this.followUps=followUps; }
    public record Connect(@NotBlank @Size(max=2048) String endpoint,@NotBlank @Size(max=160) String p256dh,
        @NotBlank @Size(max=40) String auth,@NotBlank @Size(max=60) String timeZone) {}
    public record Times(@NotNull @Size(max=8) List<@NotBlank @Size(max=5) String> times) {}
    public record DoseAction(@NotNull LocalDate doseDate,@NotBlank @Size(max=5) String doseTime,@NotBlank @Size(max=10) String action) {}
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
    @PutMapping("/subscriptions/{id}/follow-up") public WebPushService.State followUp(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id,@RequestBody FollowUpSettings body) {
        return service.setFollowUp(p,id,body);
    }
    @GetMapping("/subscriptions/{id}/doses/{supplementId}") public WebPushFollowUps.DoseView dose(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id,@PathVariable long supplementId,@RequestParam LocalDate doseDate,@RequestParam String doseTime) {
        return followUps.view(p,id,supplementId,doseDate,doseTime);
    }
    @PostMapping("/subscriptions/{id}/doses/{supplementId}") public WebPushFollowUps.DoseView doseAction(@AuthenticationPrincipal SessionPrincipal p,@PathVariable String id,@PathVariable long supplementId,@Valid @RequestBody DoseAction body) {
        return followUps.action(p,id,supplementId,body.doseDate(),body.doseTime(),body.action());
    }
}
