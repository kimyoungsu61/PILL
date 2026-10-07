package com.pill.notification;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WebPushDispatcher {
    private final WebPushStore store;
    private final WebPushSender sender;
    private final Clock clock;
    public WebPushDispatcher(WebPushStore store,WebPushSender sender,Clock clock) { this.store=store;this.sender=sender;this.clock=clock; }
    @Transactional
    public void dispatch(long reminderId) {
        if(!sender.enabled()) return;
        var now=clock.instant();var reminder=store.lockReminder(reminderId,now);
        if(reminder==null || !WebPushService.times(reminder.configuredTimes()).contains(reminder.doseTime())) return;
        var zone=ZoneId.of(reminder.device().zoneId());var date=now.atZone(zone).toLocalDate();
        var due=date.atTime(LocalTime.parse(reminder.doseTime())).atZone(zone).toInstant();
        // Do not deliver stale reminders or a dose which was already due when enabled.
        if(now.isBefore(due) || !now.isBefore(due.plus(Duration.ofMinutes(5))) || reminder.createdAt().isAfter(due)) return;
        var previous=store.delivery(reminder.id(),date);
        if(previous!=null && (!previous.status().equals("PENDING") || previous.attempts()>=3 || now.isBefore(previous.nextAttemptAt()))) return;
        int attempts=previous==null?0:previous.attempts();
        if(store.taken(reminder.supplementId(),date,reminder.doseTime())) {
            store.saveDelivery(reminder.id(),date,"SKIPPED",attempts,now,previous!=null);return;
        }
        String status="PENDING";
        try {
            int response=sender.send(reminder.device(),Map.of(
                "title","복용 시간이에요","body",reminder.productName()+" 복용할 시간입니다.",
                "tag","pill-dose-"+reminder.id()+"-"+date,
                "data",Map.of("url","/?supplementId="+reminder.supplementId(),"supplementId",reminder.supplementId(),"expiresAt",due.plusSeconds(300).toEpochMilli())));
            if(response>=200 && response<300) status="SENT";
            else if(response==404 || response==410) {store.disable(reminder.device().id());status="EXPIRED";}
            else if(response!=429 && response<500) status="FAILED";
        } catch(InterruptedException exception) { Thread.currentThread().interrupt(); }
        catch(Exception exception) { /* Retry transient failures without logging subscription secrets. */ }
        attempts++;
        if(status.equals("PENDING") && attempts>=3) status="FAILED";
        store.saveDelivery(reminder.id(),date,status,attempts,now.plusSeconds(30L*attempts),previous!=null);
    }
}
