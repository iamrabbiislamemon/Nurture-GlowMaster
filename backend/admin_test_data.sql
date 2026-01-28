-- ============================================================================
-- ADMIN SYSTEM TEST DATA SEED
-- Purpose: Create test admin accounts for System, Operations, and Medical admins
-- ============================================================================

-- Create System Admin test account
INSERT INTO `users` (`id`, `phone`, `email`, `password_hash`, `role`, `status`, `created_at`) 
VALUES (
  'admin-system-001',
  '+8801700000001', 
  'system.admin@nurture.com',
  '$2a$10$Xw.YhbpF5WIhjzB2yluh1etE720roGJ80L6s6wqapFKPdg5HMkEUy',
  'system_admin',
  'active',
  NOW()
) ON DUPLICATE KEY UPDATE email=email;

-- Create Operations Admin test account
INSERT INTO `users` (`id`, `phone`, `email`, `password_hash`, `role`, `status`, `created_at`) 
VALUES (
  'admin-ops-001',
  '+8801700000002', 
  'ops.admin@nurture.com',
  '$2a$10$Xw.YhbpF5WIhjzB2yluh1etE720roGJ80L6s6wqapFKPdg5HMkEUy',
  'ops_admin',
  'active',
  NOW()
) ON DUPLICATE KEY UPDATE email=email;

-- Create Medical Admin test account
INSERT INTO `users` (`id`, `phone`, `email`, `password_hash`, `role`, `status`, `created_at`) 
VALUES (
  'admin-medical-001',
  '+8801700000003', 
  'medical.admin@nurture.com',
  '$2a$10$Xw.YhbpF5WIhjzB2yluh1etE720roGJ80L6s6wqapFKPdg5HMkEUy',
  'medical_admin',
  'active',
  NOW()
) ON DUPLICATE KEY UPDATE email=email;

-- Insert test user profiles
INSERT INTO `user_profiles` (`user_id`, `name`, `date_of_birth`, `address`)
VALUES 
  ('admin-system-001', 'System Administrator', '1990-01-01', 'Dhaka, Bangladesh'),
  ('admin-ops-001', 'Operations Administrator', '1992-01-01', 'Dhaka, Bangladesh'),
  ('admin-medical-001', 'Medical Administrator', '1988-01-01', 'Dhaka, Bangladesh')
ON DUPLICATE KEY UPDATE name=name;

-- Insert sample system metrics
INSERT INTO `system_metrics` (`metric_type`, `metric_name`, `metric_value`, `metric_unit`, `status`, `response_time_ms`, `uptime_percentage`, `recorded_at`) VALUES
('api_server', 'API Server', 1, 'status', 'HEALTHY', 45, 99.99, NOW()),
('database', 'Database', 1, 'status', 'HEALTHY', 12, 99.97, NOW()),
('storage', 'Storage', 1, 'status', 'WARNING', 78, 99.85, NOW()),
('email_service', 'Email Service', 1, 'status', 'HEALTHY', 234, 99.92, NOW())
ON DUPLICATE KEY UPDATE metric_value=metric_value;

