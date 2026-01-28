-- Health ID verification workflow migrations
-- Note: Adjust column types if your users/hospitals IDs differ.

ALTER TABLE users
  ADD COLUMN health_id VARCHAR(64) NULL,
  ADD COLUMN health_id_verification_status ENUM('unverified','pending','accepted','rejected') NOT NULL DEFAULT 'unverified',
  ADD COLUMN health_id_verified_by_hospital_id VARCHAR(36) NULL,
  ADD COLUMN health_id_verified_at DATETIME NULL,
  ADD COLUMN role ENUM('mother','father','doctor','pharmacist','nutritionist','merchandiser','medical_admin','system_admin','merchant','hospital') NOT NULL DEFAULT 'mother',
  ADD COLUMN hospital_id VARCHAR(36) NULL;

CREATE TABLE IF NOT EXISTS health_id_verification_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  hospital_id VARCHAR(36) NOT NULL,
  status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  request_note VARCHAR(255) NULL,
  rejection_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hiv_user_hospital (user_id, hospital_id, status),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE notifications
  ADD COLUMN recipient_user_id VARCHAR(36) NULL,
  ADD COLUMN actor_user_id VARCHAR(36) NULL,
  ADD COLUMN type VARCHAR(60) NULL,
  ADD COLUMN payload_json JSON NULL;
