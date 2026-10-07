CREATE TABLE IF NOT EXISTS web_push_subscription (
 id VARCHAR(36) PRIMARY KEY,
 user_id BIGINT NOT NULL,
 session_id BIGINT NOT NULL,
 endpoint TEXT NOT NULL,
 endpoint_hash CHAR(64) NOT NULL UNIQUE,
 p256dh VARCHAR(160) NOT NULL,
 auth_secret VARCHAR(40) NOT NULL,
 zone_id VARCHAR(60) NOT NULL,
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(6) NOT NULL,
 updated_at DATETIME(6) NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id),
 FOREIGN KEY (session_id) REFERENCES auth_session(id)
);
CREATE TABLE IF NOT EXISTS web_push_reminder (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 subscription_id VARCHAR(36) NOT NULL,
 supplement_id BIGINT NOT NULL,
 dose_time VARCHAR(5) NOT NULL,
 created_at DATETIME(6) NOT NULL,
 UNIQUE (subscription_id, supplement_id, dose_time),
 FOREIGN KEY (subscription_id) REFERENCES web_push_subscription(id) ON DELETE CASCADE,
 FOREIGN KEY (supplement_id) REFERENCES user_supplement(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS web_push_delivery (
 id BIGINT PRIMARY KEY AUTO_INCREMENT,
 reminder_id BIGINT NOT NULL,
 dose_date DATE NOT NULL,
 status VARCHAR(16) NOT NULL,
 attempts INT NOT NULL,
 next_attempt_at DATETIME(6) NOT NULL,
 UNIQUE (reminder_id, dose_date),
 FOREIGN KEY (reminder_id) REFERENCES web_push_reminder(id) ON DELETE CASCADE
);
