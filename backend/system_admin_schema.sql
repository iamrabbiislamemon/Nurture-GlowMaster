-- ============================================================================
-- SYSTEM ADMIN TABLES - Database Schema Updates
-- ============================================================================
-- This file contains the database schema additions for the System Admin panel
-- Run this SQL file to add tables for backups, metrics, and admin features
-- ============================================================================

-- System Backups Table
-- Stores database backup metadata
CREATE TABLE IF NOT EXISTS system_backups (
  id VARCHAR(36) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  size_mb DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  status ENUM('PENDING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
  storage_path VARCHAR(500),
  checksum VARCHAR(64),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System Metrics Table
-- Stores system performance metrics over time
CREATE TABLE IF NOT EXISTS system_metrics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10, 2) NOT NULL,
  status ENUM('HEALTHY', 'WARNING', 'CRITICAL') DEFAULT 'HEALTHY',
  uptime_percentage DECIMAL(5, 2),
  response_time_ms INT,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metric_name (metric_name),
  INDEX idx_recorded_at (recorded_at),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Security Events Table (if not exists)
-- Logs security-related events for audit trail
CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(36) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'LOW',
  user_id VARCHAR(36),
  ip_address VARCHAR(45),
  description TEXT,
  metadata JSON,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by VARCHAR(36),
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_event_type (event_type),
  INDEX idx_severity (severity),
  INDEX idx_resolved (resolved),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin Actions Table (if not exists)
-- Logs all administrative actions for accountability
CREATE TABLE IF NOT EXISTS admin_actions (
  id VARCHAR(36) PRIMARY KEY,
  admin_user_id VARCHAR(36) NOT NULL,
  admin_role VARCHAR(50) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  action_category VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id VARCHAR(36),
  target_user_id VARCHAR(36),
  description TEXT,
  severity ENUM('INFO', 'WARNING', 'CRITICAL') DEFAULT 'INFO',
  metadata JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_admin_user (admin_user_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert sample system metrics for testing
INSERT INTO system_metrics (metric_name, metric_value, status, uptime_percentage, response_time_ms) VALUES
('CPU', 45.2, 'HEALTHY', 99.98, 50),
('Memory', 62.1, 'HEALTHY', 99.95, 45),
('Disk', 58.3, 'HEALTHY', 100.00, 30),
('API', 0.5, 'HEALTHY', 99.92, 120);

-- Insert sample security events for testing
INSERT INTO security_events (id, event_type, severity, description, resolved) VALUES
(UUID(), 'LOGIN_ATTEMPT', 'LOW', 'Multiple failed login attempts detected', FALSE),
(UUID(), 'PERMISSION_CHANGE', 'MEDIUM', 'User role changed by administrator', TRUE),
(UUID(), 'DATA_ACCESS', 'HIGH', 'Unusual data access pattern detected', FALSE),
(UUID(), 'SYSTEM_CONFIG', 'CRITICAL', 'Critical system configuration changed', TRUE);

-- Create view for system admin dashboard (if not exists)
CREATE OR REPLACE VIEW v_system_admin_dashboard AS
SELECT
  (SELECT COUNT(*) FROM users WHERE status = 'active') as total_active_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_week,
  (SELECT COUNT(*) FROM security_events WHERE severity IN ('HIGH', 'CRITICAL') AND resolved = FALSE) as critical_security_alerts,
  (SELECT AVG(uptime_percentage) FROM system_metrics WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as avg_uptime_24h,
  (SELECT COUNT(*) FROM admin_actions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as admin_actions_24h;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 1. Connect to your MySQL database
-- 2. Run this SQL file: mysql -u root -p nurture_glow < system_admin_schema.sql
-- 3. Verify tables created: SHOW TABLES;
-- 4. Check sample data: SELECT * FROM system_backups; SELECT * FROM security_events;
-- ============================================================================

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE ON neonest.system_backups TO 'nurture_app'@'%';
GRANT SELECT, INSERT ON neonest.system_metrics TO 'nurture_app'@'%';
GRANT SELECT, INSERT, UPDATE ON neonest.security_events TO 'nurture_app'@'%';
GRANT SELECT, INSERT ON neonest.admin_actions TO 'nurture_app'@'%';
FLUSH PRIVILEGES;

-- ============================================================================
-- CLEANUP (Optional - use if you need to reset tables)
-- ============================================================================
-- DROP TABLE IF EXISTS system_backups;
-- DROP TABLE IF EXISTS system_metrics;
-- DROP TABLE IF EXISTS security_events;
-- DROP TABLE IF EXISTS admin_actions;
-- DROP VIEW IF EXISTS v_system_admin_dashboard;
-- ============================================================================
