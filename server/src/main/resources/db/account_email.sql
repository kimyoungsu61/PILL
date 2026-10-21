CREATE TABLE IF NOT EXISTS account_mail_budget (
 email_hash CHAR(64) PRIMARY KEY,
 last_requested_at DATETIME(6) NULL,
 hour_started_at DATETIME(6) NOT NULL,
 hour_count INT NOT NULL DEFAULT 0,
 day_started_at DATETIME(6) NOT NULL,
 day_count INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account_challenge (
 challenge_key CHAR(64) PRIMARY KEY,
 user_id BIGINT NULL,
 email_hash CHAR(64) NOT NULL,
 purpose VARCHAR(12) NOT NULL,
 generation CHAR(36) NOT NULL,
 code_hash VARCHAR(100) NOT NULL,
 expires_at DATETIME(6) NOT NULL,
 attempts INT NOT NULL DEFAULT 0,
 consumed_at DATETIME(6) NULL,
 created_at DATETIME(6) NOT NULL,
 CONSTRAINT fk_account_challenge_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 INDEX idx_account_challenge_user (user_id),
 INDEX idx_account_challenge_email (email_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification (
 user_id BIGINT PRIMARY KEY,
 email_hash CHAR(64) NOT NULL,
 verified_at DATETIME(6) NOT NULL,
 CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
