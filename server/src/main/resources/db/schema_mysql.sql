CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_session (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  revoked_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT uq_auth_session_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_auth_session_user (user_id),
  INDEX idx_auth_session_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplement_scan (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  image_metadata JSON NULL,
  status VARCHAR(32) NOT NULL,
  raw_ai_response_json JSON NULL,
  normalized_ai_result_json JSON NULL,
  failure_reason TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scan_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_scan_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_supplement (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  scan_id BIGINT NOT NULL,
  brand_name VARCHAR(255) NULL,
  product_name VARCHAR(255) NULL,
  display_name_ko VARCHAR(255) NULL,
  image_uri TEXT NULL,
  suggested_use_ko TEXT NULL,
  suggested_use_original TEXT NULL,
  serving_basis_ko VARCHAR(255) NULL,
  summary_ko TEXT NULL,
  original_label_text MEDIUMTEXT NULL,
  warning_summary TEXT NULL,
  confirmed_dose_time VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_supplement_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_supplement_scan FOREIGN KEY (scan_id) REFERENCES supplement_scan(id),
  INDEX idx_user_supplement_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_supplement_ingredient (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  supplement_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  amount VARCHAR(80) NULL,
  unit VARCHAR(40) NULL,
  original_text TEXT NULL,
  confidence DECIMAL(5,2) NULL,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ingredient_supplement FOREIGN KEY (supplement_id) REFERENCES user_supplement(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blocked_ingredient (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  aliases JSON NOT NULL,
  warning_message TEXT NOT NULL,
  source_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_blocked_ingredient_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplement_warning (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  supplement_id BIGINT NOT NULL,
  ingredient_id BIGINT NOT NULL,
  matched_text VARCHAR(255) NOT NULL,
  warning_message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_warning_supplement FOREIGN KEY (supplement_id) REFERENCES user_supplement(id),
  CONSTRAINT fk_warning_blocked FOREIGN KEY (ingredient_id) REFERENCES blocked_ingredient(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dose_schedule (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  supplement_id BIGINT NOT NULL,
  recommended_time VARCHAR(20) NULL,
  confirmed_time VARCHAR(20) NULL,
  repeat_days VARCHAR(80) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI,SAT,SUN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_supplement FOREIGN KEY (supplement_id) REFERENCES user_supplement(id),
  INDEX idx_schedule_supplement_confirmed (supplement_id, confirmed_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dose_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  supplement_id BIGINT NOT NULL,
  dose_date DATE NOT NULL,
  dose_time VARCHAR(20) NULL,
  status VARCHAR(20) NOT NULL,
  checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  memo TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dose_log_supplement FOREIGN KEY (supplement_id) REFERENCES user_supplement(id),
  CONSTRAINT uq_dose_log_once UNIQUE (supplement_id, dose_date, dose_time),
  INDEX idx_dose_log_supplement_date (supplement_id, dose_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
