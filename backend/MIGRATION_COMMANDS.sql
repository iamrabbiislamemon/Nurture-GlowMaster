-- =====================================================
-- NURTURE-GLOW DATABASE SETUP & MIGRATION COMMANDS
-- =====================================================
-- Quick reference for common database operations

-- =====================================================
-- FRESH INSTALLATION (Clean Setup)
-- =====================================================

-- 1. Drop and recreate database (⚠️ DATA LOSS - Use only for fresh install)
DROP DATABASE IF EXISTS neonest;
CREATE DATABASE neonest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE neonest;

-- 2. Import complete schema
SOURCE database-schema.sql;

-- 3. Verify table creation
SHOW TABLES;
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'neonest';

-- Expected: 58 tables

-- =====================================================
-- UPGRADE EXISTING DATABASE (Safe Migration)
-- =====================================================

-- 1. BACKUP FIRST! (Always backup before migration)
-- Run from command line:
-- mysqldump -u root -p neonest > backup_nurture_glow_$(date +%Y%m%d_%H%M%S).sql

-- 2. Add missing columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS health_id VARCHAR(64) NULL AFTER status,
  ADD COLUMN IF NOT EXISTS health_id_verification_status VARCHAR(20) DEFAULT 'unverified' AFTER health_id,
  ADD COLUMN IF NOT EXISTS health_id_verified_by_hospital_id VARCHAR(36) NULL AFTER health_id_verification_status,
  ADD COLUMN IF NOT EXISTS health_id_verified_at DATETIME NULL AFTER health_id_verified_by_hospital_id,
  ADD COLUMN IF NOT EXISTS hospital_id VARCHAR(36) NULL AFTER health_id_verified_at;

-- 3. Add indexes to users table
CREATE INDEX IF NOT EXISTS idx_health_id ON users(health_id);
CREATE INDEX IF NOT EXISTS idx_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_status ON users(status);

-- 4. Add missing columns to notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id VARCHAR(36) NULL AFTER is_read,
  ADD COLUMN IF NOT EXISTS actor_user_id VARCHAR(36) NULL AFTER recipient_user_id,
  ADD COLUMN IF NOT EXISTS type VARCHAR(60) NULL AFTER actor_user_id,
  ADD COLUMN IF NOT EXISTS payload_json JSON NULL AFTER type;

