-- ============================================================================
-- ADMIN SYSTEM TABLES - Nurture-Glow
-- Created: January 26, 2026
-- Purpose: Complete admin dashboard functionality with dynamic data
-- ============================================================================

-- Admin Actions Log (for all admin activities across the system)
CREATE TABLE IF NOT EXISTS `admin_actions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `admin_user_id` VARCHAR(36) NOT NULL,
  `admin_role` VARCHAR(50) NOT NULL,
  `action_type` VARCHAR(100) NOT NULL,
  `action_category` ENUM('USER_MANAGEMENT', 'SECURITY', 'OPERATIONS', 'MEDICAL', 'SYSTEM', 'AUDIT') NOT NULL,
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(36),
  `target_user_id` VARCHAR(36) NULL,
  `description` VARCHAR(500),
  `metadata` JSON,
  `ip_address` VARCHAR(45),
  `severity` ENUM('INFO', 'WARNING', 'CRITICAL') DEFAULT 'INFO',
  `status` ENUM('SUCCESS', 'FAILED', 'PENDING') DEFAULT 'SUCCESS',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`admin_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_admin_actions_user` (`admin_user_id`),
  INDEX `idx_admin_actions_category` (`action_category`),
  INDEX `idx_admin_actions_created` (`created_at`),
  INDEX `idx_admin_actions_severity` (`severity`)
);

-- System Metrics (for System Admin dashboard)
CREATE TABLE IF NOT EXISTS `system_metrics` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `metric_type` VARCHAR(100) NOT NULL,
  `metric_name` VARCHAR(100) NOT NULL,
  `metric_value` DECIMAL(15,2) NOT NULL,
  `metric_unit` VARCHAR(50),
  `status` ENUM('HEALTHY', 'WARNING', 'CRITICAL') DEFAULT 'HEALTHY',
  `response_time_ms` INT,
  `uptime_percentage` DECIMAL(5,2),
  `metadata` JSON,
  `recorded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_metrics_type` (`metric_type`),
  INDEX `idx_metrics_recorded` (`recorded_at`)
);

-- Security Events (for System Admin dashboard)
CREATE TABLE IF NOT EXISTS `security_events` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `event_type` ENUM('FAILED_LOGIN', 'UNAUTHORIZED_ACCESS', 'SUSPICIOUS_ACTIVITY', 'ROLE_CHANGE', 'PASSWORD_CHANGE', 'DATA_EXPORT', 'BRUTE_FORCE') NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `ip_address` VARCHAR(45),
  `user_agent` VARCHAR(500),
  `description` VARCHAR(500) NOT NULL,
  `metadata` JSON,
  `resolved` BOOLEAN DEFAULT FALSE,
  `resolved_by` VARCHAR(36) NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_security_events_type` (`event_type`),
  INDEX `idx_security_events_severity` (`severity`),
  INDEX `idx_security_events_resolved` (`resolved`),
  INDEX `idx_security_events_created` (`created_at`)
);

-- Hospital Onboarding (for Operations Admin)
CREATE TABLE IF NOT EXISTS `hospital_onboarding` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `hospital_name` VARCHAR(255) NOT NULL,
  `hospital_type` ENUM('PUBLIC', 'PRIVATE', 'NGO', 'SPECIALIZED') NOT NULL,
  `contact_person` VARCHAR(255) NOT NULL,
  `contact_email` VARCHAR(255) NOT NULL,
  `contact_phone` VARCHAR(20) NOT NULL,
  `address` VARCHAR(500) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `district` VARCHAR(100) NOT NULL,
  `bed_capacity` INT,
  `license_number` VARCHAR(100),
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'SUSPENDED') DEFAULT 'PENDING',
  `submitted_by` VARCHAR(36) NULL,
  `reviewed_by` VARCHAR(36) NULL,
  `review_notes` TEXT,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_hospital_onboarding_status` (`status`),
  INDEX `idx_hospital_onboarding_created` (`created_at`)
);

-- Card Batches (for Operations Admin)
CREATE TABLE IF NOT EXISTS `card_batches` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `batch_number` VARCHAR(100) NOT NULL UNIQUE,
  `card_type` VARCHAR(50) NOT NULL,
  `quantity` INT NOT NULL,
  `activated_count` INT DEFAULT 0,
  `assigned_count` INT DEFAULT 0,
  `status` ENUM('PENDING', 'ACTIVE', 'DEPLETED', 'EXPIRED') DEFAULT 'PENDING',
  `activation_date` DATETIME NULL,
  `expiry_date` DATETIME NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_card_batches_status` (`status`),
  INDEX `idx_card_batches_batch_number` (`batch_number`)
);

