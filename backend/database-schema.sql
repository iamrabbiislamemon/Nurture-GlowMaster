-- =====================================================
-- NURTURE-GLOW COMPLETE DATABASE SCHEMA
-- =====================================================
-- Version: 2.0 (Unified & Complete)
-- Date: January 26, 2026
-- Description: Complete database schema including all tables for the
--              Nurture-Glow maternal and child healthcare platform
--
-- ARCHITECTURE:
-- 1. Traditional SQL Tables: Structured data for core entities
--    (users, doctors, hospitals, products, etc.)
-- 2. Flexible EAV System: JSON-based storage via app_entities table
--    (appointments, notifications, community posts, etc.)
-- 3. Blood Donation System: Dedicated tables for blood donor network
-- 4. Health ID Verification: Government health ID integration
--
-- FEATURES COVERED:
-- - User Management & Authentication
-- - Role-Based Access Control (RBAC)
-- - Maternal Health Tracking
-- - Child Health & Vaccination
-- - Doctor Consultations (Online/Offline)
-- - Hospital & Emergency Services
-- - E-Commerce (Products & Orders)
-- - Blood Donor Network
-- - Mental Health Assessments
-- - Government Resources & NGOs
-- - Notifications & Reminders
-- - File Storage & Management
-- - Audit Logging
-- =====================================================

-- Create all required tables for Nurture-Glow

-- Roles table
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `role_name` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table (Enhanced with health_id fields)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `phone` VARCHAR(20) NOT NULL UNIQUE,
  `email` VARCHAR(255) UNIQUE,
  `password_hash` VARCHAR(255),
  `auth_provider` VARCHAR(50) DEFAULT 'local',
  `role` VARCHAR(50) DEFAULT 'patient',
  `status` VARCHAR(20) DEFAULT 'active',
  `health_id` VARCHAR(64) NULL,
  `health_id_verification_status` VARCHAR(20) DEFAULT 'unverified',
  `health_id_verified_by_hospital_id` VARCHAR(36) NULL,
  `health_id_verified_at` DATETIME NULL,
  `hospital_id` VARCHAR(36) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_health_id` (`health_id`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `token` TEXT NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_token_expires` (`expires_at`),
  INDEX `idx_user_id` (`user_id`)
);

-- User profiles table
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL UNIQUE,
  `full_name` VARCHAR(255),
  `date_of_birth` DATE,
  `gender` VARCHAR(20),
  `preferred_language` VARCHAR(10) DEFAULT 'en',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `role_id` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS `emergency_contacts` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `contact_name` VARCHAR(255),
  `relationship` VARCHAR(100),
  `phone` VARCHAR(20),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Mothers table
CREATE TABLE IF NOT EXISTS `mothers` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `blood_group` VARCHAR(10),
  `health_conditions` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Pregnancies table
CREATE TABLE IF NOT EXISTS `pregnancies` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `mother_id` VARCHAR(36) NOT NULL,
  `expected_due_date` DATE,
  `gestational_age_weeks` INT,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`mother_id`) REFERENCES `mothers` (`id`) ON DELETE CASCADE
);

-- Children table
CREATE TABLE IF NOT EXISTS `children` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `mother_id` VARCHAR(36) NOT NULL,
  `full_name` VARCHAR(255),
  `date_of_birth` DATE,
  `gender` VARCHAR(20),
  `blood_group` VARCHAR(10),
  `weight_kg` DECIMAL(5, 2),
  `height_cm` DECIMAL(5, 2),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`mother_id`) REFERENCES `mothers` (`id`) ON DELETE CASCADE
);

-- Health records table
CREATE TABLE IF NOT EXISTS `health_records` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36),
  `child_id` VARCHAR(36),
  `record_type` VARCHAR(100),
  `description` LONGTEXT,
  `recorded_date` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`id`) ON DELETE CASCADE
);