-- Insert sample security events
INSERT INTO `security_events` (`id`, `event_type`, `severity`, `description`, `resolved`, `created_at`) VALUES
(UUID(), 'FAILED_LOGIN', 'MEDIUM', 'Multiple failed login attempts from IP 192.168.1.100', FALSE, DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
(UUID(), 'UNAUTHORIZED_ACCESS', 'HIGH', 'Attempt to access admin panel without proper role', FALSE, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(UUID(), 'PASSWORD_CHANGE', 'LOW', 'User changed password successfully', TRUE, DATE_SUB(NOW(), INTERVAL 2 HOUR))
ON DUPLICATE KEY UPDATE description=description;

-- Insert sample card batches
INSERT INTO `card_batches` (`id`, `batch_number`, `card_type`, `quantity`, `activated_count`, `status`, `created_by`, `created_at`) VALUES
(UUID(), 'BATCH-2026-001', 'PREMIUM', 1000, 847, 'ACTIVE', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 30 DAY)),
(UUID(), 'BATCH-2026-002', 'STANDARD', 2000, 1543, 'ACTIVE', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 15 DAY)),
(UUID(), 'BATCH-2026-003', 'PREMIUM', 500, 0, 'PENDING', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE batch_number=batch_number;

-- Insert sample hospital onboarding requests
INSERT INTO `hospital_onboarding` (`id`, `hospital_name`, `hospital_type`, `contact_person`, `contact_email`, `contact_phone`, `address`, `city`, `district`, `bed_capacity`, `status`, `submitted_by`, `created_at`) VALUES
(UUID(), 'Dhaka Central Hospital', 'PUBLIC', 'Dr. Rahman Ahmed', 'rahman@dchospital.com', '+8801712345678', '123 Medical Road', 'Dhaka', 'Dhaka', 500, 'PENDING', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(UUID(), 'City Care Medical Center', 'PRIVATE', 'Dr. Sarah Khan', 'sarah@citycare.com', '+8801798765432', '45 Healthcare Avenue', 'Dhaka', 'Dhaka', 200, 'APPROVED', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(UUID(), 'Apollo Diagnostic Center', 'PRIVATE', 'Dr. Imran Ali', 'imran@apollo.com', '+8801723456789', '78 Gulshan Avenue', 'Dhaka', 'Dhaka', 150, 'PENDING', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE hospital_name=hospital_name;

-- Insert sample CSR programs
INSERT INTO `csr_programs` (`id`, `program_name`, `sponsor_name`, `sponsor_contact`, `program_type`, `budget`, `target_beneficiaries`, `beneficiary_count`, `status`, `start_date`, `end_date`, `managed_by`, `created_at`) VALUES
(UUID(), 'Mother & Child Health Initiative', 'ABC Foundation', 'contact@abcfoundation.org', 'HEALTH', 5000000.00, 1000, 678, 'ACTIVE', '2026-01-01', '2026-12-31', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 20 DAY)),
(UUID(), 'Nutrition Support Program', 'XYZ Trust', 'info@xyztrust.org', 'NUTRITION', 2000000.00, 500, 345, 'ACTIVE', '2026-01-15', '2026-06-30', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(UUID(), 'Emergency Care Fund', 'Medical Relief Corp', 'help@medicalrelief.org', 'EMERGENCY', 3000000.00, 300, 89, 'PLANNING', '2026-02-01', '2026-07-31', 'admin-ops-001', DATE_SUB(NOW(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE program_name=program_name;

-- Insert sample support tickets
INSERT INTO `support_tickets` (`id`, `ticket_number`, `user_name`, `user_phone`, `category`, `priority`, `subject`, `description`, `status`, `created_at`) VALUES
(UUID(), 'TKT-20260126001', 'Ayesha Rahman', '+8801812345678', 'CARD_ISSUE', 'URGENT', 'Card not working at hospital', 'My premium card is showing as inactive at Dhaka Medical College', 'OPEN', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(UUID(), 'TKT-20260126002', 'Fatima Khan', '+8801923456789', 'HOSPITAL_ACCESS', 'HIGH', 'Cannot access services', 'Hospital staff says I am not registered in their system', 'IN_PROGRESS', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(UUID(), 'TKT-20260126003', 'Nazia Islam', '+8801734567890', 'TECHNICAL', 'MEDIUM', 'App not loading', 'The mobile app crashes when I try to book appointment', 'OPEN', DATE_SUB(NOW(), INTERVAL 4 HOUR)),
(UUID(), 'TKT-20260125001', 'Sabrina Akter', '+8801845678901', 'GENERAL', 'LOW', 'Question about card benefits', 'What services are covered under premium card?', 'RESOLVED', DATE_SUB(NOW(), INTERVAL 1 DAY))
ON DUPLICATE KEY UPDATE ticket_number=ticket_number;

-- Insert sample doctor verification requests
INSERT INTO `doctor_verification_requests` (`id`, `user_id`, `doctor_name`, `specialty`, `hospital_affiliation`, `bmdc_reg_number`, `experience_years`, `status`, `submitted_at`) VALUES
(UUID(), UUID(), 'Dr. Fatima Ahmed', 'Gynecology', 'Dhaka Medical College', 'BMDC-A-12345', 8, 'PENDING', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(UUID(), UUID(), 'Dr. Karim Hassan', 'Pediatrics', 'Apollo Hospital', 'BMDC-A-23456', 12, 'PENDING', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(UUID(), UUID(), 'Dr. Nusrat Jahan', 'Obstetrics', 'Square Hospital', 'BMDC-A-34567', 6, 'UNDER_REVIEW', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(UUID(), UUID(), 'Dr. Imran Ali', 'Gynecology', 'United Hospital', 'BMDC-A-45678', 10, 'APPROVED', DATE_SUB(NOW(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE doctor_name=doctor_name;

-- Insert sample high-risk pregnancy cases
INSERT INTO `high_risk_cases` (`id`, `patient_user_id`, `risk_level`, `risk_factors`, `symptoms`, `current_week`, `monitoring_frequency`, `status`, `flagged_by`, `flagged_at`) VALUES
(UUID(), UUID(), 'HIGH', '["Gestational Diabetes", "High Blood Pressure"]', 'Persistent headaches, blurred vision', 32, 'Weekly', 'ACTIVE', 'admin-medical-001', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(UUID(), UUID(), 'CRITICAL', '["Preeclampsia", "Multiple Pregnancy"]', 'Severe swelling, protein in urine', 28, 'Twice Weekly', 'ACTIVE', 'admin-medical-001', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(UUID(), UUID(), 'MODERATE', '["Advanced Maternal Age", "Previous C-Section"]', 'Mild back pain', 24, 'Bi-weekly', 'ACTIVE', 'admin-medical-001', DATE_SUB(NOW(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE patient_user_id=patient_user_id;

-- Insert sample consultation reviews
INSERT INTO `consultation_reviews` (`id`, `consultation_id`, `doctor_id`, `patient_id`, `review_status`, `quality_score`, `created_at`) VALUES
(UUID(), UUID(), UUID(), UUID(), 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(UUID(), UUID(), UUID(), UUID(), 'FLAGGED', 6, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(UUID(), UUID(), UUID(), UUID(), 'PENDING', NULL, DATE_SUB(NOW(), INTERVAL 6 HOUR))
ON DUPLICATE KEY UPDATE consultation_id=consultation_id;

-- Insert sample admin actions
INSERT INTO `admin_actions` (`id`, `admin_user_id`, `admin_role`, `action_type`, `action_category`, `description`, `severity`, `created_at`) VALUES
(UUID(), 'admin-system-001', 'system_admin', 'USER_UPDATE', 'USER_MANAGEMENT', 'Updated user role from patient to doctor', 'INFO', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(UUID(), 'admin-ops-001', 'ops_admin', 'CARD_BATCH_ACTIVATE', 'OPERATIONS', 'Activated card batch BATCH-2026-002', 'INFO', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(UUID(), 'admin-medical-001', 'medical_admin', 'DOCTOR_VERIFICATION', 'MEDICAL', 'Approved doctor verification request', 'INFO', DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(UUID(), 'admin-system-001', 'system_admin', 'SECURITY_REVIEW', 'SECURITY', 'Resolved security event #12345', 'WARNING', DATE_SUB(NOW(), INTERVAL 4 HOUR))
ON DUPLICATE KEY UPDATE admin_user_id=admin_user_id;

-- Insert sample admin notifications
INSERT INTO `admin_notifications` (`id`, `sender_user_id`, `recipient_user_id`, `notification_type`, `priority`, `title`, `message`, `action_required`, `is_read`, `created_at`) VALUES
(UUID(), 'admin-ops-001', 'admin-medical-001', 'HOSPITAL_ONBOARDING', 'MEDIUM', 'New Hospital Onboarding Request', 'Hospital "Dhaka Central Hospital" submitted for approval', TRUE, FALSE, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(UUID(), 'admin-medical-001', 'admin-system-001', 'HIGH_RISK_CASE', 'HIGH', 'New High-Risk Pregnancy Case', 'Patient flagged as CRITICAL risk', TRUE, FALSE, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(UUID(), 'admin-system-001', 'admin-ops-001', 'SECURITY_ALERT', 'URGENT', 'Multiple Failed Login Attempts', 'Suspicious activity detected from IP 192.168.1.100', TRUE, TRUE, DATE_SUB(NOW(), INTERVAL 3 HOUR))
ON DUPLICATE KEY UPDATE sender_user_id=sender_user_id;

-- ============================================================================
-- TEST CREDENTIALS
-- ============================================================================
-- Email: system.admin@nurture.com | Role: system_admin
-- Email: ops.admin@nurture.com | Role: ops_admin
-- Email: medical.admin@nurture.com | Role: medical_admin
-- Password for all: Test@123 (Update password_hash with bcrypt hash)
-- ============================================================================
