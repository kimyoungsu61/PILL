package com.pill.account;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AccountMailConfiguration {
    @Bean(name = "accountMailExecutor")
    ThreadPoolTaskExecutor accountMailExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1); executor.setMaxPoolSize(2); executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("pill-account-mail-");
        executor.setWaitForTasksToCompleteOnShutdown(false);
        return executor;
    }
}