-- Health record files table
CREATE TABLE IF NOT EXISTS `health_record_files` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `health_record_id` VARCHAR(36) NOT NULL,
  `file_url` VARCHAR(500),
  `file_type` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`health_record_id`) REFERENCES `health_records` (`id`) ON DELETE CASCADE
);

-- Allergies table
CREATE TABLE IF NOT EXISTS `allergies` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36),
  `child_id` VARCHAR(36),
  `allergen` VARCHAR(255),
  `severity` VARCHAR(50),
  `reaction` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`id`) ON DELETE SET NULL
);

-- Pregnancy check-ins table
CREATE TABLE IF NOT EXISTS `pregnancy_checkins` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `pregnancy_id` VARCHAR(36) NOT NULL,
  `weight_kg` DECIMAL(5, 2),
  `blood_pressure` VARCHAR(20),
  `glucose_level` DECIMAL(5, 2),
  `checkin_date` DATE,
  `notes` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`pregnancy_id`) REFERENCES `pregnancies` (`id`) ON DELETE CASCADE
);

-- Child growth logs table
CREATE TABLE IF NOT EXISTS `child_growth_logs` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `child_id` VARCHAR(36) NOT NULL,
  `weight_kg` DECIMAL(5, 2),
  `height_cm` DECIMAL(5, 2),
  `head_circumference_cm` DECIMAL(5, 2),
  `log_date` DATE,
  `percentile` INT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`id`) ON DELETE CASCADE
);

-- Vaccine schedules table
CREATE TABLE IF NOT EXISTS `vaccine_schedules` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `child_id` VARCHAR(36) NOT NULL,
  `vaccine_name` VARCHAR(255),
  `scheduled_date` DATE,
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`id`) ON DELETE CASCADE
);

-- Vaccine schedule items table
CREATE TABLE IF NOT EXISTS `vaccine_schedule_items` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `schedule_id` VARCHAR(36) NOT NULL,
  `vaccine_name` VARCHAR(255),
  `dose_number` INT,
  `scheduled_date` DATE,
  `status` VARCHAR(50) DEFAULT 'pending',
  FOREIGN KEY (`schedule_id`) REFERENCES `vaccine_schedules` (`id`) ON DELETE CASCADE
);

-- Vaccination events table
CREATE TABLE IF NOT EXISTS `vaccination_events` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `child_id` VARCHAR(36) NOT NULL,
  `vaccine_name` VARCHAR(255),
  `vaccine_date` DATE,
  `nurse_name` VARCHAR(255),
  `reaction` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`id`) ON DELETE CASCADE
);

-- Reminders table
CREATE TABLE IF NOT EXISTS `reminders` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(255),
  `description` LONGTEXT,
  `reminder_type` VARCHAR(100),
  `reminder_date` DATETIME,
  `status` VARCHAR(50) DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Reminder deliveries table
CREATE TABLE IF NOT EXISTS `reminder_deliveries` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `reminder_id` VARCHAR(36) NOT NULL,
  `delivery_date` DATETIME,
  `status` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`reminder_id`) REFERENCES `reminders` (`id`) ON DELETE CASCADE
);

