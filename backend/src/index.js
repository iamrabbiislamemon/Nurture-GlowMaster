import express from 'express';
import { z } from 'zod';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { query } from './db.js';
import { seedDatabase } from './seed.js';
import { createAppRouter } from './appRoutes.js';
import { createAdminRouter } from './adminRoutes.js';
import { ensureAppTables, seedAppData, getUserMeta, listEntities, setUserMeta } from './appStore.js';
import { normalizeRoleValue, CANONICAL_ROLES, getRoleFilterOptions } from './roles.js';
import { sendPasswordResetEmail, sendWelcomeEmail, sendPasswordResetConfirmationEmail, sendSuspensionAppealEmail, verifyEmailConfig } from './emailService.js';
import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV || 'development';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const DEV_JWT_SECRET_PATH = path.join(BACKEND_ROOT, '.dev_jwt_secret');
const loadDevJwtSecret = () => {
  try {
    const secret = fsSync.readFileSync(DEV_JWT_SECRET_PATH, 'utf8').trim();
    if (secret.length >= 32) {
      return secret;
    }
  } catch (err) {
    // Ignore missing file
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fsSync.writeFileSync(DEV_JWT_SECRET_PATH, generated, { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.warn('Failed to persist dev JWT secret:', err.message || err);
  }
  return generated;
};

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  if (NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a 32+ char value in production.');
  }
  console.warn('JWT_SECRET is missing or too short. Using a persisted dev secret.');
  return loadDevJwtSecret();
})();

const app = express();

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const corsOriginRaw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*';
const corsOrigins = corsOriginRaw
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowAllOrigins = corsOrigins.includes('*');

if (NODE_ENV === 'production' && allowAllOrigins) {
  throw new Error('CORS_ORIGIN must be an explicit origin list in production.');
}
if (!allowAllOrigins && corsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN resolved to an empty list.');
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowAllOrigins ? true : corsOrigins }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const getTokenUserId = (req) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.sub || null;
  } catch (err) {
    return null;
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const adminExportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getTokenUserId(req) || ipKeyGenerator(req),
  skip: (req) => !req.path.includes('admin') || !req.path.includes('export')
});

app.use(apiLimiter);
app.use(adminExportLimiter);

// Input sanitization middleware
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove HTML/script tags, trim, and limit length
          obj[key] = obj[key]
            .replace(/[<>]/g, '')
            .trim()
            .substring(0, 5000);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
});

const DB_NAME = process.env.DB_NAME || 'neonest';
if (NODE_ENV === 'production') {
  const envSchema = z.object({
    DB_HOST: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGIN: z.string().optional(),
    FRONTEND_URL: z.string().optional()
  }).refine((data) => Boolean(data.CORS_ORIGIN || data.FRONTEND_URL), {
    message: 'CORS_ORIGIN or FRONTEND_URL must be set in production'
  });

  const envCheck = envSchema.safeParse(process.env);
  if (!envCheck.success) {
    throw new Error(`Invalid production environment configuration: ${envCheck.error.message}`);
  }

  if (process.env.DB_USER === 'root' || process.env.DB_PASSWORD === 'root') {
    console.warn('Production DB credentials appear to be defaults. Set secure DB_USER/DB_PASSWORD.');
  }
}

const TABLES = [
  'users',
  'user_profiles',
  'roles',
  'user_roles',
  'emergency_contacts',
  'mothers',
  'pregnancies',
  'children',
  'health_records',
  'health_record_files',
  'allergies',
  'pregnancy_checkins',
  'child_growth_logs',
  'vaccine_schedules',
  'vaccine_schedule_items',
  'vaccination_events',
  'reminders',
  'reminder_deliveries',
  'mental_questions',
  'mental_assessments',
  'mental_answers',
  'referrals',
  'doctor_specialties',
  'doctors',
  'doctor_availability_slots',
  'consultations',
  'video_sessions',
  'consultation_messages',
  'hospitals',
  'icu_status_updates',
  'ambulances',
  'emergency_requests',
  'emergency_status_events',
  'gov_resources',
  'certificates',
  'vendors',
  'product_categories',
  'products',
  'orders',
  'order_items',
  'payments',
  'files',
  'file_links',
  'notifications',
  'audit_logs',
  'addresses',
  'ngos',
  'doctor_reviews',
  'product_reviews'
];

