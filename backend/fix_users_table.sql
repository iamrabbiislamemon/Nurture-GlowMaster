-- Simple migration to add role column to users table
-- Database: neonest

USE neonest;

-- Add role column to users table
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'patient' AFTER auth_provider;

-- Update any existing users to have patient role
UPDATE users SET role = 'mother' WHERE role IS NULL OR role = '';

-- Verify the change
DESCRIBE users;
