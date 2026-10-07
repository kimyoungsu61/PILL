package com.pill.notification;

import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class WebPushScheduler {
    private static final Logger log=LoggerFactory.getLogger(WebPushScheduler.class);
    private final WebPushStore store;private final WebPushDispatcher dispatcher;private final WebPushSender sender;private final Clock clock;
    public WebPushScheduler(WebPushStore store,WebPushDispatcher dispatcher,WebPushSender sender,Clock clock) {
        this.store=store;this.dispatcher=dispatcher;this.sender=sender;this.clock=clock;
    }
    @Scheduled(fixedDelayString="${pill.web-push.poll-ms:30000}",initialDelayString="${pill.web-push.initial-delay-ms:30000}")
    public void tick() {
        if(!sender.enabled()) return;
        for(var id:store.activeReminderIds(clock.instant())) {
            try{dispatcher.dispatch(id);}catch(Exception e){log.warn("Web reminder dispatch failed: {}",e.getClass().getSimpleName());}
        }
    }
    @Scheduled(fixedDelay=86400000,initialDelay=600000)
    public void purge() { if(sender.enabled()) store.purge(clock.instant()); }
}