-- Mental health questions table
CREATE TABLE IF NOT EXISTS `mental_questions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `question_text` VARCHAR(500),
  `category` VARCHAR(100),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mental assessments table
CREATE TABLE IF NOT EXISTS `mental_assessments` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `assessment_date` DATE,
  `score` INT,
  `status` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Mental answers table
CREATE TABLE IF NOT EXISTS `mental_answers` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `assessment_id` VARCHAR(36) NOT NULL,
  `question_id` VARCHAR(36) NOT NULL,
  `answer_value` INT,
  FOREIGN KEY (`assessment_id`) REFERENCES `mental_assessments` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`question_id`) REFERENCES `mental_questions` (`id`) ON DELETE CASCADE
);

-- Referrals table
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36),
  `referral_type` VARCHAR(100),
  `referred_to` VARCHAR(255),
  `reason` LONGTEXT,
  `status` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

-- Doctor specialties table
CREATE TABLE IF NOT EXISTS `doctor_specialties` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `description` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Doctors table
CREATE TABLE IF NOT EXISTS `doctors` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `full_name` VARCHAR(255) NOT NULL,
  `specialty_id` INT,
  `phone` VARCHAR(20),
  `email` VARCHAR(255),
  `fee_amount` DECIMAL(10, 2),
  `verified` BOOLEAN DEFAULT FALSE,
  `rating` DECIMAL(3, 2),
  `availability_status` VARCHAR(50) DEFAULT 'available',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`specialty_id`) REFERENCES `doctor_specialties` (`id`) ON DELETE SET NULL
);

-- Doctor availability slots table
CREATE TABLE IF NOT EXISTS `doctor_availability_slots` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `doctor_id` VARCHAR(36) NOT NULL,
  `day_of_week` VARCHAR(20),
  `start_time` TIME,
  `end_time` TIME,
  `slot_duration_minutes` INT DEFAULT 30,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE
);

-- Consultations table
CREATE TABLE IF NOT EXISTS `consultations` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `doctor_id` VARCHAR(36) NOT NULL,
  `consultation_type` VARCHAR(50),
  `scheduled_date` DATETIME,
  `status` VARCHAR(50) DEFAULT 'pending',
  `notes` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE
);

-- Video sessions table
CREATE TABLE IF NOT EXISTS `video_sessions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `consultation_id` VARCHAR(36),
  `session_url` VARCHAR(500),
  `start_time` DATETIME,
  `end_time` DATETIME,
  `status` VARCHAR(50),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`consultation_id`) REFERENCES `consultations` (`id`) ON DELETE CASCADE
);

-- Consultation messages table
CREATE TABLE IF NOT EXISTS `consultation_messages` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `consultation_id` VARCHAR(36) NOT NULL,
  `sender_user_id` VARCHAR(36),
  `sender_doctor_id` VARCHAR(36),
  `message_text` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`consultation_id`) REFERENCES `consultations` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`sender_doctor_id`) REFERENCES `doctors` (`id`) ON DELETE SET NULL
);

-- Hospitals table
CREATE TABLE IF NOT EXISTS `hospitals` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `address` VARCHAR(500),
  `hotline_phone` VARCHAR(20),
  `website` VARCHAR(500),
  `lat` DECIMAL(10, 8),
  `lng` DECIMAL(11, 8),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ICU status updates table
CREATE TABLE IF NOT EXISTS `icu_status_updates` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `hospital_id` VARCHAR(36) NOT NULL,
  `available_beds` INT,
  `occupied_beds` INT,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
);

-- Ambulances table
CREATE TABLE IF NOT EXISTS `ambulances` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `hospital_id` VARCHAR(36) NOT NULL,
  `vehicle_number` VARCHAR(50),
  `driver_name` VARCHAR(255),
  `driver_phone` VARCHAR(20),
  `status` VARCHAR(50) DEFAULT 'available',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
);

-- Emergency requests table
CREATE TABLE IF NOT EXISTS `emergency_requests` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `location_lat` DECIMAL(10, 8),
  `location_lng` DECIMAL(11, 8),
  `destination_hospital_id` VARCHAR(36),
  `ambulance_id` VARCHAR(36),
  `status` VARCHAR(50) DEFAULT 'pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`destination_hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`ambulance_id`) REFERENCES `ambulances` (`id`) ON DELETE SET NULL
);

-- Emergency status events table
CREATE TABLE IF NOT EXISTS `emergency_status_events` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `emergency_request_id` VARCHAR(36) NOT NULL,
  `status` VARCHAR(50),
  `timestamp` DATETIME,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`emergency_request_id`) REFERENCES `emergency_requests` (`id`) ON DELETE CASCADE
);

