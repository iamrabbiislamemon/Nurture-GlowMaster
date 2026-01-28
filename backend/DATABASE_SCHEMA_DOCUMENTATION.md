# Nurture-Glow Database Schema Documentation

## 📋 Overview

**Version:** 2.0 (Complete & Unified)  
**Last Updated:** January 26, 2026  
**Database:** MySQL 8.0  
**Total Tables:** 58 tables

This document describes the complete database architecture for the Nurture-Glow maternal and child healthcare platform.

---

## 🏗️ Architecture

The database uses a **hybrid architecture** combining:

### 1. **Traditional SQL Tables** (55 tables)
Structured, relational tables for core business entities with strict schemas and foreign key constraints.

### 2. **Flexible EAV System** (3 tables)
JSON-based Entity-Attribute-Value pattern for dynamic, schema-less data storage.

---

## 📊 Table Categories

### **User Management** (5 tables)
- `users` - Main user accounts with authentication
- `user_profiles` - Extended user profile information
- `roles` - System roles definition
- `user_roles` - User-to-role mappings
- `password_reset_tokens` - Password reset workflow

### **Maternal Health** (4 tables)
- `mothers` - Mother profiles
- `pregnancies` - Pregnancy tracking
- `pregnancy_checkins` - Regular pregnancy check-ins
- `emergency_contacts` - Emergency contact information

### **Child Health** (6 tables)
- `children` - Child profiles
- `child_growth_logs` - Growth tracking
- `vaccine_schedules` - Vaccination schedules
- `vaccine_schedule_items` - Individual vaccine doses
- `vaccination_events` - Completed vaccinations
- `certificates` - Birth certificates, vaccination certificates

### **Health Records** (3 tables)
- `health_records` - Medical records
- `health_record_files` - Attached files/documents
- `allergies` - Allergy tracking

### **Doctor & Consultation System** (7 tables)
- `doctor_specialties` - Medical specialties
- `doctors` - Doctor profiles
- `doctor_availability_slots` - Doctor schedules
- `consultations` - Appointments/consultations
- `video_sessions` - Online consultation sessions
- `consultation_messages` - Chat messages
- `doctor_reviews` - Doctor ratings and reviews

### **Hospital & Emergency** (5 tables)
- `hospitals` - Hospital directory
- `icu_status_updates` - ICU bed availability
- `ambulances` - Ambulance fleet
- `emergency_requests` - Emergency service requests
- `emergency_status_events` - Emergency status tracking

### **Mental Health** (4 tables)
- `mental_questions` - Assessment questions
- `mental_assessments` - Assessment sessions
- `mental_answers` - User responses
- `referrals` - Professional referrals

### **E-Commerce** (7 tables)
- `vendors` - Product vendors
- `product_categories` - Product categories
- `products` - Product catalog
- `orders` - Customer orders
- `order_items` - Order line items
- `payments` - Payment transactions
- `product_reviews` - Product ratings and reviews

### **Blood Donation System** (2 tables) ⭐ NEW
- `blood_donors` - Blood donor registry
- `blood_requests` - Blood donation requests

### **Health ID Verification** (1 table) ⭐ NEW
- `health_id_verification_requests` - Government health ID verification workflow

### **Flexible Entity System** (3 tables) ⭐ NEW
- `app_entities` - Generic JSON-based entity storage
- `app_user_meta` - User metadata (key-value pairs)
- `app_catalog` - System-wide catalog data

### **System & Support** (7 tables)
- `reminders` - User reminders
- `reminder_deliveries` - Reminder delivery tracking
- `notifications` - Push notifications
- `files` - File storage metadata
- `file_links` - File-to-entity relationships
- `addresses` - User addresses
- `audit_logs` - System audit trail

### **Resources** (2 tables)
- `gov_resources` - Government resources directory
- `ngos` - NGO directory

---

## 🔑 Key Features

### **Enhanced Users Table**
The `users` table now includes:
- `health_id` - Government health ID number
- `health_id_verification_status` - Verification status (unverified, pending, accepted, rejected)
- `health_id_verified_by_hospital_id` - Hospital that verified the ID
- `health_id_verified_at` - Verification timestamp
- `hospital_id` - Associated hospital (for hospital staff)

**Supported Roles:**
- `patient` (default)
- `mother`
- `father`
- `doctor`
- `pharmacist`
- `nutritionist`
- `merchandiser`
- `medical-admin`
- `ops-admin`
- `system-admin`
- `merchant`
- `hospital`

### **Blood Donation System**
Complete blood donor network with:
- Donor registration with blood group filtering
- Location-based donor search
- Verification system
- Urgent blood request workflow
- Donation history tracking

### **Flexible Entity System (`app_entities`)**
Used for dynamic features that don't need rigid schemas:

**Entity Types:**
- `appointment` - Doctor appointments
- `notification` - System notifications
- `order` - E-commerce orders
- `community_post` - Community forum posts
- `community_comment` - Post comments
- `donor` - Blood donors (alternative to blood_donors table)
- `journal_entry` - Personal journal entries
- `health_history` - Health metric tracking
- `audit_log` - Activity logs
- `user_suspension` - Account suspension records
- `hospital` - Hospital data (alternative storage)
- `doctor` - Doctor data (alternative storage)
- `medicine` - Medicine catalog
- And more...

**Subtypes** (examples):
- Health metrics: `bloodPressure`, `glucose`, `weight`, `hydration`
- Appointment types: `Online`, `Offline`
- Order status: `pending`, `confirmed`, `shipped`, `delivered`

