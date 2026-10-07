package com.pill;

import com.pill.gemini.GeminiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(GeminiProperties.class)
public class PillApplication {
    public static void main(String[] args) {
        SpringApplication.run(PillApplication.class, args);
    }
}