const tableCache = new Map();

const SQL_BOOTSTRAP_FILES = [
  { file: 'database-schema.sql', required: true },
  { file: 'add_role_column.sql', required: false },
  { file: 'create_system_tables.sql', required: true },
  { file: 'admin_tables_schema.sql', required: true },
  { file: 'create_dashboard_views.sql', required: false }
];

const stripSqlComments = (sql) => {
  const withoutBlock = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlock
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('#');
    })
    .join('\n');
};

const splitSqlStatements = (sql) =>
  stripSqlComments(sql)
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);

const resolveSqlPath = async (fileName) => {
  const candidates = [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), 'backend', fileName),
    path.resolve(BACKEND_ROOT, fileName)
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (err) {
      // try next
    }
  }

  throw new Error(`SQL file not found: ${fileName}`);
};

async function runSqlFile(fileName) {
  const filePath = await resolveSqlPath(fileName);
  const raw = await fs.readFile(filePath, 'utf-8');
  const statements = splitSqlStatements(raw);
  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err) {
      const msg = String(err?.message || err);
      if (
        msg.includes('Duplicate key name') ||
        msg.includes('Duplicate column name') ||
        msg.includes('already exists')
      ) {
        console.warn('Ignored duplicate schema error:', msg);
        continue;
      }
      throw err;
    }
  }
}

const STRICT_BOOTSTRAP = process.env.STRICT_BOOTSTRAP === 'true' || NODE_ENV === 'production';

async function ensureAdminSchema() {
  const failures = [];

  for (const entry of SQL_BOOTSTRAP_FILES) {
    const fileName = typeof entry === 'string' ? entry : entry.file;
    const required = typeof entry === 'string' ? false : Boolean(entry.required);
    try {
      await runSqlFile(fileName);
    } catch (err) {
      const message = err?.message || String(err);
      if (STRICT_BOOTSTRAP || required) {
        failures.push({ fileName, message });
      } else {
        console.warn(`Schema bootstrap skipped for ${fileName}:`, message);
      }
    }
  }

  if (failures.length) {
    const details = failures.map((f) => `${f.fileName}: ${f.message}`).join('; ');
    throw new Error(`Schema bootstrap failed: ${details}`);
  }
}

