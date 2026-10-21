package com.pill.account;

import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AccountMailDeliveryTest {
    @Test void deletedOrSupersededQueuedChallengeIsNeverMailed() throws Exception {
        var db=mock(JdbcTemplate.class); var sender=mock(AccountMailSender.class);
        var pending=new ArrayList<Runnable>();
        var delivery=new AccountMailDelivery(sender,db,pending::add,Clock.fixed(Instant.EPOCH,ZoneOffset.UTC),mock(PlatformTransactionManager.class));
        when(db.queryForObject(anyString(),eq(Integer.class),eq("key"),eq("generation"),any(LocalDateTime.class))).thenReturn(0);
        delivery.enqueue("test@example.test","123456","VERIFY","key","generation");
        assertThat(pending).hasSize(1);
        pending.getFirst().run();
        verifyNoInteractions(sender);
    }

    @Test void providerFailureInvalidatesOnlyItsGenerationAndLeavesBudgetUntouched() throws Exception {
        var db=mock(JdbcTemplate.class); var sender=mock(AccountMailSender.class);
        var delivery=new AccountMailDelivery(sender,db,Runnable::run,Clock.fixed(Instant.EPOCH,ZoneOffset.UTC),mock(PlatformTransactionManager.class));
        when(db.queryForObject(anyString(),eq(Integer.class),eq("key"),eq("generation"),any(LocalDateTime.class))).thenReturn(1);
        doThrow(new IOException("provider failure with private recipient data")).when(sender).send(anyString(),anyString(),anyString(),anyString());
        delivery.enqueue("test@example.test","123456","RESET","key","generation");
        verify(db).update(startsWith("UPDATE account_challenge SET consumed_at="),any(LocalDateTime.class),eq("key"),eq("generation"));
        verify(db,never()).update(contains("account_mail_budget"),any(Object[].class));
    }

    @Test void rejectedQueueAlsoInvalidatesChallengeWithoutSynchronousFallbackSend() throws Exception {
        var db=mock(JdbcTemplate.class); var sender=mock(AccountMailSender.class);
        var delivery=new AccountMailDelivery(sender,db,task->{throw new java.util.concurrent.RejectedExecutionException();},Clock.fixed(Instant.EPOCH,ZoneOffset.UTC),mock(PlatformTransactionManager.class));
        delivery.enqueue("test@example.test","123456","VERIFY","key","generation");
        verify(db).update(startsWith("UPDATE account_challenge SET consumed_at="),any(LocalDateTime.class),eq("key"),eq("generation"));
        verifyNoInteractions(sender);
    }
}