---

## 📈 Performance Optimizations

### **Indexes Added:**
- User lookup: `idx_users_email`, `idx_users_phone`
- Health ID: `idx_health_id`
- Role filtering: `idx_role`
- Notification queries: `idx_notifications_user_read`
- Order tracking: `idx_orders_user_status`
- Consultation filtering: `idx_consultations_doctor_status`
- Product browsing: `idx_products_category_status`
- Blood donor search: `idx_blood_group`, `idx_location`, `idx_verified`
- Entity queries: `idx_type`, `idx_user_type`, `idx_user_type_sub`

---

## 🔄 Migration from Old Schema

### **Breaking Changes:**
None. All changes are additive.

### **New Tables:**
1. `app_entities` - **CRITICAL** - Required for appointments, notifications, orders
2. `app_user_meta` - Required for user preferences
3. `app_catalog` - Required for doctor/hospital/medicine catalogs
4. `blood_donors` - Optional (can use app_entities with type='donor')
5. `blood_requests` - Blood donation requests
6. `health_id_verification_requests` - Health ID workflow

### **Modified Tables:**
1. **users** - Added health ID fields
2. **notifications** - Added verification workflow fields

### **Migration Steps:**

#### **Option 1: Fresh Installation**
```bash
# Drop existing database (⚠️ DATA LOSS)
mysql -u root -p -e "DROP DATABASE IF EXISTS neonest; CREATE DATABASE neonest;"

# Import complete schema
mysql -u root -p neonest < backend/database-schema.sql

# Run seeders
node backend/src/seed.js
```

#### **Option 2: Update Existing Database**
```bash
# Backup first!
mysqldump -u root -p neonest > backup_$(date +%Y%m%d).sql

# Add new columns to users table
mysql -u root -p neonest <<EOF
ALTER TABLE users 
  ADD COLUMN health_id VARCHAR(64) NULL,
  ADD COLUMN health_id_verification_status VARCHAR(20) DEFAULT 'unverified',
  ADD COLUMN health_id_verified_by_hospital_id VARCHAR(36) NULL,
  ADD COLUMN health_id_verified_at DATETIME NULL,
  ADD COLUMN hospital_id VARCHAR(36) NULL;

ALTER TABLE users ADD INDEX idx_health_id (health_id);
ALTER TABLE users ADD INDEX idx_role (role);
ALTER TABLE users ADD INDEX idx_status (status);

# Add new columns to notifications table
ALTER TABLE notifications
  ADD COLUMN recipient_user_id VARCHAR(36) NULL,
  ADD COLUMN actor_user_id VARCHAR(36) NULL,
  ADD COLUMN type VARCHAR(60) NULL,
  ADD COLUMN payload_json JSON NULL;

ALTER TABLE notifications 
  ADD FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
EOF

# Create new tables
mysql -u root -p neonest < backend/database-schema.sql
```

---

## 🎯 Usage Examples

### **Query Blood Donors by Blood Group**
```sql
SELECT * FROM blood_donors 
WHERE blood_group = 'O+' 
  AND verified = TRUE 
  AND available = TRUE
ORDER BY created_at DESC;
```

### **Get User's Appointments**
```sql
SELECT id, JSON_EXTRACT(data, '$.date') as date, 
       JSON_EXTRACT(data, '$.doctorName') as doctor
FROM app_entities 
WHERE type = 'appointment' 
  AND user_id = 'user-uuid-here'
ORDER BY created_at DESC;
```

### **Health ID Verification Status**
```sql
SELECT u.id, u.email, u.health_id, u.health_id_verification_status,
       h.name as verified_by_hospital
FROM users u
LEFT JOIN hospitals h ON u.health_id_verified_by_hospital_id = h.id
WHERE u.health_id_verification_status = 'pending';
```

---

## 🔐 Security Considerations

1. **Health ID** is sensitive PII - ensure encryption at rest
2. **Password hashes** use bcrypt with salt rounds >= 10
3. **Audit logs** track all critical operations
4. **Soft deletes** via `status` field recommended for user data
5. **Foreign key constraints** ensure referential integrity
6. **JSON validation** required for app_entities.data field

---

## 📦 Seed Data

The following seed data is automatically created:

### **Roles:**
- USER, DOCTOR, ADMIN

### **Doctor Specialties:**
- Gynecologist, Pediatrician, Nutritionist, Psychologist

### **Product Categories:**
- Mother Care, Baby Care, Nutrition, Medical Devices

### **Sample Data:**
- 3 Hospitals (Dhaka Medical, Square Hospital, Evercare)
- 3 Doctors (Dr. Arifa Begum, Dr. Mahbub Rahman, Dr. Nusrat Jahan)
- Sample products and vendors

---

## 🆘 Support

For issues or questions:
1. Check this documentation
2. Review `backend/src/appStore.js` for app_entities usage
3. Review `backend/src/appRoutes.js` for API implementation
4. Check migration files in `backend/*.sql`

---

## 📝 Version History

### **v2.0** (January 26, 2026)
- ✅ Added app_entities, app_user_meta, app_catalog tables
- ✅ Added blood_donors and blood_requests tables
- ✅ Added health_id_verification_requests table
- ✅ Enhanced users table with health ID fields
- ✅ Enhanced notifications table with workflow fields
- ✅ Added comprehensive indexes for performance
- ✅ Unified all migration files into single schema

### **v1.0** (Initial)
- Basic user management
- Core healthcare features
- E-commerce system
- Hospital directory
