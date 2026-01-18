import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from './db.js';
import { seedDatabase } from './seed.js';
import 'dotenv/config';

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin === '*' ? undefined : corsOrigin.split(',').map(v => v.trim()) }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

const JWT_SECRET = process.env.JWT_SECRET || 'change-me';
const DB_NAME = process.env.DB_NAME || 'neonest';

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
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function getUserProfile(userId) {
  const rows = await query(
    `SELECT u.id, u.phone, u.email, u.status, p.full_name, p.preferred_language
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    name: row.full_name || 'User',
    healthId: `NG-${row.id.slice(0, 8).toUpperCase()}`,
    avatar: `https://picsum.photos/seed/${row.id}/100/100`,
    verified: 'Not Submitted'
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
    const { name, email, phone, password, preferred_language } = req.body || {};
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

    await query(
      'INSERT INTO users (id, phone, email, password_hash, auth_provider, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, phone, email || null, passwordHash, 'local', 'active']
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
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
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
    if (userRow.status !== 'active') {
      return res.status(403).json({ error: 'User is blocked' });
    }

    const ok = await bcrypt.compare(password, userRow.password_hash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = await getUserProfile(userRow.id);
    const token = jwt.sign({ sub: userRow.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (err) {
    next(err);
  }
});

app.get('/auth/me', requireAuth, async (req, res, next) => {
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

app.get('/admin/tables', async (req, res, next) => {
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

app.get('/admin/:table', async (req, res, next) => {
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

app.get('/admin/:table/row', async (req, res, next) => {
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

app.post('/admin/:table', async (req, res, next) => {
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

app.put('/admin/:table/row', async (req, res, next) => {
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

app.delete('/admin/:table/row', async (req, res, next) => {
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

app.post('/admin/seed', async (req, res, next) => {
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
