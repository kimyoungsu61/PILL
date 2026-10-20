package com.pill.notification;

import com.pill.auth.AuthSessionService;
import com.pill.auth.BrowserSession;
import com.pill.auth.SessionPrincipal;
import com.pill.model.User;
import com.pill.model.SupplementScan;
import com.pill.model.UserSupplement;
import com.pill.model.DoseLog;
import com.pill.repository.*;
import com.pill.supplement.SupplementService;
import com.pill.supplement.dto.UpdateDoseTimesRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import org.springframework.transaction.annotation.Transactional;
import javax.sql.DataSource;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={
    "spring.datasource.url=jdbc:h2:mem:webpush-test;MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver","spring.datasource.username=sa","spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop","pill.web-push.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Transactional
class WebPushIntegrationTest {
    @Autowired MockMvc mvc;@Autowired DataSource dataSource;@Autowired ObjectMapper json;
    @Autowired WebPushService service;@Autowired WebPushStore store;@Autowired WebPushDispatcher dispatcher;@Autowired WebPushScheduler scheduler;
    @Autowired WebPushFollowUpStore followUpStore;@Autowired WebPushFollowUps followUps;
    @Autowired AuthSessionService sessions;@Autowired UserRepository users;@Autowired SupplementScanRepository scans;
    @Autowired UserSupplementRepository supplements;@Autowired DoseLogRepository logs;@Autowired SupplementService supplementService;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @MockitoBean WebPushSender sender;@MockitoBean Clock clock;
    User user;String token;SessionPrincipal principal;UserSupplement product;
    String key;String auth;
    @BeforeAll void schema() { new ResourceDatabasePopulator(new ClassPathResource("db/web_push.sql")).execute(dataSource); }
    @BeforeEach void prepare() throws Exception {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-06T23:59:00Z"));when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
        when(sender.enabled()).thenReturn(true);when(sender.publicKey()).thenReturn("public-key");when(sender.send(any(),any())).thenReturn(201);
        user=users.save(new User(UUID.randomUUID()+"@example.com","hash"));token=sessions.issue(user).token();principal=sessions.authenticate(token);
        product=product(user,"09:00,19:00");
        var bytes=new byte[65];bytes[0]=4;key=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        auth=Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);
    }
    @Test void authenticatedEndpointsAndPublicHealth() throws Exception {
        mvc.perform(get("/api/web-push/config")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/web-push/subscriptions").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/manifest.webmanifest")).andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("application/manifest+json"));
        mvc.perform(get("/healthz")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        mvc.perform(get("/api/web-push/config").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(true));
    }
    @Test void installationGuideIsPublicWhilePersonalDataStaysProtected() throws Exception {
        mvc.perform(get("/install.html")).andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("text/html"))
            .andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("아이폰에 PILL 추가하기")));
        for (var path : List.of("/install.css", "/install.js", "/icons/pill-install-qr.svg", "/icons/pill-install-qr.png")) {
            mvc.perform(get(path)).andExpect(status().isOk());
        }
        mvc.perform(get("/api/supplements")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/scans")).andExpect(status().isUnauthorized());
        mvc.perform(post("/install.html")).andExpect(status().is4xxClientError());
        mvc.perform(get("/private-install.html")).andExpect(status().is4xxClientError());
    }
    @Test void rejectsOtherUsersDeviceAndProduct() throws Exception {
        var state=connect("owner");var stranger=users.save(new User(UUID.randomUUID()+"@example.com","hash"));var strangerToken=sessions.issue(stranger).token();
        mvc.perform(get("/api/web-push/subscriptions/"+state.id()).header("Authorization","Bearer "+strangerToken)).andExpect(status().isNotFound());
        mvc.perform(put("/api/web-push/subscriptions/"+state.id()+"/reminders/"+product(stranger,"09:00").getId())
            .header("Authorization","Bearer "+token).contentType("application/json").content("{\"times\":[\"09:00\"]}")).andExpect(status().isNotFound());
        assertThatThrownBy(()->service.connect(sessions.authenticate(strangerToken),"https://web.push.apple.com/owner",key,auth,"Asia/Seoul"))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
    @Test void rejectsArbitraryEndpointsAndTimes() throws Exception {
        for(var endpoint:List.of("http://web.push.apple.com/x","https://localhost/x","https://web.push.apple.com.evil.example/x","https://web.push.apple.com:444/x","https://127.0.0.1/x")) {
            mvc.perform(post("/api/web-push/subscriptions").header("Authorization","Bearer "+token).contentType("application/json")
                .content(json.writeValueAsString(Map.of("endpoint",endpoint,"p256dh",key,"auth",auth,"timeZone","Asia/Seoul")))).andExpect(status().isBadRequest());
        }
        var state=connect("times");
        mvc.perform(put("/api/web-push/subscriptions/"+state.id()+"/reminders/"+product.getId()).header("Authorization","Bearer "+token)
            .contentType("application/json").content("{\"times\":[\"10:00\"]}")).andExpect(status().isBadRequest());
    }
    @Test void schedulesOnlySelectedDeviceAndDoseThenDeduplicates() throws Exception {
        var state=connect("first");var second=connect("second");service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));
        assertThat(service.state(principal,second.id()).reminders()).isEmpty();
        long id=store.activeReminderIds(clock.instant()).getFirst();dispatcher.dispatch(id);verify(sender,never()).send(any(),any());
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T00:00:10Z"));dispatcher.dispatch(id);dispatcher.dispatch(id);
        verify(sender,times(1)).send(any(),argThat(payload->payload instanceof Map<?,?> map && "복용 시간이에요".equals(map.get("title"))));
        assertThat(store.delivery(id,LocalDate.of(2026,10,7)).status()).isEqualTo("SENT");
    }
    @Test void retriesTransientFailureWithoutDuplicateSuccessfulDelivery() throws Exception {
        var state=connect("retry");service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));var id=store.activeReminderIds(clock.instant()).getFirst();
        when(sender.send(any(),any())).thenReturn(503,201);when(clock.instant()).thenReturn(Instant.parse("2026-10-07T00:00:10Z"));
        dispatcher.dispatch(id);dispatcher.dispatch(id);verify(sender,times(1)).send(any(),any());
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T00:00:41Z"));dispatcher.dispatch(id);dispatcher.dispatch(id);verify(sender,times(2)).send(any(),any());
        assertThat(store.delivery(id,LocalDate.of(2026,10,7)).status()).isEqualTo("SENT");
    }
    @Test void skipsTakenDoseAndExpiredCatchupWindow() throws Exception {
        var state=connect("taken");service.setTimes(principal,state.id(),product.getId(),List.of("09:00","19:00"));
        logs.saveAndFlush(new DoseLog(product,LocalDate.of(2026,10,7),"09:00","TAKEN",""));
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T00:00:10Z"));for(var id:store.activeReminderIds(clock.instant()))dispatcher.dispatch(id);
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T10:06:00Z"));for(var id:store.activeReminderIds(clock.instant()))dispatcher.dispatch(id);
        verify(sender,never()).send(any(),any());
    }
    @Test void logoutStopsDispatchAndReconnectionPreservesChoices() throws Exception {
        var state=connect("logout");service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));sessions.revoke(principal.sessionId());entityManager.flush();
        assertThat(store.activeReminderIds(clock.instant())).isEmpty();
        var fresh=sessions.authenticate(sessions.issue(user).token());var reconnected=service.connect(fresh,"https://web.push.apple.com/logout",key,auth,"Asia/Seoul");
        assertThat(reconnected.id()).isEqualTo(state.id());assertThat(reconnected.reminders()).hasSize(1);
        assertThatThrownBy(()->service.state(principal,state.id())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
    @Test void supplementDeletionCascadesAndEditedTimesRescheduleSelectedReminder() throws Exception {
        var state=connect("delete");service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("10:00")));
        assertThat(service.state(principal,state.id()).reminders()).extracting(WebPushStore.ReminderView::time).containsExactly("10:00");
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T00:00:10Z"));for(var id:store.activeReminderIds(clock.instant()))dispatcher.dispatch(id);verify(sender,never()).send(any(),any());
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T01:00:10Z"));scheduler.tick();scheduler.tick();verify(sender,times(1)).send(any(),any());
        supplementService.deleteSupplement(user.getId(),product.getId());assertThat(store.activeReminderIds(clock.instant())).isEmpty();
    }
    @Test void editingTimesPreservesEachDevicesChoicesAcrossSortOrder() throws Exception {
        var first=connect("move-first");var second=connect("move-second");var off=connect("move-off");
        service.setTimes(principal,first.id(),product.getId(),List.of("09:00"));
        service.setTimes(principal,second.id(),product.getId(),List.of("19:00"));
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("19:00","21:00")));
        assertThat(service.state(principal,first.id()).reminders()).extracting(WebPushStore.ReminderView::time).containsExactly("21:00");
        assertThat(service.state(principal,second.id()).reminders()).extracting(WebPushStore.ReminderView::time).containsExactly("19:00");
        assertThat(service.state(principal,off.id()).reminders()).isEmpty();
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("19:00","21:00","22:00")));
        assertThat(service.state(principal,first.id()).reminders()).extracting(WebPushStore.ReminderView::time).containsExactly("21:00");
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("19:00","22:00")));
        assertThat(service.state(principal,first.id()).reminders()).isEmpty();
    }
    @Test void editingAnEarlyMorningTimeRepairsPreviouslyStrandedReminderAndDispatchesOnce() throws Exception {
        var state=connect("stranded");service.setTimes(principal,state.id(),product.getId(),List.of("19:00"));
        // Reproduce an existing reservation left behind by the previous time editor.
        product.updateConfirmedDoseTime("02:00");supplements.saveAndFlush(product);
        assertThat(service.state(principal,state.id()).reminders()).isEmpty();
        when(clock.instant()).thenReturn(Instant.parse("2026-10-08T16:59:00Z"));
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("02:10")));
        assertThat(service.state(principal,state.id()).reminders()).extracting(WebPushStore.ReminderView::time).containsExactly("02:10");
        scheduler.tick();verify(sender,never()).send(any(),any());
        when(clock.instant()).thenReturn(Instant.parse("2026-10-08T17:10:10Z"));
        scheduler.tick();scheduler.tick();verify(sender,times(1)).send(any(),any());
        var id=store.activeReminderIds(clock.instant()).getFirst();
        assertThat(store.delivery(id,LocalDate.of(2026,10,9)).status()).isEqualTo("SENT");
    }
    @Test void savingAnUnchangedSingleTimeRepairsAnOldHiddenReservation() throws Exception {
        var state=connect("stranded-unchanged");service.setTimes(principal,state.id(),product.getId(),List.of("19:00"));
        product.updateConfirmedDoseTime("02:00");supplements.saveAndFlush(product);
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("02:00")));
        assertThat(service.state(principal,state.id()).reminders()).extracting(WebPushStore.ReminderView::time).containsExactly("02:00");
    }
    @Test void expiredPushDeviceIsDisabledAndTestEndpointPersistsExpiry() throws Exception {
        var state=connect("expired");when(sender.send(any(),any())).thenReturn(410);
        assertThatThrownBy(()->service.test(principal,state.id())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(service.state(principal,state.id()).enabled()).isFalse();
    }
    @Test void dailyTimeUsesDeviceZoneAndDoesNotSendImmediatelyWhenEnabledLate() throws Exception {
        var state=service.connect(principal,"https://web.push.apple.com/utc",key,auth,"UTC");service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T00:00:10Z"));for(var id:store.activeReminderIds(clock.instant()))dispatcher.dispatch(id);verify(sender,never()).send(any(),any());
        when(clock.instant()).thenReturn(Instant.parse("2026-10-07T09:00:10Z"));for(var id:store.activeReminderIds(clock.instant()))dispatcher.dispatch(id);verify(sender,times(1)).send(any(),any());
    }
    @Test void rememberedBrowserKeepsItsPushSessionForSixMonthsAndLogoutStillStopsIt() throws Exception {
        var state=connect("remembered-browser");
        service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));
        var original=store.activeReminderIds(clock.instant());
        var migrated=mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+token)
            .header(BrowserSession.CLIENT_HEADER,"web")).andExpect(status().isOk()).andReturn();
        assertThat(migrated.getResponse().getHeader("Set-Cookie")).contains("HttpOnly");
        assertThat(sessions.authenticate(token).sessionId()).isEqualTo(principal.sessionId());
        when(clock.instant()).thenReturn(Instant.parse("2027-01-14T23:59:00Z"));
        assertThat(store.activeReminderIds(clock.instant())).containsExactlyElementsOf(original);
        mvc.perform(post("/api/auth/logout").cookie(new jakarta.servlet.http.Cookie(BrowserSession.COOKIE,token))
            .header(BrowserSession.CLIENT_HEADER,"web")).andExpect(status().isNoContent());
        entityManager.flush();
        assertThat(store.activeReminderIds(clock.instant())).isEmpty();
    }
    @Test void followUpsAreOptInAndSettingsAreValidatedAndDeviceSpecific() throws Exception {
        var first=connect("follow-settings");var other=connect("follow-other");
        assertThat(first.followUp()).isEqualTo(FollowUpSettings.defaults());
        mvc.perform(put("/api/web-push/subscriptions/"+first.id()+"/follow-up").header("Authorization","Bearer "+token)
            .contentType("application/json").content(json.writeValueAsString(new FollowUpSettings(true,15,2,true,"22:00","08:00"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.followUp.maxFollowUps").value(2));
        assertThat(service.state(principal,other.id()).followUp().enabled()).isFalse();
        for(var invalid:List.of(new FollowUpSettings(true,0,1,false,"22:00","08:00"),new FollowUpSettings(true,30,4,false,"22:00","08:00"),
            new FollowUpSettings(true,30,1,true,"22:00","22:00"),new FollowUpSettings(true,30,1,true,"25:00","08:00"))) {
            mvc.perform(put("/api/web-push/subscriptions/"+first.id()+"/follow-up").header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(invalid))).andExpect(status().isBadRequest());
        }
        service.setTimes(principal,other.id(),product.getId(),List.of("09:00"));
        at("2026-10-07T00:00:10Z");scheduler.tick();at("2026-10-07T00:30:10Z");scheduler.tick();
        verify(sender,times(1)).send(any(),any());
    }
    @Test void followUpsWaitForTheirIntervalDeduplicateAndStopAtTheConfiguredLimit() throws Exception {
        var state=followEnabled("follow-limit",1,2);long id=initial(state);
        at("2026-10-07T00:01:09Z");scheduler.tick();verify(sender,times(1)).send(any(),any());
        at("2026-10-07T00:01:10Z");scheduler.tick();scheduler.tick();
        verify(sender,times(2)).send(any(),any());
        at("2026-10-07T00:02:10Z");scheduler.tick();scheduler.tick();
        at("2026-10-07T00:03:10Z");scheduler.tick();
        verify(sender,times(3)).send(any(),any());
        assertThat(followUpStore.find(id,LocalDate.of(2026,10,7)).sentCount()).isEqualTo(2);
        assertThat(followUpStore.due(clock.instant())).isEmpty();
    }
    @Test void takenOrSkippedFromNormalProductScreenCancelsAllDevicesFollowUps() throws Exception {
        for(var status:List.of("TAKEN","SKIPPED")) {
            at("2026-10-06T23:59:00Z");
            var state=followEnabled("follow-record-"+status,1,2);var id=initial(state);
            supplementService.logDose(user.getId(),product.getId(),new com.pill.supplement.dto.DoseLogRequest(status,"","09:00"));
            entityManager.flush();
            assertThat(followUpStore.find(id,LocalDate.of(2026,10,7)).status()).isEqualTo("CANCELLED");
            at("2026-10-07T00:01:10Z");scheduler.tick();
            supplementService.clearDoseLog(user.getId(),product.getId(),"09:00");entityManager.flush();
        }
        verify(sender,times(2)).send(any(),any());
    }
    @Test void skippedDoseDoesNotSendEvenItsOriginalNotification() throws Exception {
        var state=followEnabled("follow-skipped-initial",1,1);
        logs.saveAndFlush(new DoseLog(product,LocalDate.of(2026,10,7),"09:00","SKIPPED",""));
        initial(state);verify(sender,never()).send(any(),any());
    }
    @Test void disablingFollowUpsCancelsPendingAutomaticNotificationsAndDoesNotBackfillOnReenable() throws Exception {
        var state=followEnabled("follow-disable",1,3);var id=initial(state);
        service.setFollowUp(principal,state.id(),FollowUpSettings.defaults());
        service.setFollowUp(principal,state.id(),new FollowUpSettings(true,1,3,false,"22:00","08:00"));
        at("2026-10-07T00:01:10Z");scheduler.tick();
        verify(sender,times(1)).send(any(),any());
        assertThat(followUpStore.find(id,LocalDate.of(2026,10,7)).status()).isEqualTo("CANCELLED");
    }
    @Test void noStaleFollowUpsAfterAnOutageOrTheNextProductDose() throws Exception {
        var state=followEnabled("follow-outage",1,3);var id=initial(state);
        at("2026-10-07T00:06:10Z");scheduler.tick();verify(sender,times(1)).send(any(),any());
        assertThat(followUpStore.find(id,LocalDate.of(2026,10,7)).status()).isEqualTo("CANCELLED");
        at("2026-10-07T00:07:00Z");
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("09:08","09:09")));entityManager.flush();
        service.setTimes(principal,state.id(),product.getId(),List.of("09:08"));
        at("2026-10-07T00:08:10Z");scheduler.tick();
        at("2026-10-07T00:09:10Z");scheduler.tick();verify(sender,times(2)).send(any(),any());
    }
    @Test void quietHoursIncludeTheirStartExcludeTheirEndAndCanCrossMidnight() {
        var settings=new FollowUpSettings(true,30,1,true,"22:00","08:00");
        assertThat(settings.quietAt(java.time.LocalTime.of(22,0))).isTrue();
        assertThat(settings.quietAt(java.time.LocalTime.of(0,15))).isTrue();
        assertThat(settings.quietAt(java.time.LocalTime.of(8,0))).isFalse();
        var daytime=new FollowUpSettings(true,30,1,true,"12:00","13:00");
        assertThat(daytime.quietAt(java.time.LocalTime.of(12,30))).isTrue();
        assertThat(daytime.quietAt(java.time.LocalTime.of(14,0))).isFalse();
    }
    @Test void quietHoursSuppressOnlyExtraNotificationsAndNeverDeferThemUntilMorning() throws Exception {
        var state=followEnabled("follow-quiet",1,2);
        service.setFollowUp(principal,state.id(),new FollowUpSettings(true,1,2,true,"09:01","09:30"));
        initial(state);at("2026-10-07T00:30:10Z");scheduler.tick();verify(sender,times(1)).send(any(),any());
    }
    @Test void aLateNightFollowUpKeepsItsOriginalDoseDateAcrossMidnight() throws Exception {
        at("2026-10-07T14:58:00Z");
        supplementService.updateDoseTimes(user.getId(),product.getId(),new UpdateDoseTimesRequest(List.of("23:59")));entityManager.flush();
        var state=connect("follow-midnight");
        service.setFollowUp(principal,state.id(),new FollowUpSettings(true,1,1,false,"22:00","08:00"));
        service.setTimes(principal,state.id(),product.getId(),List.of("23:59"));
        at("2026-10-07T14:59:10Z");scheduler.tick();at("2026-10-07T15:00:10Z");scheduler.tick();scheduler.tick();
        verify(sender,times(2)).send(any(),any());
        verify(sender).send(any(),argThat(payload -> payload instanceof Map<?,?> map && "복용 기록을 확인해 주세요".equals(map.get("title"))
            && ((Map<?,?>)map.get("data")).get("doseDate").equals("2026-10-07")));
        var result=followUps.action(principal,state.id(),product.getId(),LocalDate.of(2026,10,7),"23:59","TAKEN");
        assertThat(result.status()).isEqualTo("TAKEN");
        assertThat(logs.findBySupplementIdAndDoseDateAndDoseTime(product.getId(),LocalDate.of(2026,10,7),"23:59")).isPresent();
        assertThat(logs.findBySupplementIdAndDoseDate(product.getId(),LocalDate.of(2026,10,8))).isEmpty();
    }
    @Test void explicitSnoozeReplacesTheAutomaticTimeAndDoesNotMarkTheDoseTaken() throws Exception {
        var state=followEnabled("follow-snooze",1,1);var id=initial(state);
        var date=LocalDate.of(2026,10,7);
        var view=followUps.action(principal,state.id(),product.getId(),date,"09:00","SNOOZE");
        assertThat(view.status()).isEmpty();assertThat(view.nextReminderAt()).isEqualTo(Instant.parse("2026-10-07T00:15:10Z"));
        at("2026-10-07T00:01:10Z");scheduler.tick();verify(sender,times(1)).send(any(),any());
        at("2026-10-07T00:15:10Z");scheduler.tick();scheduler.tick();verify(sender,times(2)).send(any(),any());
        assertThat(followUpStore.find(id,date).sentCount()).isEqualTo(1);
    }
    @Test void explicitSnoozeWorksWithoutAutomaticFollowUpsButNeverPastThreeExtraSends() throws Exception {
        var state=connect("follow-snooze-manual");initial(state);var date=LocalDate.of(2026,10,7);
        for(int count=1;count<=3;count++) {
            var view=followUps.action(principal,state.id(),product.getId(),date,"09:00","SNOOZE");
            when(clock.instant()).thenReturn(view.nextReminderAt());scheduler.tick();scheduler.tick();
        }
        verify(sender,times(4)).send(any(),any());
        assertThat(followUps.view(principal,state.id(),product.getId(),date,"09:00").canSnooze()).isFalse();
        assertThatThrownBy(()->followUps.action(principal,state.id(),product.getId(),date,"09:00","SNOOZE"))
            .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }
    @Test void reminderActionsAreIdempotentAndRejectWrongDeviceFutureDatesAndOtherUsers() throws Exception {
        var state=followEnabled("follow-actions",1,1);initial(state);var date=LocalDate.of(2026,10,7);
        for(var invalidDate:List.of(date.minusDays(1),date.plusDays(1))) {
            mvc.perform(post("/api/web-push/subscriptions/"+state.id()+"/doses/"+product.getId()).header("Authorization","Bearer "+token)
                .contentType("application/json").content(json.writeValueAsString(Map.of("doseDate",invalidDate.toString(),"doseTime","09:00","action","TAKEN"))))
                .andExpect(status().isConflict());
        }
        var stranger=users.save(new User(UUID.randomUUID()+"@example.com","hash"));var strangerToken=sessions.issue(stranger).token();
        mvc.perform(get("/api/web-push/subscriptions/"+state.id()+"/doses/"+product.getId()).header("Authorization","Bearer "+strangerToken)
            .param("doseDate",date.toString()).param("doseTime","09:00")).andExpect(status().isNotFound());
        followUps.action(principal,state.id(),product.getId(),date,"09:00","TAKEN");
        assertThat(followUps.action(principal,state.id(),product.getId(),date,"09:00","SKIPPED").status()).isEqualTo("TAKEN");
        assertThat(logs.findBySupplementIdAndDoseDate(product.getId(),date)).hasSize(1);
    }
    @Test void followUpTransientRetriesAreBoundedAndExpiredEndpointsStopTheDevice() throws Exception {
        var state=followEnabled("follow-retry",1,1);var id=initial(state);
        when(sender.send(any(),any())).thenReturn(503,201);
        at("2026-10-07T00:01:10Z");scheduler.tick();scheduler.tick();verify(sender,times(2)).send(any(),any());
        at("2026-10-07T00:01:40Z");scheduler.tick();scheduler.tick();verify(sender,times(3)).send(any(),any());
        assertThat(followUpStore.find(id,LocalDate.of(2026,10,7)).sentCount()).isEqualTo(1);
        followUps.action(principal,state.id(),product.getId(),LocalDate.of(2026,10,7),"09:00","SNOOZE");
        when(sender.send(any(),any())).thenReturn(410);at("2026-10-07T00:16:40Z");scheduler.tick();
        assertThat(service.state(principal,state.id()).enabled()).isFalse();
    }
    @Test void logoutAndReminderDeletionPreventQueuedFollowUps() throws Exception {
        var state=followEnabled("follow-logout",1,1);initial(state);
        sessions.revoke(principal.sessionId());entityManager.flush();at("2026-10-07T00:01:10Z");scheduler.tick();
        verify(sender,times(1)).send(any(),any());
        assertThat(followUpStore.due(clock.instant())).isEmpty();
    }
    private WebPushService.State followEnabled(String suffix,int minutes,int count) throws Exception {
        var state=connect(suffix);service.setFollowUp(principal,state.id(),new FollowUpSettings(true,minutes,count,false,"22:00","08:00"));return state;
    }
    private long initial(WebPushService.State state) {
        service.setTimes(principal,state.id(),product.getId(),List.of("09:00"));
        var id=store.reminderId(state.id(),product.getId(),"09:00");at("2026-10-07T00:00:10Z");scheduler.tick();return id;
    }
    private void at(String instant) { when(clock.instant()).thenReturn(Instant.parse(instant)); }
    private WebPushService.State connect(String suffix) throws Exception { return service.connect(principal,"https://web.push.apple.com/"+suffix,key,auth,"Asia/Seoul"); }
    private UserSupplement product(User owner,String times) {
        var scan=scans.save(new SupplementScan(owner,"{}","COMPLETED"));return supplements.saveAndFlush(new UserSupplement(owner,scan,"PILL LAB","마그네슘","하루 1회","","","","",times));
    }
}