-- User Cards (for Operations Admin)
CREATE TABLE IF NOT EXISTS `user_cards` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `batch_id` VARCHAR(36) NOT NULL,
  `card_number` VARCHAR(100) NOT NULL UNIQUE,
  `card_type` VARCHAR(50) NOT NULL,
  `status` ENUM('INACTIVE', 'ACTIVE', 'SUSPENDED', 'EXPIRED') DEFAULT 'INACTIVE',
  `balance` DECIMAL(10,2) DEFAULT 0.00,
  `activation_date` DATETIME NULL,
  `last_used_at` DATETIME NULL,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`batch_id`) REFERENCES `card_batches` (`id`) ON DELETE CASCADE,
  INDEX `idx_user_cards_user` (`user_id`),
  INDEX `idx_user_cards_status` (`status`),
  INDEX `idx_user_cards_card_number` (`card_number`)
);

-- CSR Programs (for Operations Admin)
CREATE TABLE IF NOT EXISTS `csr_programs` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `program_name` VARCHAR(255) NOT NULL,
  `sponsor_name` VARCHAR(255) NOT NULL,
  `sponsor_contact` VARCHAR(255),
  `program_type` VARCHAR(100) NOT NULL,
  `budget` DECIMAL(15,2),
  `beneficiary_count` INT DEFAULT 0,
  `target_beneficiaries` INT,
  `status` ENUM('PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNING',
  `start_date` DATE,
  `end_date` DATE,
  `description` TEXT,
  `managed_by` VARCHAR(36) NOT NULL,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`managed_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_csr_programs_status` (`status`),
  INDEX `idx_csr_programs_dates` (`start_date`, `end_date`)
);

