-- Create system_messages table
CREATE TABLE IF NOT EXISTS system_messages (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  severity ENUM('info', 'warning', 'error') DEFAULT 'info',
  broadcast_to ENUM('all_users', 'specific_role', 'specific_user') DEFAULT 'all_users',
  target_role VARCHAR(50),
  target_user_id VARCHAR(36),
  created_by_user_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_created_at (created_at),
  INDEX idx_broadcast_to (broadcast_to),
  INDEX idx_severity (severity)
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  value LONGTEXT,
  data_type VARCHAR(50),
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_setting_key (setting_key)
);

-- Insert default system settings
INSERT IGNORE INTO system_settings (setting_key, value, data_type, description) VALUES
('maintenance_mode', 'false', 'boolean', 'Enable/disable maintenance mode for the entire platform'),
('maintenance_message', 'System is under maintenance. We will be back soon!', 'string', 'Message displayed when maintenance mode is enabled'),
('max_users', '10000', 'integer', 'Maximum number of active users allowed'),
('max_concurrent_sessions', '5000', 'integer', 'Maximum concurrent user sessions'),
('email_notifications_enabled', 'true', 'boolean', 'Enable/disable email notifications'),
('two_factor_auth_required', 'false', 'boolean', 'Require 2FA for all admins'),
('session_timeout_minutes', '30', 'integer', 'User session timeout in minutes'),
('password_expiry_days', '90', 'integer', 'Password expiry period in days'),
('audit_log_retention_days', '365', 'integer', 'How long to keep audit logs'),
('backup_frequency', 'daily', 'string', 'Backup frequency (daily, weekly, monthly)');
