package com.pill.notification;

import com.pill.auth.SessionPrincipal;
import com.pill.common.InMemoryRateLimiter;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HexFormat;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WebPushService {
    private final WebPushStore store;
    private final WebPushSender sender;
    private final Clock clock;
    private final InMemoryRateLimiter limiter;
    public WebPushService(WebPushStore store,WebPushSender sender,Clock clock,InMemoryRateLimiter limiter) {
        this.store=store;this.sender=sender;this.clock=clock;this.limiter=limiter;
    }
    public record State(String id,boolean enabled,List<WebPushStore.ReminderView> reminders) {}
    public Map<String,Object> config() { return Map.of("enabled",sender.enabled(),"publicKey",sender.publicKey()); }
    @Transactional
    public State connect(SessionPrincipal p,String endpoint,String key,String auth,String zone) throws Exception {
        requireEnabled();WebPushEndpoint.validate(endpoint,key,auth,zone);
        limiter.consume("web-push-connect",p.userId().toString(),20,Duration.ofMinutes(1));
        store.lockUser(p.userId());
        var hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(endpoint.getBytes(StandardCharsets.UTF_8)));
        var old=store.byEndpointHash(hash);
        if(old!=null && (old.userId()!=p.userId() || !old.p256dh().equals(key) || !old.auth().equals(auth)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"알림 연결을 새로 만들어 주세요.");
        if(old==null && store.deviceCount(p.userId())>=5)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"알림 기기는 최대 5대까지 연결할 수 있어요.");
        var device=new WebPushStore.Device(old==null?UUID.randomUUID().toString():old.id(),p.userId(),p.sessionId(),endpoint,key,auth,zone,true);
        if(old==null) store.insert(device,hash,clock.instant()); else store.reconnect(device,clock.instant());
        return new State(device.id(),true,store.reminders(device.id()));
    }
    @Transactional(readOnly=true)
    public State state(SessionPrincipal p,String id) { var d=store.owned(p,id);return new State(id,d.enabled(),store.reminders(id)); }
    @Transactional
    public State setTimes(SessionPrincipal p,String id,long supplementId,List<String> requested) {
        requireEnabled();store.owned(p,id);
        var configured=times(store.ownedProductTimes(p.userId(),supplementId));
        if(requested==null || requested.size()>8 || requested.stream().anyMatch(time->time==null||!configured.contains(time)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"제품에 저장된 복용 시간을 선택해 주세요.");
        store.setReminders(id,supplementId,requested.stream().distinct().sorted().toList(),clock.instant());
        return state(p,id);
    }
    @Transactional
    public void disconnect(SessionPrincipal p,String id) { store.owned(p,id);store.remove(id); }
    @Transactional(noRollbackFor=ResponseStatusException.class)
    public void test(SessionPrincipal p,String id) throws Exception {
        requireEnabled();var device=store.owned(p,id);
        limiter.consume("web-push-test",p.userId().toString(),3,Duration.ofMinutes(1));
        int status=sender.send(device,Map.of("title","PILL 알림이 연결됐어요","body","복용 시간이 되면 이 기기로 알려드릴게요.",
            "tag","pill-connection-test","data",Map.of("url","/","expiresAt",clock.instant().plusSeconds(300).toEpochMilli())));
        if(status==404||status==410) { store.disable(id);throw new ResponseStatusException(HttpStatus.GONE,"알림 연결이 만료됐어요. 다시 연결해 주세요."); }
        if(status<200||status>=300) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"알림을 전송하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    private void requireEnabled() {
        if(!sender.enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"알림 서비스를 준비 중이에요. 잠시 후 다시 확인해 주세요.");
    }
    public static List<String> times(String raw) { return raw==null?List.of():Arrays.stream(raw.split(",")).map(String::trim)
        .filter(time->time.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")).distinct().sorted().toList(); }
}
