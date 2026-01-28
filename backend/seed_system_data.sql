INSERT INTO system_settings (setting_key, value, data_type, description) VALUES
('maintenance_mode', 'false', 'boolean', 'Enable/disable maintenance mode'),
('maintenance_message', 'System is under maintenance', 'string', 'Maintenance message'),
('max_users', '10000', 'integer', 'Maximum users'),
('email_notifications', 'true', 'boolean', 'Email notifications');

INSERT INTO system_messages (id, title, content, severity, broadcast_to, created_by_user_id) 
SELECT 
  UUID(), 
  'System Maintenance Scheduled',
  'Scheduled maintenance will occur on January 26, 2026 from 2:00 AM to 4:00 AM EST',
  'warning',
  'all_users',
  id
FROM users WHERE role = 'system_admin' LIMIT 1;

INSERT INTO system_messages (id, title, content, severity, broadcast_to, created_by_user_id) 
SELECT 
  UUID(), 
  'New Security Features Available',
  'We have deployed new security features. Please update your password at your earliest convenience.',
  'info',
  'all_users',
  id
FROM users WHERE role = 'system_admin' LIMIT 1;