-- 5. Add foreign keys to notifications
ALTER TABLE notifications 
  ADD CONSTRAINT fk_notifications_recipient 
  FOREIGN KEY IF NOT EXISTS (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notifications 
  ADD CONSTRAINT fk_notifications_actor 
  FOREIGN KEY IF NOT EXISTS (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 6. Create app_entities table (if not exists)
CREATE TABLE IF NOT EXISTS app_entities (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  type VARCHAR(50) NOT NULL,
  subtype VARCHAR(100) NULL,
  data LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_type (type),
  INDEX idx_user_type (user_id, type),
  INDEX idx_user_type_sub (user_id, type, subtype),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Create app_user_meta table (if not exists)
CREATE TABLE IF NOT EXISTS app_user_meta (
  user_id VARCHAR(36) NOT NULL,
  meta_key VARCHAR(50) NOT NULL,
  meta_value VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, meta_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Create app_catalog table (if not exists)
CREATE TABLE IF NOT EXISTS app_catalog (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  data LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_catalog_type (type)
);

-- 9. Create blood_donors table (if not exists)
CREATE TABLE IF NOT EXISTS blood_donors (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  blood_group VARCHAR(10) NOT NULL,
  location VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  available BOOLEAN DEFAULT TRUE,
  last_donation_date DATE NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_blood_group (blood_group),
  INDEX idx_location (location),
  INDEX idx_verified (verified),
  INDEX idx_available (available)
);

-- 10. Create blood_requests table (if not exists)
CREATE TABLE IF NOT EXISTS blood_requests (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  donor_id VARCHAR(36) NOT NULL,
  requester_user_id VARCHAR(36) NULL,
  requester_phone VARCHAR(20) NOT NULL,
  blood_group VARCHAR(10) NOT NULL,
  area VARCHAR(255) NOT NULL,
  message TEXT,
  urgency_level VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'sent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES blood_donors(id) ON DELETE CASCADE,
  FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_blood_group (blood_group),
  INDEX idx_created_at (created_at)
);

-- 11. Create health_id_verification_requests table (if not exists)
CREATE TABLE IF NOT EXISTS health_id_verification_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  hospital_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  request_note VARCHAR(255) NULL,
  rejection_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hiv_user_hospital (user_id, hospital_id, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
);

-- 12. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_status ON consultations(doctor_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON products(category_id, status);

-- 13. Verify migration
SELECT 
  'users' as table_name,
  COUNT(*) as column_count,
  GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) as columns
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'neonest' AND TABLE_NAME = 'users'
UNION ALL
SELECT 
  'New Tables Created',
  COUNT(*),
  GROUP_CONCAT(TABLE_NAME)
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'neonest' 
  AND TABLE_NAME IN ('app_entities', 'app_user_meta', 'app_catalog', 
                      'blood_donors', 'blood_requests', 
                      'health_id_verification_requests');

-- =====================================================
-- ROLLBACK (If migration fails)
-- =====================================================

-- Restore from backup
-- Run from command line:
-- mysql -u root -p neonest < backup_nurture_glow_YYYYMMDD_HHMMSS.sql

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all tables exist
SELECT TABLE_NAME, TABLE_ROWS, 
       ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'neonest'
ORDER BY TABLE_NAME;

-- Check users table structure
DESCRIBE users;

-- Check app_entities table
SELECT type, COUNT(*) as count 
FROM app_entities 
GROUP BY type 
ORDER BY count DESC;

-- Check blood donors
SELECT blood_group, COUNT(*) as donor_count 
FROM blood_donors 
GROUP BY blood_group;

-- Check health ID verification status distribution
SELECT health_id_verification_status, COUNT(*) as count 
FROM users 
GROUP BY health_id_verification_status;

-- =====================================================
-- SEED DATA (Run after schema creation)
-- =====================================================

-- From Node.js
-- node backend/src/seed.js

-- Or manually:
INSERT INTO roles (role_name) VALUES 
  ('USER'), ('DOCTOR'), ('ADMIN') 
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

INSERT INTO doctor_specialties (name) VALUES 
  ('Gynecologist'), ('Pediatrician'), ('Nutritionist'), ('Psychologist') 
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO product_categories (name) VALUES 
  ('Mother Care'), ('Baby Care'), ('Nutrition'), ('Medical Devices') 
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- =====================================================
-- MAINTENANCE QUERIES
-- =====================================================

-- Clean up old notifications (older than 90 days)
DELETE FROM notifications 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY) 
  AND is_read = TRUE;

-- Clean up expired password reset tokens
DELETE FROM password_reset_tokens 
WHERE expires_at < NOW() OR used_at IS NOT NULL;

-- Archive old blood requests (older than 30 days)
DELETE FROM blood_requests 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) 
  AND status = 'sent';

-- Update doctor ratings from reviews
UPDATE doctors d 
SET rating = (
  SELECT AVG(rating) 
  FROM doctor_reviews 
  WHERE doctor_id = d.id
)
WHERE EXISTS (
  SELECT 1 FROM doctor_reviews WHERE doctor_id = d.id
);

-- Optimize tables (run periodically)
OPTIMIZE TABLE app_entities, notifications, blood_requests, audit_logs;

-- =====================================================
-- USEFUL DEVELOPMENT QUERIES
-- =====================================================

-- Get schema version info
SELECT 
  'Schema Version' as info_type,
  '2.0' as value
UNION ALL
SELECT 
  'Total Tables',
  COUNT(*)
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'neonest'
UNION ALL
SELECT 
  'Total Indexes',
  COUNT(*)
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'neonest'
UNION ALL
SELECT 
  'Database Size (MB)',
  ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2)
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'neonest';

-- List all foreign keys
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'neonest'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;
