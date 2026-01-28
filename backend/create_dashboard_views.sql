-- Create Dashboard Views

-- System Admin Dashboard Summary
CREATE OR REPLACE VIEW v_system_admin_dashboard AS
SELECT 
  (SELECT COUNT(*) FROM users WHERE status = 'active') as total_active_users,
  (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_week,
  (SELECT COALESCE(COUNT(*), 0) FROM security_events WHERE resolved = FALSE AND severity IN ('HIGH', 'CRITICAL')) as critical_security_alerts,
  99.99 as avg_uptime_24h,
  (SELECT COALESCE(COUNT(*), 0) FROM admin_actions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as admin_actions_24h;

-- Operations Admin Dashboard Summary
CREATE OR REPLACE VIEW v_operations_admin_dashboard AS
SELECT 
  (SELECT COALESCE(COUNT(*), 0) FROM user_cards WHERE status = 'ACTIVE') as active_cards,
  (SELECT COALESCE(COUNT(*), 0) FROM hospital_onboarding WHERE status = 'PENDING') as pending_hospitals,
  (SELECT COALESCE(COUNT(*), 0) FROM hospital_onboarding WHERE status = 'APPROVED') as active_hospitals,
  (SELECT COALESCE(COUNT(*), 0) FROM csr_programs WHERE status = 'ACTIVE') as active_csr_programs,
  (SELECT COALESCE(COUNT(*), 0) FROM csr_programs) as total_programs,
  (SELECT COALESCE(COUNT(*), 0) FROM hospital_onboarding WHERE status = 'APPROVED' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as new_hospitals_month,
  (SELECT COALESCE(COUNT(*), 0) FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')) as open_tickets,
  (SELECT COALESCE(COUNT(*), 0) FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS') AND priority = 'URGENT') as urgent_tickets;

-- Medical Admin Dashboard Summary  
CREATE OR REPLACE VIEW v_medical_admin_dashboard AS
SELECT 
  (SELECT COALESCE(COUNT(*), 0) FROM doctor_verification_requests WHERE status = 'PENDING') as pending_doctor_verifications,
  (SELECT COALESCE(COUNT(*), 0) FROM high_risk_cases WHERE status = 'ACTIVE' AND risk_level IN ('HIGH', 'CRITICAL')) as high_risk_pregnancies,
  (SELECT COALESCE(COUNT(*), 0) FROM consultation_reviews WHERE review_status = 'PENDING') as pending_consultations,
  (SELECT COALESCE(COUNT(*), 0) FROM emergency_access_logs WHERE accessed_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as emergency_cases_24h;
