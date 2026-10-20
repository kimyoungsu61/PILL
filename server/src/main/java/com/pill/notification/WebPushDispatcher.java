package com.pill.notification;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WebPushDispatcher {
    private final WebPushStore store;
    private final WebPushSender sender;
    private final Clock clock;
    private final WebPushFollowUps followUps;
    public WebPushDispatcher(WebPushStore store,WebPushSender sender,Clock clock,WebPushFollowUps followUps) { this.store=store;this.sender=sender;this.clock=clock;this.followUps=followUps; }
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
        if(store.recorded(reminder.supplementId(),date,reminder.doseTime())) {
            store.saveDelivery(reminder.id(),date,"SKIPPED",attempts,now,previous!=null);return;
        }
        String status="PENDING";
        try {
            int response=sender.send(reminder.device(),WebPushFollowUps.payload(reminder,date,due.plusSeconds(300),0));
            if(response>=200 && response<300) status="SENT";
            else if(response==404 || response==410) {store.disable(reminder.device().id());status="EXPIRED";}
            else if(response!=429 && response<500) status="FAILED";
        } catch(InterruptedException exception) { Thread.currentThread().interrupt(); }
        catch(Exception exception) { /* Retry transient failures without logging subscription secrets. */ }
        attempts++;
        if(status.equals("PENDING") && attempts>=3) status="FAILED";
        store.saveDelivery(reminder.id(),date,status,attempts,now.plusSeconds(30L*attempts),previous!=null);
        if (status.equals("SENT")) followUps.afterInitialDelivery(reminder,date,now);
    }
}