-- Government resources table
CREATE TABLE IF NOT EXISTS `gov_resources` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `resource_name` VARCHAR(255),
  `resource_type` VARCHAR(100),
  `description` LONGTEXT,
  `contact_info` VARCHAR(500),
  `website` VARCHAR(500),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Certificates table
CREATE TABLE IF NOT EXISTS `certificates` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `child_id` VARCHAR(36) NOT NULL,
  `certificate_type` VARCHAR(100),
  `issue_date` DATE,
  `certificate_url` VARCHAR(500),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`child_id`) REFERENCES `children` (`id`) ON DELETE CASCADE
);

-- Vendors table
CREATE TABLE IF NOT EXISTS `vendors` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20),
  `email` VARCHAR(255),
  `verified` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Product categories table
CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `description` LONGTEXT,
  `image_url` VARCHAR(500),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `vendor_id` VARCHAR(36) NOT NULL,
  `category_id` INT,
  `name` VARCHAR(255) NOT NULL,
  `description` LONGTEXT,
  `price` DECIMAL(10, 2),
  `stock_qty` INT DEFAULT 0,
  `status` VARCHAR(50) DEFAULT 'active',
  `image_url` VARCHAR(500),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `product_categories` (`id`) ON DELETE SET NULL
);

-- Orders table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `order_date` DATETIME,
  `total_amount` DECIMAL(10, 2),
  `status` VARCHAR(50) DEFAULT 'pending',
  `shipping_address` VARCHAR(500),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Order items table
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(36) NOT NULL,
  `product_id` VARCHAR(36) NOT NULL,
  `quantity` INT,
  `unit_price` DECIMAL(10, 2),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
);

-- Payments table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `order_id` VARCHAR(36),
  `consultation_id` VARCHAR(36),
  `amount` DECIMAL(10, 2),
  `payment_method` VARCHAR(100),
  `payment_status` VARCHAR(50) DEFAULT 'pending',
  `transaction_id` VARCHAR(255),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`consultation_id`) REFERENCES `consultations` (`id`) ON DELETE SET NULL
);

-- Files table
CREATE TABLE IF NOT EXISTS `files` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `file_name` VARCHAR(500),
  `file_size` BIGINT,
  `file_url` VARCHAR(500),
  `mime_type` VARCHAR(100),
  `uploaded_by_user_id` VARCHAR(36),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

-- File links table
CREATE TABLE IF NOT EXISTS `file_links` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `file_id` VARCHAR(36) NOT NULL,
  `linked_entity_type` VARCHAR(100),
  `linked_entity_id` VARCHAR(36),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`file_id`) REFERENCES `files` (`id`) ON DELETE CASCADE
);

-- Notifications table (Enhanced with verification workflow support)
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `notification_type` VARCHAR(100),
  `title` VARCHAR(255),
  `message` LONGTEXT,
  `is_read` BOOLEAN DEFAULT FALSE,
  `recipient_user_id` VARCHAR(36) NULL,
  `actor_user_id` VARCHAR(36) NULL,
  `type` VARCHAR(60) NULL,
  `payload_json` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36),
  `action` VARCHAR(255),
  `entity_type` VARCHAR(100),
  `entity_id` VARCHAR(36),
  `changes` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

-- Addresses table
CREATE TABLE IF NOT EXISTS `addresses` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `address_type` VARCHAR(50),
  `street` VARCHAR(500),
  `city` VARCHAR(100),
  `state` VARCHAR(100),
  `postal_code` VARCHAR(20),
  `country` VARCHAR(100),
  `is_primary` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- NGOs table
CREATE TABLE IF NOT EXISTS `ngos` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` LONGTEXT,
  `phone` VARCHAR(20),
  `email` VARCHAR(255),
  `website` VARCHAR(500),
  `address` VARCHAR(500),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Doctor reviews table
CREATE TABLE IF NOT EXISTS `doctor_reviews` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `doctor_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `rating` INT,
  `review_text` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Product reviews table
CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `product_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `rating` INT,
  `review_text` LONGTEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
-- =====================================================
-- FLEXIBLE ENTITY SYSTEM (App Store Tables)
-- =====================================================

-- App entities table (Flexible JSON-based storage for dynamic features)
-- Used for: appointments, notifications, orders, community posts, blood donors, journal entries, etc.
CREATE TABLE IF NOT EXISTS `app_entities` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NULL,
  `type` VARCHAR(50) NOT NULL,
  `subtype` VARCHAR(100) NULL,
  `data` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  INDEX `idx_type` (`type`),
  INDEX `idx_user_type` (`user_id`, `type`),
  INDEX `idx_user_type_sub` (`user_id`, `type`, `subtype`),
  INDEX `idx_created_at` (`created_at`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- App user metadata table (Key-value storage for user preferences)
-- Used for: hydration tracking, pregnancy week, avatar, custom user settings
CREATE TABLE IF NOT EXISTS `app_user_meta` (
  `user_id` VARCHAR(36) NOT NULL,
  `meta_key` VARCHAR(50) NOT NULL,
  `meta_value` VARCHAR(255) NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`user_id`, `meta_key`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- App catalog table (System-wide catalog data)
-- Used for: doctor catalog, hospital catalog, medicine catalog
CREATE TABLE IF NOT EXISTS `app_catalog` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `type` VARCHAR(50) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  INDEX `idx_catalog_type` (`type`)
);

-- =====================================================
-- BLOOD DONATION SYSTEM
-- =====================================================

-- Blood donors table
CREATE TABLE IF NOT EXISTS `blood_donors` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NULL,
  `name` VARCHAR(255) NOT NULL,
  `blood_group` VARCHAR(10) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `verified` BOOLEAN DEFAULT FALSE,
  `available` BOOLEAN DEFAULT TRUE,
  `last_donation_date` DATE NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_blood_group` (`blood_group`),
  INDEX `idx_location` (`location`),
  INDEX `idx_verified` (`verified`),
  INDEX `idx_available` (`available`)
);

-- Blood donation requests table
CREATE TABLE IF NOT EXISTS `blood_requests` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `donor_id` VARCHAR(36) NOT NULL,
  `requester_user_id` VARCHAR(36) NULL,
  `requester_phone` VARCHAR(20) NOT NULL,
  `blood_group` VARCHAR(10) NOT NULL,
  `area` VARCHAR(255) NOT NULL,
  `message` TEXT,
  `urgency_level` VARCHAR(20) DEFAULT 'normal',
  `status` VARCHAR(20) DEFAULT 'sent',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`donor_id`) REFERENCES `blood_donors` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_status` (`status`),
  INDEX `idx_blood_group` (`blood_group`),
  INDEX `idx_created_at` (`created_at`)
);

-- =====================================================
-- HEALTH ID VERIFICATION SYSTEM
-- =====================================================

-- Health ID verification requests table
CREATE TABLE IF NOT EXISTS `health_id_verification_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `hospital_id` VARCHAR(36) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `request_note` VARCHAR(255) NULL,
  `rejection_reason` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_hiv_user_hospital` (`user_id`, `hospital_id`, `status`),
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals` (`id`) ON DELETE CASCADE
);

-- =====================================================
-- SYSTEM INDEXES & PERFORMANCE OPTIMIZATION
-- =====================================================

-- Additional indexes for frequently queried fields
-- Note: MySQL does not support CREATE INDEX IF NOT EXISTS.
CREATE INDEX `idx_users_email` ON `users` (`email`);
CREATE INDEX `idx_users_phone` ON `users` (`phone`);
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`, `is_read`);
CREATE INDEX `idx_orders_user_status` ON `orders` (`user_id`, `status`);
CREATE INDEX `idx_consultations_doctor_status` ON `consultations` (`doctor_id`, `status`);
CREATE INDEX `idx_products_category_status` ON `products` (`category_id`, `status`);