-- Call Center Tickets (for Operations Admin)
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `ticket_number` VARCHAR(50) NOT NULL UNIQUE,
  `user_id` VARCHAR(36) NULL,
  `user_name` VARCHAR(255),
  `user_phone` VARCHAR(20),
  `category` ENUM('CARD_ISSUE', 'HOSPITAL_ACCESS', 'TECHNICAL', 'GENERAL', 'EMERGENCY', 'COMPLAINT') NOT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
  `subject` VARCHAR(500) NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED') DEFAULT 'OPEN',
  `assigned_to` VARCHAR(36) NULL,
  `resolved_by` VARCHAR(36) NULL,
  `resolution_notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` DATETIME NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_support_tickets_status` (`status`),
  INDEX `idx_support_tickets_priority` (`priority`),
  INDEX `idx_support_tickets_user` (`user_id`),
  INDEX `idx_support_tickets_created` (`created_at`)
);

-- Doctor Verification Requests (for Medical Admin)
CREATE TABLE IF NOT EXISTS `doctor_verification_requests` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `doctor_name` VARCHAR(255) NOT NULL,
  `specialty` VARCHAR(255) NOT NULL,
  `hospital_affiliation` VARCHAR(255),
  `bmdc_reg_number` VARCHAR(100),
  `bmdc_certificate_url` VARCHAR(500),
  `experience_years` INT,
  `qualifications` TEXT,
  `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED') DEFAULT 'PENDING',
  `reviewed_by` VARCHAR(36) NULL,
  `review_notes` TEXT,
  `rejection_reason` TEXT,
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  `metadata` JSON,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_doctor_verif_status` (`status`),
  INDEX `idx_doctor_verif_user` (`user_id`),
  INDEX `idx_doctor_verif_submitted` (`submitted_at`)
);

-- High-Risk Pregnancy Cases (for Medical Admin)
CREATE TABLE IF NOT EXISTS `high_risk_cases` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `patient_user_id` VARCHAR(36) NOT NULL,
  `risk_level` ENUM('MODERATE', 'HIGH', 'CRITICAL') NOT NULL,
  `risk_factors` JSON NOT NULL,
  `symptoms` TEXT,
  `current_week` INT,
  `assigned_doctor_id` VARCHAR(36) NULL,
  `monitoring_frequency` VARCHAR(100),
  `last_checkup` DATETIME NULL,
  `next_checkup` DATETIME NULL,
  `status` ENUM('ACTIVE', 'RESOLVED', 'EMERGENCY', 'HOSPITALIZED') DEFAULT 'ACTIVE',
  `flagged_by` VARCHAR(36) NOT NULL,
  `flagged_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT,
  `metadata` JSON,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`patient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_doctor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`flagged_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_high_risk_patient` (`patient_user_id`),
  INDEX `idx_high_risk_level` (`risk_level`),
  INDEX `idx_high_risk_status` (`status`),
  INDEX `idx_high_risk_flagged` (`flagged_at`)
);

-- Consultation Quality Reviews (for Medical Admin)
CREATE TABLE IF NOT EXISTS `consultation_reviews` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `consultation_id` VARCHAR(36) NOT NULL,
  `doctor_id` VARCHAR(36) NOT NULL,
  `patient_id` VARCHAR(36) NOT NULL,
  `review_status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'FLAGGED', 'ESCALATED') DEFAULT 'PENDING',
  `quality_score` INT,
  `completeness_score` INT,
  `professionalism_score` INT,
  `review_notes` TEXT,
  `flagged_issues` JSON,
  `reviewed_by` VARCHAR(36) NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `metadata` JSON,
  FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_consultation_reviews_status` (`review_status`),
  INDEX `idx_consultation_reviews_doctor` (`doctor_id`),
  INDEX `idx_consultation_reviews_created` (`created_at`)
);

-- Emergency Access Logs (for Medical Admin)
CREATE TABLE IF NOT EXISTS `emergency_access_logs` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `accessor_user_id` VARCHAR(36) NOT NULL,
  `accessor_role` VARCHAR(50) NOT NULL,
  `patient_user_id` VARCHAR(36) NOT NULL,
  `access_type` VARCHAR(100) NOT NULL,
  `reason` TEXT NOT NULL,
  `emergency_level` ENUM('STANDARD', 'HIGH', 'CRITICAL') NOT NULL,
  `data_accessed` JSON,
  `approved_by` VARCHAR(36) NULL,
  `approval_status` ENUM('AUTO_APPROVED', 'PENDING', 'APPROVED', 'REJECTED') DEFAULT 'AUTO_APPROVED',
  `ip_address` VARCHAR(45),
  `accessed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  `metadata` JSON,
  FOREIGN KEY (`accessor_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`patient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_emergency_access_accessor` (`accessor_user_id`),
  INDEX `idx_emergency_access_patient` (`patient_user_id`),
  INDEX `idx_emergency_access_level` (`emergency_level`),
  INDEX `idx_emergency_access_accessed` (`accessed_at`)
);

-- Admin Notifications (cross-admin communication)
CREATE TABLE IF NOT EXISTS `admin_notifications` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `sender_user_id` VARCHAR(36) NULL,
  `recipient_user_id` VARCHAR(36) NOT NULL,
  `notification_type` VARCHAR(100) NOT NULL,
  `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `action_required` BOOLEAN DEFAULT FALSE,
  `action_type` VARCHAR(100),
  `related_entity_type` VARCHAR(100),
  `related_entity_id` VARCHAR(36),
  `is_read` BOOLEAN DEFAULT FALSE,
  `read_at` DATETIME NULL,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_admin_notif_recipient` (`recipient_user_id`),
  INDEX `idx_admin_notif_read` (`is_read`),
  INDEX `idx_admin_notif_created` (`created_at`)
);

-- Admin-to-Admin Interactions (dependency tracking)
CREATE TABLE IF NOT EXISTS `admin_interactions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `initiator_user_id` VARCHAR(36) NOT NULL,
  `initiator_role` VARCHAR(50) NOT NULL,
  `target_user_id` VARCHAR(36) NOT NULL,
  `target_role` VARCHAR(50) NOT NULL,
  `interaction_type` ENUM('APPROVAL_REQUEST', 'INFORMATION_REQUEST', 'ESCALATION', 'HANDOVER', 'COLLABORATION', 'ALERT') NOT NULL,
  `subject` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(36),
  `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  `response` TEXT,
  `responded_at` DATETIME NULL,
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`initiator_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_admin_interact_initiator` (`initiator_user_id`),
  INDEX `idx_admin_interact_target` (`target_user_id`),
  INDEX `idx_admin_interact_status` (`status`),
  INDEX `idx_admin_interact_type` (`interaction_type`)
);

-- Hospital Performance Metrics (for Operations Admin dashboard)
CREATE TABLE IF NOT EXISTS `hospital_performance` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `hospital_id` VARCHAR(36) NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `active_mothers_count` INT DEFAULT 0,
  `services_provided_count` INT DEFAULT 0,
  `consultations_count` INT DEFAULT 0,
  `average_rating` DECIMAL(3,2),
  `total_revenue` DECIMAL(15,2),
  `health_id_verifications` INT DEFAULT 0,
  `status` ENUM('OPERATIONAL', 'UNDERPERFORMING', 'SUSPENDED') DEFAULT 'OPERATIONAL',
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE,
  INDEX `idx_hospital_perf_hospital` (`hospital_id`),
  INDEX `idx_hospital_perf_period` (`period_start`, `period_end`)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX `idx_admin_actions_role_created` ON `admin_actions` (`admin_role`, `created_at`);
CREATE INDEX `idx_security_events_severity_resolved` ON `security_events` (`severity`, `resolved`);
CREATE INDEX `idx_support_tickets_priority_status` ON `support_tickets` (`priority`, `status`);
CREATE INDEX `idx_doctor_verif_status_submitted` ON `doctor_verification_requests` (`status`, `submitted_at`);
CREATE INDEX `idx_high_risk_status_level` ON `high_risk_cases` (`status`, `risk_level`);

-- ============================================================================
-- VIEWS FOR ADMIN DASHBOARDS
-- ============================================================================

-- System Admin Dashboard Summary
CREATE OR REPLACE VIEW `v_system_admin_dashboard` AS
SELECT 
  (SELECT COUNT(*) FROM users WHERE status = 'active') as total_active_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_week,
  (SELECT COUNT(*) FROM security_events WHERE resolved = FALSE AND severity IN ('HIGH', 'CRITICAL')) as critical_security_alerts,
  (SELECT AVG(metric_value) FROM system_metrics WHERE metric_type = 'uptime' AND recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as avg_uptime_24h,
  (SELECT COUNT(*) FROM admin_actions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as admin_actions_24h;

-- Operations Admin Dashboard Summary
CREATE OR REPLACE VIEW `v_operations_admin_dashboard` AS
SELECT 
  (SELECT COUNT(*) FROM user_cards WHERE status = 'ACTIVE') as active_cards,
  (SELECT COUNT(*) FROM hospital_onboarding WHERE status = 'PENDING') as pending_hospitals,
  (SELECT COUNT(*) FROM csr_programs WHERE status = 'ACTIVE') as active_csr_programs,
  (SELECT COUNT(*) FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS') AND priority = 'URGENT') as urgent_tickets,
  (SELECT COUNT(*) FROM hospital_onboarding WHERE status = 'APPROVED' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as new_hospitals_month;

-- Medical Admin Dashboard Summary
CREATE OR REPLACE VIEW `v_medical_admin_dashboard` AS
SELECT 
  (SELECT COUNT(*) FROM doctor_verification_requests WHERE status = 'PENDING') as pending_doctor_verifications,
  (SELECT COUNT(*) FROM high_risk_cases WHERE status = 'ACTIVE' AND risk_level IN ('HIGH', 'CRITICAL')) as high_risk_pregnancies,
  (SELECT COUNT(*) FROM consultation_reviews WHERE review_status = 'PENDING') as pending_consultations,
  (SELECT COUNT(*) FROM emergency_access_logs WHERE accessed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as emergency_cases_24h;

-- ============================================================================
-- INITIAL DATA SEED
-- ============================================================================

-- Insert initial system metrics
INSERT IGNORE INTO `system_metrics` (`id`, `metric_type`, `metric_name`, `metric_value`, `metric_unit`, `status`, `response_time_ms`, `uptime_percentage`, `recorded_at`) VALUES
(1, 'api_server', 'API Server', 1, 'status', 'HEALTHY', 45, 99.99, NOW()),
(2, 'database', 'Database', 1, 'status', 'HEALTHY', 12, 99.97, NOW()),
(3, 'storage', 'Storage', 1, 'status', 'WARNING', 78, 99.85, NOW()),
(4, 'email_service', 'Email Service', 1, 'status', 'HEALTHY', 234, 99.92, NOW());

-- ============================================================================
-- END OF ADMIN TABLES SCHEMA
-- ============================================================================