async function assertCoreTables() {
  const requiredTables = ['users', 'user_profiles', 'roles', 'user_roles'];
  const placeholders = requiredTables.map(() => '?').join(', ');
  const rows = await query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`,
    [DB_NAME, ...requiredTables]
  );
  const existing = new Set(rows.map((row) => row.TABLE_NAME || Object.values(row)[0]));
  const missing = requiredTables.filter((table) => !existing.has(table));
  if (missing.length) {
    throw new Error(
      `Missing core tables: ${missing.join(', ')}. Ensure database-schema.sql was applied.`
    );
  }
}

async function getTableMeta(table) {
  if (tableCache.has(table)) {
    return tableCache.get(table);
  }

  const columns = await query(
    `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [DB_NAME, table]
  );

  const pkColumns = await query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [DB_NAME, table]
  );

  const meta = {
    columns: columns.map(col => ({
      name: col.COLUMN_NAME,
      nullable: col.IS_NULLABLE === 'YES',
      hasDefault: col.COLUMN_DEFAULT !== null,
      autoIncrement: String(col.EXTRA || '').includes('auto_increment')
    })),
    pk: pkColumns.map(col => col.COLUMN_NAME)
  };

  tableCache.set(table, meta);
  return meta;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload && payload.role) {
      payload.role = normalizeRoleValue(payload.role) || payload.role;
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// CRITICAL FIX: Check if user account is suspended
function checkSuspensionStatus(req, res, next) {
  return (async () => {
    try {
      if (!req.user || !req.user.sub) return next();
      const rows = await query(
        `SELECT data FROM app_entities WHERE type = 'user_suspension' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [req.user.sub]
      );
      if (rows.length > 0) {
        try {
          const suspension = JSON.parse(rows[0].data || '{}');
          if (suspension.status === 'suspended') {
            return res.status(403).json({ error: 'Account suspended', reason: suspension.reason });
          }
        } catch (e) {}
      }
      next();
    } catch (err) {
      console.error('Suspension check error:', err);
      next();
    }
  })();
}

function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.sub) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const normalizedAllowed = allowedRoles
        .flatMap((role) => (Array.isArray(role) ? role : [role]))
        .map((role) => normalizeRoleValue(role));

      // Get user role directly from users.role column (standardized approach)
      const rows = await query(
        `SELECT role FROM users WHERE id = ? LIMIT 1`,
        [req.user.sub]
      );

      const rawRole = rows.length > 0 && rows[0].role ? rows[0].role : 'mother';
      const userRole = normalizeRoleValue(rawRole);

      if (!normalizedAllowed.includes(userRole)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: rawRole
        });
      }

      req.userRole = userRole;
      if (req.user) {
        req.user.role = userRole;
      }
      next();
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({ error: 'Role verification failed' });
    }
  };
}

// ============================================================================
// CONSENT VALIDATION MIDDLEWARE - Ensures doctors have patient permission
// ============================================================================
function requireConsentForPatient(patientIdParam = 'patientId') {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.sub) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const doctorId = req.user.sub;
      const patientId = req.params[patientIdParam] || req.body.patientId;

      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }

      // Check for ACTIVE, NON-EXPIRED consent from patient
      const consentRows = await query(
        `SELECT id, data FROM app_entities 
         WHERE type = 'medical_consent' 
         AND user_id = ?
         LIMIT 100`,
        [patientId]
      );

      const now = new Date();
      const activeConsent = consentRows.find(row => {
        try {
          const consent = JSON.parse(row.data || '{}');
          
          // Check if consent is from this doctor
          if (consent.doctorId !== doctorId) return false;
          
          // Check if consent is active
          if (consent.status !== 'active') return false;
          
          // Check if consent has expired
          if (consent.expiresAt) {
            const expiryDate = new Date(consent.expiresAt);
            if (now > expiryDate) return false;
          }
          
          return true;
        } catch (err) {
          return false;
        }
      });

      if (!activeConsent) {
        return res.status(403).json({
          error: 'Access denied: Patient consent required',
          reason: 'no_active_consent',
          hint: 'Request patient consent before accessing their medical data'
        });
      }

      // Attach consent info to request for logging
      req.consentId = activeConsent.id;
      req.consentValidated = true;
      next();
    } catch (err) {
      console.error('Consent validation error:', err);
      return res.status(500).json({ error: 'Consent verification failed' });
    }
  };
}

async function getUserProfile(userId) {
  const rows = await query(
    `SELECT u.id, u.phone, u.email, u.status, u.role, p.full_name, p.preferred_language
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;
  const row = rows[0];
  const meta = await getUserMeta(userId, ['avatar']);
  const verificationDocs = await listEntities({ type: 'verification_doc', userId });
  const verificationStatus = (() => {
    if (!verificationDocs.length) return 'Not Submitted';
    if (verificationDocs.some((doc) => doc.status === 'VERIFIED')) return 'Verified';
    if (verificationDocs.some((doc) => doc.status === 'PENDING')) return 'Pending';
    if (verificationDocs.some((doc) => doc.status === 'REJECTED')) return 'Rejected';
    return 'Not Submitted';
  })();
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    name: row.full_name || 'User',
    healthId: `NG-${row.id.slice(0, 8).toUpperCase()}`,
    avatar: meta.avatar || `https://picsum.photos/seed/${row.id}/100/100`,
    verified: verificationStatus,
    preferredLanguage: row.preferred_language || 'en',
    role: normalizeRoleValue(row.role || 'mother')
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/db/ping', async (req, res, next) => {
  try {
    const rows = await query('SELECT 1 AS ok');
    res.json({ ok: rows[0]?.ok === 1 });
  } catch (err) {
    next(err);
  }
});

app.get('/db/tables', async (req, res, next) => {
  try {
    const rows = await query('SHOW TABLES');
    const tables = rows.map(row => Object.values(row)[0]);
    res.json({ tables });
  } catch (err) {
    next(err);
  }
});

app.post('/auth/register', async (req, res, next) => {
  try {
    const { name, email, phone, password, preferred_language, role } = req.body || {};
    if (!name || !password || !phone) {
      return res.status(400).json({ error: 'name, phone, and password are required' });
    }

    const existing = await query(
      'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [email || null, phone]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    // Standardized role validation - matches frontend UserRole type
    const normalizedRole = normalizeRoleValue(role) || 'mother';
    const safeRole = CANONICAL_ROLES.has(normalizedRole) ? normalizedRole : 'mother';
    const healthId = `NG-${userId.slice(0, 8).toUpperCase()}`;

    await query(
      'INSERT INTO users (id, phone, email, password_hash, auth_provider, status, role, health_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, phone, email || null, passwordHash, 'local', 'active', safeRole, healthId]
    );

    await query(
      'INSERT INTO user_profiles (user_id, full_name, preferred_language) VALUES (?, ?, ?)',
      [userId, name, preferred_language || 'en']
    );

    const roleRows = await query('SELECT id FROM roles WHERE role_name = ? LIMIT 1', ['USER']);
    if (roleRows.length) {
      await query('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleRows[0].id]);
    }

    const user = await getUserProfile(userId);
    const token = jwt.sign({ sub: userId, role: user?.role }, JWT_SECRET, { expiresIn: '7d' });

    // Send welcome email (non-blocking)
    if (email) {
      sendWelcomeEmail(email, name).catch(err => 
        console.error('Failed to send welcome email:', err.message)
      );
    }

    res.status(201).json({ token, user });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const rows = await query(
      'SELECT id, email FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );

    // Always return success even if email doesn't exist (security best practice)
    // This prevents email enumeration attacks
    if (!rows.length) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return res.json({ 
        success: true, 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    }

    const user = rows[0];
    
    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { sub: user.id, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in database
    await query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())',
      [user.id, resetToken]
    );

    // Get user profile for name
    const userProfile = await getUserProfile(user.id);
    const userName = userProfile?.name || '';

    // Send password reset email
    let emailResult;
    try {
      emailResult = await sendPasswordResetEmail(email, resetToken, userName);
      console.log(`✓ Password reset email sent to: ${email}`);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError.message);
      // Continue even if email fails - token is already stored
    }

    // In development, also log the reset link for easy testing
    if (process.env.NODE_ENV === 'development') {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      console.log(`[DEV] Reset link: ${resetLink}`);
      res.json({ 
        success: true, 
        message: 'Password reset link has been sent to your email.',
        resetLink, // Only in development
        previewUrl: emailResult?.previewUrl // Test email preview URL
      });
    } else {
      res.json({ 
        success: true, 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    }
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword, password } = req.body || {};
    
    // Accept either newPassword or password for flexibility
    const pwd = newPassword || password;
    
    if (!token || !pwd) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    if (pwd.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.purpose !== 'password_reset') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token exists and hasn't been used
    const tokenRows = await query(
      'SELECT id, user_id, used_at FROM password_reset_tokens WHERE token = ? AND expires_at > NOW() LIMIT 1',
      [token]
    );

    if (!tokenRows.length) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const tokenRecord = tokenRows[0];
    
    if (tokenRecord.used_at) {
      return res.status(400).json({ error: 'This reset token has already been used' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(pwd, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [passwordHash, decoded.sub]
    );

    // Mark token as used
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
      [tokenRecord.id]
    );

    // Get user email and send confirmation
    const userRows = await query('SELECT email FROM users WHERE id = ? LIMIT 1', [decoded.sub]);
    if (userRows.length && userRows[0].email) {
      const userProfile = await getUserProfile(decoded.sub);
      sendPasswordResetConfirmationEmail(userRows[0].email, userProfile?.name || '').catch(err =>
        console.error('Failed to send password reset confirmation:', err.message)
      );
    }

    res.json({ 
      success: true, 
      message: 'Password has been reset successfully. You can now log in with your new password.' 
    });
  } catch (err) {
    next(err);
  }
});

app.post('/auth/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'identifier and password are required' });
    }

    const rows = await query(
      'SELECT id, password_hash, status FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [identifier, identifier]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRow = rows[0];

    const ok = await bcrypt.compare(password, userRow.password_hash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (userRow.status !== 'active') {
      let suspensionDetails = null;
      if (userRow.status === 'suspended') {
        try {
          const suspensions = await query(
            `SELECT id, data, created_at FROM app_entities WHERE type = 'user_suspension' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
            [userRow.id]
          );
          if (suspensions.length > 0) {
            const data = JSON.parse(suspensions[0].data || '{}');
            suspensionDetails = {
              id: data.id || suspensions[0].id,
              reason: data.reason || null,
              suspendedAt: data.suspendedAt || suspensions[0].created_at
            };
          }
        } catch (e) {}
      }

      const appealToken = userRow.status === 'suspended'
        ? jwt.sign(
            { sub: userRow.id, purpose: 'suspension_appeal' },
            JWT_SECRET,
            { expiresIn: '15m' }
          )
        : null;

      return res.status(403).json({
        error: userRow.status === 'suspended' ? 'Account suspended' : 'User is blocked',
        reason: userRow.status,
        suspension: suspensionDetails,
        appeal: userRow.status === 'suspended'
          ? {
              enabled: true,
              token: appealToken,
              expiresInMinutes: 15,
              endpoint: '/auth/suspension-appeal'
            }
          : { enabled: false }
      });
    }

    const user = await getUserProfile(userRow.id);
    const token = jwt.sign({ sub: userRow.id, role: user?.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

// Submit suspension appeal (show-cause request)
app.post('/auth/suspension-appeal', async (req, res, next) => {
  try {
    const { appealToken, message, identifier } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    let decoded;
    try {
      if (!appealToken) {
        throw new Error('Missing appeal token');
      }
      decoded = jwt.verify(appealToken, JWT_SECRET);
      if (decoded.purpose !== 'suspension_appeal') {
        return res.status(400).json({ error: 'Invalid appeal token' });
      }
    } catch (err) {
      decoded = null;
    }

    let userId = decoded?.sub || null;
    let userRows = [];

    if (!userId && identifier) {
      userRows = await query(
        'SELECT id, email, status FROM users WHERE email = ? OR phone = ? LIMIT 1',
        [identifier, identifier]
      );
      if (userRows.length) {
        userId = userRows[0].id;
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired appeal token. Please log in again.' });
    }

    if (!userRows.length) {
      userRows = await query(
        'SELECT id, email, status FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
    }

    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userRows[0].status !== 'suspended') {
      return res.status(400).json({ error: 'User is not suspended' });
    }

    const existingAppeals = await query(
      `SELECT id, data FROM app_entities WHERE type = 'suspension_appeal' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (existingAppeals.length) {
      try {
        const existingData = JSON.parse(existingAppeals[0].data || '{}');
        if ((existingData.status || 'pending') === 'pending') {
          return res.json({ success: true, appealId: existingAppeals[0].id, existing: true });
        }
      } catch {}
    }

    const appealId = uuidv4();
    const now = new Date();
    const payload = {
      id: appealId,
      userId,
      message,
      submittedAt: now.toISOString(),
      status: 'pending'
    };

    await query(
      `INSERT INTO app_entities (id, user_id, type, subtype, data, created_at, updated_at)
       VALUES (?, ?, 'suspension_appeal', NULL, ?, ?, ?)`,
      [appealId, userId, JSON.stringify(payload), now, now]
    );

    const savedAppeal = await query(
      `SELECT id FROM app_entities WHERE id = ? AND type = 'suspension_appeal' LIMIT 1`,
      [appealId]
    );
    if (!savedAppeal.length) {
      return res.status(500).json({ error: 'Failed to save appeal. Please try again.' });
    }

    try {
      const systemRoleOptions = getRoleFilterOptions('system_admin');
      const systemRolePlaceholders = systemRoleOptions.map(() => '?').join(', ');
      await query(
        `INSERT INTO admin_notifications (id, sender_user_id, recipient_user_id, notification_type, priority, title, message, action_required, related_entity_type, related_entity_id)
         SELECT ?, ?, id, 'SUSPENSION_APPEAL', 'HIGH', ?, ?, TRUE, 'suspension_appeal', ?
         FROM users WHERE role IN (${systemRolePlaceholders})`,
        [
          uuidv4(),
          userId,
          'Suspension Appeal Submitted',
          `A suspended user submitted a show-cause request. Appeal ID: ${appealId}`,
          appealId,
          ...systemRoleOptions
        ]
      );
    } catch (notifyErr) {
      console.warn('Failed to create admin appeal notification:', notifyErr.message);
    }

    try {
      const systemRoleOptions = getRoleFilterOptions('system_admin');
      const systemRolePlaceholders = systemRoleOptions.map(() => '?').join(', ');
      const admins = await query(
        `SELECT email FROM users WHERE role IN (${systemRolePlaceholders}) AND email IS NOT NULL`,
        systemRoleOptions
      );
      const userRows = await query(
        `SELECT u.email, COALESCE(p.full_name, 'User') as full_name
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );
      const userEmail = userRows[0]?.email || '';
      const userName = userRows[0]?.full_name || 'User';

      await Promise.all(
        admins.map((admin) =>
          sendSuspensionAppealEmail(admin.email, {
            userEmail,
            userName,
            message,
            appealId,
            submittedAt: now.toISOString()
          })
        )
      );
    } catch (emailErr) {
      console.warn('Failed to send admin appeal email:', emailErr.message);
    }

    res.json({ success: true, appealId });
  } catch (err) {
    next(err);
  }
});

app.get('/auth/me', requireAuth, checkSuspensionStatus, async (req, res, next) => {
  try {
    const user = await getUserProfile(req.user.sub);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

app.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const { name, preferred_language } = req.body || {};
    if (!name && !preferred_language) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    await query(
      'UPDATE user_profiles SET full_name = COALESCE(?, full_name), preferred_language = COALESCE(?, preferred_language) WHERE user_id = ?',
      [name || null, preferred_language || null, req.user.sub]
    );

    const user = await getUserProfile(req.user.sub);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

app.put('/profile/avatar', requireAuth, async (req, res, next) => {
  try {
    const { avatar } = req.body || {};
    if (!avatar) {
      return res.status(400).json({ error: 'avatar is required' });
    }
    await setUserMeta(req.user.sub, { avatar });
    const user = await getUserProfile(req.user.sub);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

const adminRouter = createAdminRouter({ requireAuth, requireRole });
const mapLegacyAdminPath = (prefix) => (req, res, next) => {
  const originalUrl = req.url;
  req.url = `${prefix}${originalUrl}`;
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    next(err);
  });
};

app.use('/api/admin', adminRouter);
app.use('/api/system-admin', mapLegacyAdminPath('/system'));
app.use('/api/ops-admin', mapLegacyAdminPath('/operations'));
app.use('/api', createAppRouter({ requireAuth, requireRole, requireConsentForPatient }));

app.get('/admin/tables', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    const metas = await Promise.all(TABLES.map(async (table) => {
      const meta = await getTableMeta(table);
      return { table, columns: meta.columns, pk: meta.pk };
    }));
    res.json({ tables: metas });
  } catch (err) {
    next(err);
  }
});

app.get('/admin/:table', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.includes(table)) {
      return res.status(404).json({ error: 'Unknown table' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const rows = await query(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ rows });
  } catch (err) {
    next(err);
  }
});

app.get('/admin/:table/row', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.includes(table)) {
      return res.status(404).json({ error: 'Unknown table' });
    }

    const meta = await getTableMeta(table);
    if (!meta.pk.length) {
      return res.status(400).json({ error: 'Table has no primary key' });
    }

    const whereClauses = [];
    const params = [];
    for (const pk of meta.pk) {
      const value = req.query[pk];
      if (!value) {
        return res.status(400).json({ error: `Missing primary key ${pk}` });
      }
      whereClauses.push(`\`${pk}\` = ?`);
      params.push(value);
    }

    const rows = await query(`SELECT * FROM \`${table}\` WHERE ${whereClauses.join(' AND ')} LIMIT 1`, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'Row not found' });
    }
    res.json({ row: rows[0] });
  } catch (err) {
    next(err);
  }
});

app.post('/admin/:table', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.includes(table)) {
      return res.status(404).json({ error: 'Unknown table' });
    }

    const meta = await getTableMeta(table);
    const body = req.body || {};

    const columns = meta.columns.map(col => col.name);
    const autoCols = new Set(meta.columns.filter(col => col.autoIncrement).map(col => col.name));

    if (columns.includes('id') && !body.id && !autoCols.has('id')) {
      body.id = uuidv4();
    }

    const keys = Object.keys(body).filter(key => columns.includes(key) && !autoCols.has(key));
    if (!keys.length) {
      return res.status(400).json({ error: 'No valid columns supplied' });
    }

    const placeholders = keys.map(() => '?').join(', ');
    const colsSql = keys.map(key => `\`${key}\``).join(', ');
    const values = keys.map(key => body[key]);

    await query(`INSERT INTO \`${table}\` (${colsSql}) VALUES (${placeholders})`, values);

    res.status(201).json({ id: body.id || null });
  } catch (err) {
    next(err);
  }
});

app.put('/admin/:table/row', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.includes(table)) {
      return res.status(404).json({ error: 'Unknown table' });
    }

    const meta = await getTableMeta(table);
    if (!meta.pk.length) {
      return res.status(400).json({ error: 'Table has no primary key' });
    }

    const whereClauses = [];
    const params = [];
    for (const pk of meta.pk) {
      const value = req.query[pk];
      if (!value) {
        return res.status(400).json({ error: `Missing primary key ${pk}` });
      }
      whereClauses.push(`\`${pk}\` = ?`);
      params.push(value);
    }

    const columns = meta.columns.map(col => col.name);
    const autoCols = new Set(meta.columns.filter(col => col.autoIncrement).map(col => col.name));

    const updates = Object.keys(req.body || {})
      .filter(key => columns.includes(key) && !autoCols.has(key) && !meta.pk.includes(key));

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid columns supplied' });
    }

    const setSql = updates.map(key => `\`${key}\` = ?`).join(', ');
    const values = updates.map(key => req.body[key]);

    await query(
      `UPDATE \`${table}\` SET ${setSql} WHERE ${whereClauses.join(' AND ')}`,
      [...values, ...params]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/admin/:table/row', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!TABLES.includes(table)) {
      return res.status(404).json({ error: 'Unknown table' });
    }

    const meta = await getTableMeta(table);
    if (!meta.pk.length) {
      return res.status(400).json({ error: 'Table has no primary key' });
    }

    const whereClauses = [];
    const params = [];
    for (const pk of meta.pk) {
      const value = req.query[pk];
      if (!value) {
        return res.status(400).json({ error: `Missing primary key ${pk}` });
      }
      whereClauses.push(`\`${pk}\` = ?`);
      params.push(value);
    }

    await query(`DELETE FROM \`${table}\` WHERE ${whereClauses.join(' AND ')}`, params);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/admin/seed', requireAuth, requireRole('system_admin'), checkSuspensionStatus, async (req, res, next) => {
  try {
    await seedDatabase();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  await ensureAdminSchema();
  await assertCoreTables();
  await ensureAppTables();
  await seedAppData();
  
  // Verify email configuration
  console.log('Verifying email configuration...');
  const emailConfigValid = await verifyEmailConfig();
  if (emailConfigValid) {
    console.log('✓ Email service is ready');
  } else {
    console.warn('⚠ Email service not configured. Password reset emails will not be sent.');
    console.warn('  Configure EMAIL_USER and EMAIL_PASSWORD in .env to enable email functionality.');
  }
  
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

// Export middleware functions for use in routes
export { requireAuth, requireRole, requireConsentForPatient, checkSuspensionStatus };

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
