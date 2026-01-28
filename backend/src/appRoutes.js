import express from 'express';
import {
  listCatalog,
  listEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  upsertBySubtype,
  getBySubtype,
  getUserMeta,
  setUserMeta,
  deleteEntitiesByTypes,
  seedAppData
} from './appStore.js';
import { query } from './db.js';
import { normalizeRoleValue, getRoleFilterOptions } from './roles.js';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_MEETING_URL = 'https://meet.google.com/abc-defg-hij';

export function createAppRouter({ requireAuth, requireRole, requireConsentForPatient }) {
  const router = express.Router();

  const createNotification = async (userId, payload) => {
    const notification = {
      userId,
      type: payload.type,
      entityId: payload.entityId,
      title: payload.title,
      message: payload.message,
      link: payload.link,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    await createEntity({ type: 'notification', userId, data: notification });
  };

  const parseJson = (value, fallback = {}) => {
    try {
      return JSON.parse(value || '{}');
    } catch (err) {
      return fallback;
    }
  };

  const resolveUserRole = async (req) => {
    if (req.userRole) return req.userRole;
    const tokenRole = normalizeRoleValue(req.user?.role);
    if (tokenRole) return tokenRole;
    if (!req.user?.sub) return 'mother';
    const rows = await query('SELECT role FROM users WHERE id = ? LIMIT 1', [req.user.sub]);
    return normalizeRoleValue(rows[0]?.role) || 'mother';
  };

  const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  const toTrimmedString = (value, maxLen = 5000) => {
    if (value === null || value === undefined) return '';
    const str = String(value).trim();
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) : str;
  };

  const toOptionalString = (value, maxLen = 5000) => {
    const str = toTrimmedString(value, maxLen);
    return str ? str : null;
  };

  const toNonNegativeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : null;
  };

  const toPositiveNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  const isValidId = (value) => /^[a-zA-Z0-9_-]{2,100}$/.test(String(value || ''));

  const isValidDateValue = (value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime());
  };

  const isPastDateValue = (value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.getTime() < Date.now();
  };

  const normalizeEnumValue = (value, allowed) => {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (allowed.has(str)) return str;
    const lower = str.toLowerCase();
    for (const item of allowed) {
      if (String(item).toLowerCase() === lower) {
        return item;
      }
    }
    return null;
  };

  const allowedAppointmentTypes = new Set(['Online', 'Offline', 'Both']);
  const allowedVaccineStatuses = new Set(['Taken', 'Pending', 'Missed']);
  const allowedMealTypes = new Set(['Breakfast', 'Lunch', 'Dinner', 'Snack']);

  const getCatalogItem = async (type, id) => {
    if (!id) return null;
    const rows = await query(
      `SELECT data FROM app_catalog WHERE id = ? AND type = ? LIMIT 1`,
      [id, type]
    );
    if (!rows.length) return null;
    return parseJson(rows[0].data, {});
  };

  const dayIndexMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };

  const normalizeDayOfWeek = (value) => {
    if (typeof value === 'number' && value >= 0 && value <= 6) return value;
    if (typeof value === 'string') {
      const key = value.trim().toLowerCase();
      if (dayIndexMap[key] !== undefined) return dayIndexMap[key];
      const parsed = Number(key);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 6) return parsed;
    }
    return null;
  };

  const normalizeAppointmentStatus = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const status = String(value).trim().toLowerCase();
    if (status === 'completed' || status === 'complete') return 'completed';
    if (status === 'in-progress' || status === 'in progress') return 'in-progress';
    if (status === 'cancelled' || status === 'canceled' || status === 'cancel') return 'cancelled';
    if (status === 'upcoming' || status === 'scheduled' || status === 'pending') return 'scheduled';
    return null;
  };

  const normalizeConsultationStatus = (value) => normalizeAppointmentStatus(value);

  const normalizeConsultationType = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const type = String(value).toLowerCase();
    if (type.includes('phone')) return 'phone';
    if (type.includes('video') || type.includes('online')) return 'video';
    if (type.includes('in-person') || type.includes('offline') || type.includes('clinic')) return 'in-person';
    return null;
  };

  const parseTimeTo24h = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    const match24 = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match24) {
      const hours = Number(match24[1]);
      const minutes = Number(match24[2]);
      const seconds = match24[3] ? Number(match24[3]) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
    const match12 = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (match12) {
      let hours = Number(match12[1]);
      const minutes = Number(match12[2]);
      const seconds = match12[3] ? Number(match12[3]) : 0;
      const meridiem = match12[4].toLowerCase();
      if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59) {
        if (meridiem === 'pm' && hours !== 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }
    return null;
  };

  const buildScheduledAt = (dateValue, timeValue) => {
    if (!dateValue) return null;
    const dateString = String(dateValue).trim();
    if (dateString.includes('T')) {
      const parsed = new Date(dateString);
      return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    }
    const time24 = parseTimeTo24h(timeValue);
    if (time24) {
      const parsed = new Date(`${dateString}T${time24}`);
      return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    }
    const parsed = new Date(dateString);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  };

  const getScheduledAt = (appointment) => {
    if (!appointment) return null;
    if (appointment.scheduledAt) {
      const parsed = new Date(appointment.scheduledAt);
      if (Number.isFinite(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
    return buildScheduledAt(appointment.date, appointment.time);
  };

  const normalizeReviewRating = (value) => {
    const rating = Number(value);
    if (!Number.isFinite(rating)) return null;
    if (rating < 1 || rating > 5) return null;
    return Math.round(rating);
  };

  const isReviewableAppointment = (appointment) => {
    if (!appointment) return false;
    const status = String(appointment.status || '').toLowerCase();
    if (status.includes('cancel')) return false;
    if (status.includes('complete')) return true;
    const scheduledAt = getScheduledAt(appointment);
    if (!scheduledAt) return false;
    const date = new Date(scheduledAt);
    if (!Number.isFinite(date.getTime())) return false;
    return date.getTime() < Date.now();
  };

  const getDoctorReviewSummary = async () => {
    const rows = await query(`SELECT data FROM app_entities WHERE type = 'doctor_review'`);
    const summary = new Map();
    rows.forEach((row) => {
      const data = parseJson(row.data, {});
      const doctorId = data.doctorId;
      const rating = normalizeReviewRating(data.rating);
      if (!doctorId || rating === null) return;
      const existing = summary.get(doctorId) || { total: 0, count: 0 };
      existing.total += rating;
      existing.count += 1;
      summary.set(doctorId, existing);
    });
    return summary;
  };

  const attachDoctorReviewStats = (items, summary) =>
    items.map((item) => {
      const stats = summary.get(item.id);
      const count = stats?.count || 0;
      const average = count ? Number((stats.total / count).toFixed(1)) : null;
      return {
        ...item,
        rating: Number.isFinite(average) ? average : item.rating ?? null,
        reviewCount: count
      };
    });

  const normalizePhone = (value) => String(value || '').replace(/[\s\-()]/g, '');
  const isValidPhone = (value) => /^[\d\s+()-]+$/.test(String(value || ''));
  const allowedBloodGroups = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

  const calculateAge = (dob) => {
    if (!dob) return null;
    const date = new Date(dob);
    if (Number.isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const loadPatientProfiles = async (patientIds = []) => {
    const profileMap = new Map();
    const uniqueIds = Array.from(new Set(patientIds.filter(Boolean)));
    if (!uniqueIds.length) return profileMap;

    const placeholders = uniqueIds.map(() => '?').join(',');

    try {
      const entityRows = await query(
        `SELECT user_id, data FROM app_entities WHERE type = 'user_profile' AND user_id IN (${placeholders})`,
        uniqueIds
      );
      entityRows.forEach((row) => {
        const profileData = parseJson(row.data, {});
        profileMap.set(row.user_id, { ...profileData });
      });
    } catch (err) {
      // Ignore profile lookup failures; fallback handled downstream.
    }

    try {
      const userProfileRows = await query(
        `SELECT user_id, full_name, date_of_birth FROM user_profiles WHERE user_id IN (${placeholders})`,
        uniqueIds
      );
      userProfileRows.forEach((row) => {
        const existing = profileMap.get(row.user_id) || {};
        profileMap.set(row.user_id, {
          ...existing,
          full_name: row.full_name,
          date_of_birth: row.date_of_birth
        });
      });
    } catch (err) {
      // Ignore if table not available.
    }

    return profileMap;
  };

  const buildConsultationFromAppointment = (appointment, patientProfiles, defaultFee) => {
    const patientId = appointment.patientId || appointment.userId || null;
    const patientProfile = patientProfiles.get(patientId) || {};

    const patientName =
      appointment.patientName ??
      patientProfile.full_name ??
      patientProfile.name ??
      patientProfile.username ??
      null;
    const resolveNumber = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };

    const patientAge =
      resolveNumber(appointment.patientAge) ?? calculateAge(patientProfile.date_of_birth) ?? null;
    const gestationalWeek =
      resolveNumber(appointment.gestationalWeek) ?? resolveNumber(patientProfile.gestationalWeek) ?? null;

    const scheduledAt =
      getScheduledAt(appointment) ||
      appointment.createdAt ||
      null;

    const feeValue =
      appointment.fee === null || appointment.fee === undefined || appointment.fee === ''
        ? null
        : Number(appointment.fee);
    const defaultFeeValue =
      defaultFee === null || defaultFee === undefined || defaultFee === '' ? null : Number(defaultFee);
    const fee =
      Number.isFinite(feeValue) ? feeValue : Number.isFinite(defaultFeeValue) ? defaultFeeValue : null;

    const durationValue =
      appointment.duration === null || appointment.duration === undefined || appointment.duration === ''
        ? null
        : Number(appointment.duration);
    const duration = Number.isFinite(durationValue) ? durationValue : null;

    return {
      id: appointment.id || appointment.consultationId || uuidv4(),
      patientId,
      patientName,
      patientAge,
      gestationalWeek,
      scheduledAt,
      status: normalizeConsultationStatus(appointment.status) || 'scheduled',
      type: normalizeConsultationType(appointment.type),
      duration,
      notes: appointment.notes ?? null,
      prescriptionId: appointment.prescriptionId || null,
      fee,
      consentGranted: appointment.consentGranted ?? null
    };
  };

  const normalizeScheduleItems = (items = []) =>
    items
      .map((item, index) => {
        const dayValue = normalizeDayOfWeek(item.dayOfWeek ?? item.day ?? index);
        if (dayValue === null) return null;
        return {
          id: item.id || `day-${dayValue}`,
          doctorId: item.doctorId || '',
          dayOfWeek: dayValue,
          startTime: item.startTime || item.start || '09:00',
          endTime: item.endTime || item.end || '17:00',
          isAvailable: item.isAvailable ?? item.available ?? false,
          maxConsultations: item.maxConsultations || item.max || 10
        };
      })
      .filter(Boolean);

  router.get('/catalog/:type', async (req, res, next) => {
    try {
      const map = {
        doctors: 'doctor',
        hospitals: 'hospital',
        medicines: 'medicine'
      };
      const type = map[req.params.type];
      if (!type) {
        return res.status(404).json({ error: 'Unknown catalog type' });
      }
      const items = await listCatalog(type);
      if (type === 'doctor') {
        const summary = await getDoctorReviewSummary();
        return res.json({ items: attachDoctorReviewStats(items, summary) });
      }
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.get('/user/meta', requireAuth, async (req, res, next) => {
    try {
      const keys = String(req.query.keys || 'hydration,pregnancyWeek,avatar')
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean);
      const meta = await getUserMeta(req.user.sub, keys);
      res.json({ meta });
    } catch (err) {
      next(err);
    }
  });

  router.put('/user/meta', requireAuth, async (req, res, next) => {
    try {
      const allowed = ['hydration', 'pregnancyWeek', 'avatar'];
      const updates = {};
      allowed.forEach((key) => {
        if (req.body?.[key] !== undefined) {
          updates[key] = req.body[key];
        }
      });
      if (!Object.keys(updates).length) {
        return res.status(400).json({ error: 'No valid meta fields provided' });
      }
      await setUserMeta(req.user.sub, updates);
      const meta = await getUserMeta(req.user.sub, Object.keys(updates));
      res.json({ meta });
    } catch (err) {
      next(err);
    }
  });

  router.get('/health/history', requireAuth, async (req, res, next) => {
    try {
      const metric = String(req.query.metric || '').trim();
      if (!metric) {
        return res.status(400).json({ error: 'metric is required' });
      }
      const items = await listEntities({
        type: 'health_history',
        userId: req.user.sub,
        subtype: metric
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/health/history', requireAuth, async (req, res, next) => {
    try {
      const { metric, date, value } = req.body || {};
      if (!metric || !date || !value) {
        return res.status(400).json({ error: 'metric, date, and value are required' });
      }
      const item = await createEntity({
        type: 'health_history',
        userId: req.user.sub,
        subtype: metric,
        data: { date, value }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/appointments', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'appointment', userId: req.user.sub });
      const normalized = items.map((item) => ({
        ...item,
        status: normalizeAppointmentStatus(item.status) || item.status,
        scheduledAt: item.scheduledAt || getScheduledAt(item)
      }));
      res.json({ items: normalized });
    } catch (err) {
      next(err);
    }
  });

  router.post('/appointments', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const doctorId = toTrimmedString(data.doctorId, 100);
      const date = toTrimmedString(data.date, 100);
      const time = toTrimmedString(data.time, 50);

      if (!doctorId || !date || !time) {
        return res.status(400).json({ error: 'doctorId, date, and time are required' });
      }
      if (!isValidId(doctorId)) {
        return res.status(400).json({ error: 'Invalid doctorId format' });
      }

      const doctor = await getCatalogItem('doctor', doctorId);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor not found' });
      }

      const scheduledAt = buildScheduledAt(date, time);
      if (!scheduledAt || !isValidDateValue(scheduledAt)) {
        return res.status(400).json({ error: 'Invalid appointment date or time' });
      }
      if (isPastDateValue(scheduledAt)) {
        return res.status(400).json({ error: 'Appointment date must be in the future' });
      }

      const availableSlots = Array.isArray(doctor.availableSlots)
        ? doctor.availableSlots.map((slot) => toTrimmedString(slot, 50))
        : [];
      if (availableSlots.length) {
        const matchesSlot = availableSlots.some(
          (slot) => slot.toLowerCase() === time.toLowerCase()
        );
        if (!matchesSlot) {
          return res.status(400).json({ error: 'Selected time is not available for this doctor' });
        }
      }

      const normalizedStatus = normalizeAppointmentStatus(data.status) || 'scheduled';
      const appointmentType =
        normalizeEnumValue(data.type, allowedAppointmentTypes) ||
        normalizeEnumValue(doctor.type, allowedAppointmentTypes);
      if (!appointmentType) {
        return res.status(400).json({ error: 'Invalid appointment type' });
      }

      const payload = {
        ...data,
        userId: req.user.sub,
        patientId: req.user.sub,
        doctorId,
        doctorName: toTrimmedString(data.doctorName, 120) || doctor.name || null,
        specialty: toTrimmedString(data.specialty, 120) || doctor.specialty || null,
        date,
        time,
        status: normalizedStatus,
        scheduledAt,
        type: appointmentType,
        notes: toOptionalString(data.notes, 2000) || undefined,
        meetingUrl:
          toOptionalString(data.meetingUrl, 500) ||
          (String(appointmentType).toLowerCase().includes('online') ? DEFAULT_MEETING_URL : undefined)
      };
      const item = await createEntity({
        type: 'appointment',
        userId: req.user.sub,
        data: payload
      });

      // Notify patient
      await createNotification(req.user.sub, {
        type: 'APPOINTMENT',
        entityId: item.id,
        title: 'Appointment Scheduled',
        message: `Confirmed for ${item.date}.`,
        link: '/appointments'
      });

      // Notify doctor about new appointment
      await createNotification(data.doctorId, {
        type: 'NEW_APPOINTMENT',
        entityId: item.id,
        title: 'New Appointment Request',
        message: `New appointment scheduled for ${item.date} at ${item.time}.`,
        link: '/doctor/consultations'
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/appointments/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({
        id: req.params.id,
        type: 'appointment',
        userId: req.user.sub
      });
      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      const updates = req.body || {};
      if (updates.status !== undefined) {
        const normalized = normalizeAppointmentStatus(updates.status);
        if (!normalized) {
          return res.status(400).json({ error: 'Invalid appointment status' });
        }
        updates.status = normalized;
      }

      if (updates.type !== undefined) {
        const normalizedType = normalizeEnumValue(updates.type, allowedAppointmentTypes);
        if (!normalizedType) {
          return res.status(400).json({ error: 'Invalid appointment type' });
        }
        updates.type = normalizedType;
      }

      if (updates.date !== undefined) {
        updates.date = toTrimmedString(updates.date, 100);
      }
      if (updates.time !== undefined) {
        updates.time = toTrimmedString(updates.time, 50);
      }
      if (updates.notes !== undefined) {
        updates.notes = toOptionalString(updates.notes, 2000) || undefined;
      }

      if ((updates.date || updates.time) && !updates.scheduledAt) {
        const nextDate = updates.date || existing.date;
        const nextTime = updates.time || existing.time;
        const scheduledAt = buildScheduledAt(nextDate, nextTime);
        if (!scheduledAt || !isValidDateValue(scheduledAt)) {
          return res.status(400).json({ error: 'Invalid appointment date or time' });
        }
        const nextStatus =
          updates.status || normalizeAppointmentStatus(existing.status) || existing.status;
        if (nextStatus === 'scheduled' && isPastDateValue(scheduledAt)) {
          return res.status(400).json({ error: 'Appointment date must be in the future' });
        }
        updates.scheduledAt = scheduledAt;
      }

      const item = await updateEntity({
        id: req.params.id,
        type: 'appointment',
        userId: req.user.sub,
        data: updates
      });

      if (updates.status === 'cancelled') {
        await createNotification(req.user.sub, {
          type: 'APPOINTMENT_CANCELED',
          entityId: item.id,
          title: 'Appointment Canceled',
          message: `Your appointment for ${item.date} has been canceled.`,
          link: '/appointments'
        });
      }

      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/appointments/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'appointment',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.get('/doctor-reviews', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'doctor_review', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/doctor-reviews', requireAuth, async (req, res, next) => {
    try {
      const { doctorId, doctorName, rating, reviewText, appointmentId } = req.body || {};
      const safeDoctorId = toTrimmedString(doctorId, 100);
      const safeAppointmentId = toOptionalString(appointmentId, 100);

      if (!safeDoctorId || rating === undefined || rating === null) {
        return res.status(400).json({ error: 'doctorId and rating are required' });
      }
      if (!isValidId(safeDoctorId)) {
        return res.status(400).json({ error: 'Invalid doctorId format' });
      }

      const doctor = await getCatalogItem('doctor', safeDoctorId);
      if (!doctor) {
        return res.status(404).json({ error: 'Doctor not found' });
      }

      const normalizedRating = normalizeReviewRating(rating);
      if (normalizedRating === null) {
        return res.status(400).json({ error: 'rating must be between 1 and 5' });
      }

      let appointment = null;
      if (safeAppointmentId) {
        if (!isValidId(safeAppointmentId)) {
          return res.status(400).json({ error: 'Invalid appointmentId format' });
        }
        const appointmentRows = await query(
          `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
          [safeAppointmentId]
        );
        if (!appointmentRows.length) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        appointment = parseJson(appointmentRows[0].data, {});
        const appointmentUserId = appointmentRows[0].user_id || appointment.userId || appointment.patientId;
        if (appointmentUserId && appointmentUserId !== req.user.sub) {
          return res.status(403).json({ error: 'Not authorized to review this appointment' });
        }
        if (appointment.doctorId && appointment.doctorId !== safeDoctorId) {
          return res.status(400).json({ error: 'Doctor mismatch for appointment' });
        }
        if (!isReviewableAppointment(appointment)) {
          return res.status(400).json({ error: 'Reviews are allowed after appointment completion' });
        }
      }

      const subtype = safeAppointmentId ? `appointment:${safeAppointmentId}` : `doctor:${safeDoctorId}`;
      const existing = await getBySubtype({ type: 'doctor_review', userId: req.user.sub, subtype });
      if (existing) {
        return res.status(409).json({ error: 'Review already submitted' });
      }

      const payload = {
        userId: req.user.sub,
        doctorId: safeDoctorId,
        doctorName:
          toTrimmedString(doctorName, 120) ||
          doctor?.name ||
          appointment?.doctorName ||
          null,
        appointmentId: safeAppointmentId || null,
        rating: normalizedRating,
        reviewText: toOptionalString(reviewText, 2000) || null
      };

      const item = await createEntity({
        type: 'doctor_review',
        userId: req.user.sub,
        subtype,
        data: payload
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/vaccines', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'vaccine', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/vaccines', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const name = toTrimmedString(data.name, 120);
      const dueDate = toTrimmedString(data.dueDate, 100);
      if (!name || !dueDate) {
        return res.status(400).json({ error: 'name and dueDate are required' });
      }
      if (!isValidDateValue(dueDate)) {
        return res.status(400).json({ error: 'Invalid dueDate' });
      }
      const status = normalizeEnumValue(data.status, allowedVaccineStatuses) || 'Pending';
      const item = await createEntity({
        type: 'vaccine',
        userId: req.user.sub,
        data: {
          ...data,
          name,
          dueDate,
          status,
          userId: req.user.sub
        }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/vaccines/:id', requireAuth, async (req, res, next) => {
    try {
      const updates = req.body || {};
      if (updates.status !== undefined) {
        const normalized = normalizeEnumValue(updates.status, allowedVaccineStatuses);
        if (!normalized) {
          return res.status(400).json({ error: 'Invalid vaccine status' });
        }
        updates.status = normalized;
      }
      if (updates.name !== undefined) {
        updates.name = toTrimmedString(updates.name, 120);
      }
      if (updates.dueDate !== undefined) {
        const dueDate = toTrimmedString(updates.dueDate, 100);
        if (!dueDate || !isValidDateValue(dueDate)) {
          return res.status(400).json({ error: 'Invalid dueDate' });
        }
        updates.dueDate = dueDate;
      }
      const item = await updateEntity({
        id: req.params.id,
        type: 'vaccine',
        userId: req.user.sub,
        data: updates
      });
      if (!item) {
        return res.status(404).json({ error: 'Vaccine not found' });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/nutrition', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'nutrition_log', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/nutrition', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const name = toTrimmedString(data.name, 120);
      const calories = toPositiveNumber(data.calories);
      const mealType = normalizeEnumValue(data.type, allowedMealTypes);
      if (data.type !== undefined && !mealType) {
        return res.status(400).json({ error: 'Invalid meal type' });
      }
      if (!name || calories === null) {
        return res.status(400).json({ error: 'name and calories are required' });
      }
      const payload = {
        ...data,
        userId: req.user.sub,
        name,
        calories,
        type: mealType || undefined,
        time: toTrimmedString(data.time, 40) || new Date().toLocaleTimeString()
      };
      const item = await createEntity({
        type: 'nutrition_log',
        userId: req.user.sub,
        data: payload
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/community/posts', async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'community_post' });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts', requireAuth, async (req, res, next) => {
    try {
      const { content, image, authorName } = req.body || {};
      const safeContent = toTrimmedString(content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: 'content is required' });
      }
      const profileMap = await loadPatientProfiles([req.user.sub]);
      const profile = profileMap.get(req.user.sub) || {};
      const resolvedAuthorName =
        toTrimmedString(authorName, 80) ||
        profile.full_name ||
        profile.name ||
        profile.username ||
        'Anonymous';
      const item = await createEntity({
        type: 'community_post',
        userId: req.user.sub,
        data: {
          userId: req.user.sub,
          authorName: resolvedAuthorName,
          content: safeContent,
          image: toOptionalString(image, 500) || undefined,
          likes: [],
          comments: [],
          createdAt: new Date().toISOString()
        }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/community/posts/:id', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (existing.userId && existing.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to delete this post' });
      }
      const ok = await deleteEntity({ id: req.params.id, type: 'community_post' });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts/:id/like', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const likes = Array.isArray(existing.likes) ? existing.likes : [];
      const hasLiked = likes.includes(req.user.sub);
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { likes: hasLiked ? likes.filter((id) => id !== req.user.sub) : [...likes, req.user.sub] }
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.post('/community/posts/:id/comments', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const { content, authorName } = req.body || {};
      const safeContent = toTrimmedString(content, 2000);
      if (!safeContent) {
        return res.status(400).json({ error: 'content is required' });
      }
      const profileMap = await loadPatientProfiles([req.user.sub]);
      const profile = profileMap.get(req.user.sub) || {};
      const resolvedAuthorName =
        toTrimmedString(authorName, 80) ||
        profile.full_name ||
        profile.name ||
        profile.username ||
        'Anonymous';
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const newComment = {
        id: uuidv4(),
        userId: req.user.sub,
        authorName: resolvedAuthorName,
        content: safeContent,
        createdAt: new Date().toISOString(),
        replies: []
      };
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { comments: [...comments, newComment] }
      });
      res.status(201).json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/community/posts/:id/comments/:commentId', requireAuth, async (req, res, next) => {
    try {
      const existing = await getEntity({ id: req.params.id, type: 'community_post' });
      if (!existing) {
        return res.status(404).json({ error: 'Post not found' });
      }
      const comments = Array.isArray(existing.comments) ? existing.comments : [];
      const comment = comments.find((c) => c.id === req.params.commentId);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      if (comment.userId && comment.userId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }
      const updated = await updateEntity({
        id: req.params.id,
        type: 'community_post',
        data: { comments: comments.filter((c) => c.id !== req.params.commentId) }
      });
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.get('/journal', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'journal_entry', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/journal', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const content = toTrimmedString(data.content, 4000);
      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }
      const dateValue = toTrimmedString(data.date, 50) || new Date().toISOString();
      if (!isValidDateValue(dateValue)) {
        return res.status(400).json({ error: 'Invalid journal date' });
      }
      const payload = {
        ...data,
        title: toTrimmedString(data.title, 120) || undefined,
        mood: toTrimmedString(data.mood, 40) || undefined,
        content,
        userId: req.user.sub,
        date: dateValue
      };
      const item = await createEntity({
        type: 'journal_entry',
        userId: req.user.sub,
        data: payload
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/journal/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'journal_entry',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.get('/notifications', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'notification', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/notifications/:id', requireAuth, async (req, res, next) => {
    try {
      const item = await updateEntity({
        id: req.params.id,
        type: 'notification',
        userId: req.user.sub,
        data: { isRead: true }
      });
      if (!item) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post('/notifications/mark-all', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'notification', userId: req.user.sub });
      for (const item of items) {
        if (!item.isRead) {
          await updateEntity({
            id: item.id,
            type: 'notification',
            userId: req.user.sub,
            data: { isRead: true }
          });
        }
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile/docs', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'verification_doc', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.put('/profile/docs', requireAuth, async (req, res, next) => {
    try {
      const { type, fileName, fileUrl } = req.body || {};
      if (!type || !fileUrl) {
        return res.status(400).json({ error: 'type and fileUrl are required' });
      }
      const item = await upsertBySubtype({
        type: 'verification_doc',
        userId: req.user.sub,
        subtype: type,
        data: {
          userId: req.user.sub,
          type,
          status: 'PENDING',
          fileName,
          fileUrl,
          uploadedAt: new Date().toISOString()
        }
      });
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile/medical', requireAuth, async (req, res, next) => {
    try {
      let item = await getBySubtype({
        type: 'medical_report',
        userId: req.user.sub,
        subtype: 'default'
      });
      if (!item) {
        item = await getBySubtype({
          type: 'medical_report',
          userId: req.user.sub,
          subtype: 'main'
        });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.put('/profile/medical', requireAuth, async (req, res, next) => {
    try {
      const { bloodGroup = '', allergies = '', diabetesStatus = false, knownConditions = '' } = req.body || {};
      const normalizedBloodGroup = toTrimmedString(bloodGroup, 5).toUpperCase();
      if (normalizedBloodGroup && !allowedBloodGroups.has(normalizedBloodGroup)) {
        return res.status(400).json({ error: 'Invalid blood group' });
      }
      const payload = {
        bloodGroup: normalizedBloodGroup,
        allergies: toTrimmedString(allergies, 1000),
        diabetesStatus: Boolean(diabetesStatus),
        knownConditions: toTrimmedString(knownConditions, 1000)
      };
      const item = await upsertBySubtype({
        type: 'medical_report',
        userId: req.user.sub,
        subtype: 'default',
        data: payload
      });
      const legacy = await getBySubtype({
        type: 'medical_report',
        userId: req.user.sub,
        subtype: 'main'
      });
      if (legacy && legacy.id && legacy.id !== item.id) {
        await updateEntity({
          id: legacy.id,
          type: 'medical_report',
          userId: req.user.sub,
          subtype: 'main',
          data: payload
        });
      }
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.get('/profile/visits', requireAuth, async (req, res, next) => {
    try {
      const items = await listEntities({ type: 'doctor_visit', userId: req.user.sub });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/profile/visits', requireAuth, async (req, res, next) => {
    try {
      const { doctorName, clinic, date, reason, notes } = req.body || {};
      const safeDoctorName = toTrimmedString(doctorName, 120);
      const safeClinic = toTrimmedString(clinic, 120);
      const safeDate = toTrimmedString(date, 50);
      const safeReason = toTrimmedString(reason, 500);
      if (!safeDoctorName || !safeClinic || !safeDate || !safeReason) {
        return res.status(400).json({ error: 'doctorName, clinic, date, and reason are required' });
      }
      if (!isValidDateValue(safeDate)) {
        return res.status(400).json({ error: 'Invalid visit date' });
      }
      const item = await createEntity({
        type: 'doctor_visit',
        userId: req.user.sub,
        data: {
          doctorName: safeDoctorName,
          clinic: safeClinic,
          date: safeDate,
          reason: safeReason,
          notes: toOptionalString(notes, 1000) || undefined,
          userId: req.user.sub
        }
      });
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/profile/visits/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'doctor_visit',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  router.post('/profile/reset', requireAuth, async (req, res, next) => {
    try {
      const removed = await deleteEntitiesByTypes(req.user.sub, [
        'health_history',
        'appointment',
        'vaccine',
        'nutrition_log',
        'journal_entry',
        'doctor_visit',
        'verification_doc',
        'medical_report'
      ]);
      await setUserMeta(req.user.sub, { hydration: 4, pregnancyWeek: 24 });
      res.json({ ok: true, removed });
    } catch (err) {
      next(err);
    }
  });

  router.post('/seed', async (req, res, next) => {
    try {
      await seedAppData();
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // ==================== BLOOD DONOR MANAGEMENT ====================
  router.get('/blood/donors', async (req, res, next) => {
    try {
      const [primary, legacy] = await Promise.all([
        listEntities({ type: 'blood_donor' }),
        listEntities({ type: 'donor' })
      ]);

      const normalizeDonor = (donor, source) => {
        const name = String(donor?.name || '').trim();
        const phone = String(donor?.phone || '').trim();
        if (!name || !phone) return null;

        return {
          id: donor.id,
          userId: donor.userId || null,
          name,
          bloodGroup: String(donor?.bloodGroup || donor?.bloodType || '').trim(),
          location: String(donor?.location || donor?.area || '').trim(),
          phone,
          verified: donor?.verified ?? false,
          status: donor?.status || 'Active',
          createdAt: donor?.createdAt || null,
          _source: source,
          _phoneKey: normalizePhone(phone)
        };
      };

      const deduped = new Map();
      const addDonor = (donor) => {
        if (!donor) return;
        const key = donor._phoneKey || donor.id;
        const existing = deduped.get(key);
        if (!existing || (existing._source !== 'blood_donor' && donor._source === 'blood_donor')) {
          deduped.set(key, donor);
        }
      };

      primary.map((donor) => normalizeDonor(donor, 'blood_donor')).forEach(addDonor);
      legacy.map((donor) => normalizeDonor(donor, 'donor')).forEach(addDonor);

      const items = Array.from(deduped.values())
        .map(({ _source, _phoneKey, ...rest }) => rest)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post('/blood/donors', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const { name, bloodGroup, location, phone } = req.body || {};
      
      if (!name || !bloodGroup || !location || !phone) {
        return res.status(400).json({ error: 'Name, blood group, location, and phone are required' });
      }

      const normalizedBloodGroup = String(bloodGroup).trim().toUpperCase();
      if (!allowedBloodGroups.has(normalizedBloodGroup)) {
        return res.status(400).json({ error: 'Invalid blood group' });
      }

      if (!isValidPhone(phone)) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }

      const normalizedPhone = normalizePhone(phone);

      // Check if user already registered as donor (by userId)
      const existingDonors = await listEntities({ type: 'blood_donor', userId });
      if (existingDonors && existingDonors.length > 0) {
        return res.status(409).json({ 
          error: 'You are already registered as a blood donor',
          existingDonor: existingDonors[0]
        });
      }

      // CRITICAL: Check if phone number already registered (prevents same person with multiple accounts)
      const [allDonors, legacyDonors] = await Promise.all([
        listEntities({ type: 'blood_donor' }),
        listEntities({ type: 'donor' })
      ]);
      const phoneExists = [...allDonors, ...legacyDonors].some((donor) => {
        const donorPhone = normalizePhone(donor?.phone || donor?.phoneNormalized);
        return donorPhone && donorPhone === normalizedPhone;
      });

      if (phoneExists) {
        return res.status(409).json({ 
          error: 'This phone number is already registered as a blood donor',
          reason: 'duplicate_phone'
        });
      }

      // Create new donor
      const item = await createEntity({
        type: 'blood_donor',
        userId,
        data: { 
          userId,
          name: String(name).trim(),
          bloodGroup: normalizedBloodGroup, 
          location: String(location).trim(), 
          phone: String(phone).trim(),
          phoneNormalized: normalizedPhone,
          verified: false,
          status: 'Active', 
          createdAt: new Date().toISOString() 
        }
      });
      
      // Create notification for user
      await createNotification(userId, {
        type: 'SYSTEM',
        entityId: item.id,
        title: 'Blood Donor Registration Successful',
        message: `You are now registered as a ${normalizedBloodGroup} blood donor. Thank you for saving lives!`,
        link: '/donors'
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  // Delete all blood donors (for development/testing - reset database)
  router.delete('/blood/donors/reset', requireAuth, requireRole('system_admin'), async (req, res, next) => {
    try {
      // Get all blood donor entities
      const donors = await listEntities({ type: 'blood_donor' });
      
      // Delete each donor
      const deletePromises = donors.map(donor => 
        query('DELETE FROM app_entities WHERE id = ?', [donor.id])
      );
      
      await Promise.all(deletePromises);
      
      res.json({ 
        success: true, 
        message: `Successfully deleted ${donors.length} blood donors`,
        count: donors.length 
      });
    } catch (err) {
      next(err);
    }
  });

  // ==================== BLOOD REQUEST MANAGEMENT ====================
  router.get('/blood/requests', requireAuth, async (req, res, next) => {
    try {
      const scope = String(req.query.scope || 'donor').toLowerCase();
      const items = await listEntities({ type: 'blood_request', userId: req.user.sub });
      const filtered = items.filter((item) => {
        const isDonorMessage = Boolean(item?.donorId || item?.requesterPhone);
        if (scope === 'all') return true;
        if (scope === 'general') return !isDonorMessage;
        return isDonorMessage;
      }).map((item) => ({
        ...item,
        bloodGroup: item.bloodGroup || item.bloodType || '',
        area: item.area || item.location || ''
      }));
      res.json({ items: filtered });
    } catch (err) {
      next(err);
    }
  });

  router.post('/blood/requests', requireAuth, async (req, res, next) => {
    try {
      const data = req.body || {};
      const hasDonorPayload = Boolean(data.donorId || data.requesterPhone);
      const hasGeneralPayload = Boolean(data.bloodType || data.units || data.urgency);

      if (!hasDonorPayload && !hasGeneralPayload) {
        return res.status(400).json({ error: 'Invalid blood request payload' });
      }

      if (hasDonorPayload) {
        const { donorId, donorName, bloodGroup, area, location, requesterPhone, message } = data;
        if (!donorId || !requesterPhone) {
          return res.status(400).json({ error: 'donorId and requesterPhone are required' });
        }
        if (!isValidPhone(requesterPhone)) {
          return res.status(400).json({ error: 'Invalid requester phone number format' });
        }
        const normalizedGroup = bloodGroup ? String(bloodGroup).trim().toUpperCase() : '';
        const safeGroup = normalizedGroup && allowedBloodGroups.has(normalizedGroup) ? normalizedGroup : '';

        const item = await createEntity({
          type: 'blood_request',
          userId: req.user.sub,
          data: {
            donorId,
            donorName: donorName || '',
            bloodGroup: safeGroup,
            area: area || location || '',
            requesterPhone: String(requesterPhone).trim(),
            message: message || '',
            status: 'sent',
            createdAt: new Date().toISOString()
          }
        });

        return res.status(201).json({ item });
      }

      const { bloodType, units, urgency, hospital, location } = data;
      if (!bloodType || !units || !urgency) {
        return res.status(400).json({ error: 'bloodType, units, and urgency are required' });
      }
      const normalizedBloodType = String(bloodType).trim().toUpperCase();
      if (!allowedBloodGroups.has(normalizedBloodType)) {
        return res.status(400).json({ error: 'Invalid blood type' });
      }

      const parsedUnits = Number(units);
      if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) {
        return res.status(400).json({ error: 'units must be a positive number' });
      }

      const item = await createEntity({
        type: 'blood_request',
        userId: req.user.sub,
        data: {
          bloodType: normalizedBloodType,
          units: parsedUnits,
          urgency,
          hospital: hospital || '',
          location: location || '',
          status: 'Active',
          createdAt: new Date().toISOString()
        }
      });

      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/blood/requests/:id', requireAuth, async (req, res, next) => {
    try {
      const ok = await deleteEntity({
        id: req.params.id,
        type: 'blood_request',
        userId: req.user.sub
      });
      res.json({ ok });
    } catch (err) {
      next(err);
    }
  });

  // ==================== CATALOG ENDPOINTS ====================
  router.get('/catalog/doctors', async (req, res, next) => {
    try {
      const items = await listCatalog('doctor');
      const summary = await getDoctorReviewSummary();
      res.json({ items: attachDoctorReviewStats(items, summary) });
    } catch (err) {
      next(err);
    }
  });

  router.get('/catalog/hospitals', async (req, res, next) => {
    try {
      const items = await listCatalog('hospital');
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.get('/catalog/medicines', async (req, res, next) => {
    try {
      const items = await listCatalog('medicine');
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // ==================== ORDER ENDPOINTS ====================
  
  // Create new order from cart
  router.post('/orders', requireAuth, async (req, res, next) => {
    try {
      const { items, deliveryAddress, deliveryFee, notes } = req.body;
      const rawItems = Array.isArray(items) ? items : [];
      const normalizedItems = rawItems
        .map((item) => {
          if (!isPlainObject(item)) return null;
          const id = toTrimmedString(item.id, 100);
          const name = toTrimmedString(item.name, 200);
          const price = toNonNegativeNumber(item.price);
          const quantity = toPositiveNumber(item.quantity);
          if (!id || !name || price === null || quantity === null) {
            return null;
          }
          return {
            id,
            name,
            price,
            quantity,
            image: toOptionalString(item.image, 500) || undefined,
            category: toOptionalString(item.category, 100) || undefined
          };
        })
        .filter(Boolean);

      if (!normalizedItems.length) {
        return res.status(400).json({ error: 'Order must contain at least one valid item' });
      }

      const addressPayload = isPlainObject(deliveryAddress)
        ? deliveryAddress
        : toTrimmedString(deliveryAddress, 500);

      if (!addressPayload || (isPlainObject(addressPayload) && !Object.keys(addressPayload).length)) {
        return res.status(400).json({ error: 'Delivery address is required' });
      }

      const computedSubtotal = normalizedItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const safeDeliveryFee = toNonNegativeNumber(deliveryFee) ?? 0;
      const computedTotal = computedSubtotal + safeDeliveryFee;

      const orderData = {
        userId: req.user.sub,
        items: normalizedItems,
        deliveryAddress: addressPayload,
        deliveryFee: safeDeliveryFee,
        subtotal: computedSubtotal,
        total: computedTotal,
        notes: toOptionalString(notes, 1000) || '',
        status: 'pending',
        orderDate: new Date().toISOString(),
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days
      };
      
      const order = await createEntity({
        type: 'order',
        userId: req.user.sub,
        data: orderData
      });
      
      // Notify user about order confirmation
      await createNotification(req.user.sub, {
        type: 'ORDER_PLACED',
        entityId: order.id,
        title: 'Order Confirmed',
        message: `Your order #${order.id.slice(0, 8)} has been placed successfully.`,
        link: '/orders'
      });
      
      // Notify pharmacy owners about new order
      // (In a real system, you'd identify which pharmacy should fulfill this)
      // For now, we'll create a notification that pharmacy role users can see
      
      res.status(201).json({ order });
    } catch (err) {
      next(err);
    }
  });
  
  // Get user's orders
  router.get('/orders', requireAuth, async (req, res, next) => {
    try {
      const orders = await listEntities({ type: 'order', userId: req.user.sub });
      res.json({ items: orders });
    } catch (err) {
      next(err);
    }
  });
  
  // Get specific order details
  router.get('/orders/:id', requireAuth, async (req, res, next) => {
    try {
      const order = await getEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });
  
  // Cancel order (only if pending)
  router.patch('/orders/:id/cancel', requireAuth, async (req, res, next) => {
    try {
      const order = await getEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending orders can be cancelled' });
      }
      
      const updatedOrder = await updateEntity({
        id: req.params.id,
        type: 'order',
        userId: req.user.sub,
        data: { status: 'cancelled' }
      });
      
      await createNotification(req.user.sub, {
        type: 'ORDER_CANCELLED',
        entityId: updatedOrder.id,
        title: 'Order Cancelled',
        message: `Order #${updatedOrder.id.slice(0, 8)} has been cancelled.`,
        link: '/orders'
      });
      
      res.json({ order: updatedOrder });
    } catch (err) {
      next(err);
    }
  });

  // AI Assistant Endpoint - Safe Wellness Questions Only
  router.post('/ai/chat', requireAuth, async (req, res, next) => {
    try {
      const { message, locale = 'en' } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Safety Filter: Block only critical medical questions (allow general wellness)
      const sensitiveKeywords = [
        'bleeding', 'severe pain', 'fever', 'infection', 'emergency',
        'medication', 'medicine', 'drug', 'tablet', 'prescription', 'antibiotic',
        'diagnose', 'diagnosis', 'treatment', 'surgery',
        'abort', 'miscarriage', 'ectopic', 'preeclampsia'
      ];

      const msgLower = message.toLowerCase();
      const isSensitive = sensitiveKeywords.some(keyword => msgLower.includes(keyword));

      if (isSensitive) {
        return res.json({
          text: locale === 'bn' 
            ? 'এটি একটি চিকিৎসা প্রশ্ন। আপনার ডাক্তার বা স্বাস্থ্যসেবা প্রদানকারীর সাথে যোগাযোগ করুন।'
            : 'This is a medical question. Please consult your doctor or healthcare provider.',
          sources: []
        });
      }

      // Try Gemma via Ollama (local model) if available
      try {
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemma:2b',
            prompt: `You are a helpful pregnancy wellness assistant. Answer this general wellness question in ${locale === 'bn' ? 'Bengali' : 'English'}. Keep response under 80 words.

Question: ${message}

Answer:`,
            stream: false
          })
        });

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          return res.json({
            text: data.response || "I'm here to help with general wellness questions.",
            sources: []
          });
        }
      } catch (err) {
        // Gemma not running, use fallback
      }

      // Fallback responses for common questions (no API needed)
      const fallbacks = {
        'nutrition': locale === 'bn' 
          ? 'প্রসবপূর্ব পুষ্টি খুবই গুরুত্বপূর্ণ। ফল, সবজি, প্রোটিন এবং দুগ্ধজাত পণ্য অন্তর্ভুক্ত করুন। বিস্তারিত পরিকল্পনার জন্য আপনার ডাক্তারের সাথে কথা বলুন।'
          : 'Prenatal nutrition is essential. Include fruits, vegetables, proteins, and dairy. Consult your doctor for a personalized plan.',
        'exercise': locale === 'bn'
          ? 'গর্ভাবস্থায় হালকা ব্যায়াম যেমন হাঁটা খুবই উপকারী। নতুন ব্যায়াম শুরু করার আগে আপনার ডাক্তারের সাথে কথা বলুন।'
          : 'Light exercise like walking is beneficial during pregnancy. Always consult your doctor before starting new activities.',
        'sleep': locale === 'bn'
          ? 'গর্ভাবস্থায় প্রতিদিন ৭-৯ ঘণ্টা ঘুম লক্ষ্য করুন। পাশে শোয়া আরামদায়ক হতে পারে।'
          : 'Aim for 7-9 hours of sleep daily during pregnancy. Sleeping on your side can be more comfortable.',
        'default': locale === 'bn'
          ? 'আপনার সাধারণ সুস্থতার প্রশ্নে সহায়তা করতে আমি এখানে আছি। চিকিৎসা সংক্রান্ত পরামর্শের জন্য দয়া করে আপনার ডাক্তারের সাথে যোগাযোগ করুন।'
          : 'I\'m here to help with general wellness questions. For medical advice, please consult your healthcare provider.'
      };

      let response = fallbacks.default;
      if (msgLower.includes('food') || msgLower.includes('eat') || msgLower.includes('nutrition')) {
        response = fallbacks.nutrition;
      } else if (msgLower.includes('exercise') || msgLower.includes('walk') || msgLower.includes('activity')) {
        response = fallbacks.exercise;
      } else if (msgLower.includes('sleep') || msgLower.includes('rest')) {
        response = fallbacks.sleep;
      }

      res.json({ text: response, sources: [] });
    } catch (error) {
      console.error('AI Chat Error:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  });

  // Health Insights Endpoint - No API Key Needed
  router.post('/ai/insights', requireAuth, async (req, res, next) => {
    try {
      const { pregnancyWeek, vaccinesDue, hydrationLevel, locale = 'en' } = req.body;

      // Pre-built wellness tips (no external API needed)
      const insights = {
        'bn': [
          'প্রতিদিন কমপক্ষে ৮-১০ গ্লাস জল পান করুন মা।',
          'আপনার প্রসবপূর্ব ভিটামিন নিতে ভুলবেন না।',
          'প্রতিদিন হালকা হাঁটাহাঁটি করুন।'
        ],
        'en': [
          'Drink 8-10 glasses of water daily to stay hydrated.',
          'Don\'t forget to take your prenatal vitamins.',
          'Light daily walking is great for your health.'
        ]
      };

      res.json({ insights: insights[locale === 'bn' ? 'bn' : 'en'] });
    } catch (error) {
      console.error('Health Insights Error:', error);
      res.status(500).json({ 
        insights: [
          'Stay hydrated.',
          'Keep tracking your health.',
          'Consult your doctor regularly.'
        ] 
      });
    }
  });

  // Myth Checker Endpoint - Curated Safe Responses
  router.post('/ai/check-myth', requireAuth, async (req, res, next) => {
    try {
      const { statement, locale = 'en' } = req.body;

      if (!statement) {
        return res.status(400).json({ error: 'Statement is required' });
      }

      // Curated myth database (manually verified)
      const mythDb = {
        'en': [
          { myth: 'spicy food causes miscarriage', status: 'Myth', explanation: 'Spicy foods are safe during pregnancy. However, if they cause digestive discomfort, avoid them for comfort.' },
          { myth: 'pregnant women cannot exercise', status: 'Myth', explanation: 'Light exercise is beneficial. Walking, swimming, and prenatal yoga are safe. Always consult your doctor.' },
          { myth: 'you need to eat for two', status: 'Myth', explanation: 'You need extra calories, but not "eating for two". Extra 300-500 calories per day is typical. Eat healthy foods.' },
          { myth: 'caffeine causes birth defects', status: 'Myth', explanation: 'Moderate caffeine (under 200mg/day) is generally considered safe. Consult your doctor about your intake.' },
          { myth: 'heartburn means baby has lots of hair', status: 'Myth', explanation: 'No scientific evidence supports this. Heartburn is common due to hormonal and digestive changes.' }
        ],
        'bn': [
          { myth: 'গরম খাবার গর্ভপাত করায়', status: 'Myth', explanation: 'গরম খাবার নিরাপদ। তবে হজমের সমস্যা হলে এড়িয়ে চলুন।' },
          { myth: 'গর্ভবতী নারীরা ব্যায়াম করতে পারেন না', status: 'Myth', explanation: 'হালকা ব্যায়াম উপকারী। আপনার ডাক্তারের সাথে পরামর্শ করুন।' },
          { myth: 'দুই জনের জন্য খেতে হয়', status: 'Myth', explanation: 'অতিরিক্ত ৩০০-৫০০ ক্যালরি প্রয়োজন, দুটি খাবার নয়।' },
          { myth: 'দুধ পানের নিয়ম পরিবর্তন করতে হয়', status: 'Myth', explanation: 'দুধ এবং দুগ্ধজাত পণ্য গর্ভাবস্থায় নিরাপদ এবং ভালো।' },
          { myth: 'রাত জাগা শিশুকে প্রভাবিত করে', status: 'Myth', explanation: 'মাঝে মধ্যে রাত জাগা সমস্যা নয়। যথেষ্ট ঘুম গুরুত্বপূর্ণ।' }
        ]
      };

      const statements = mythDb[locale === 'bn' ? 'bn' : 'en'];
      const statementLower = statement.toLowerCase();

      // Search for matching myth
      for (let m of statements) {
        if (statementLower.includes(m.myth.toLowerCase())) {
          return res.json({ status: m.status, explanation: m.explanation });
        }
      }

      // Default response for unknown statements
      res.json({
        status: 'Unknown',
        explanation: locale === 'bn'
          ? 'এই বিষয়ে নিশ্চিত নই। আপনার ডাক্তারের সাথে পরামর্শ করুন।'
          : 'I\'m not certain about this. Please consult your healthcare provider.'
      });
    } catch (error) {
      console.error('Myth Check Error:', error);
      res.status(500).json({ 
        status: 'Unknown',
        explanation: 'Unable to verify. Please consult your doctor.' 
      });
    }
  });

  // =====================================================
  // DOCTOR DASHBOARD ROUTES
  // =====================================================

  // Get doctor dashboard overview
  router.get('/doctor/dashboard', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;

      const [profileRows, userRows, userProfileRows, doctorRows] = await Promise.all([
        query(`SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`, [doctorId]),
        query(`SELECT phone, email FROM users WHERE id = ? LIMIT 1`, [doctorId]),
        query(`SELECT full_name, date_of_birth FROM user_profiles WHERE user_id = ? LIMIT 1`, [doctorId]),
        query(
          `SELECT full_name, specialty_id, phone, email, fee_amount, verified, rating FROM doctors WHERE id = ? LIMIT 1`,
          [doctorId]
        )
      ]);

      const profileData = profileRows.length > 0 ? parseJson(profileRows[0].data, {}) : {};
      const userRow = userRows.length > 0 ? userRows[0] : {};
      const userProfile = userProfileRows.length > 0 ? userProfileRows[0] : {};
      const doctorRow = doctorRows.length > 0 ? doctorRows[0] : {};

      let specialtyName = null;
      if (doctorRow.specialty_id) {
        const specialtyRows = await query(
          `SELECT name FROM doctor_specialties WHERE id = ? LIMIT 1`,
          [doctorRow.specialty_id]
        );
        specialtyName = specialtyRows.length > 0 ? specialtyRows[0].name : null;
      }

      const toNumber = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const verifiedValue = doctorRow.verified ?? profileData.verified;
      const verified =
        typeof verifiedValue === 'boolean'
          ? verifiedValue
          : typeof verifiedValue === 'number'
          ? Boolean(verifiedValue)
          : profileData.verificationStatus
          ? profileData.verificationStatus === 'Verified'
          : null;

      const profile = {
        id: doctorId,
        name:
          doctorRow.full_name ||
          userProfile.full_name ||
          profileData.name ||
          profileData.username ||
          req.user?.name ||
          userRow.email ||
          req.user?.email ||
          null,
        bmdcNumber: profileData.bmdcNumber || profileData.bmdc || profileData.registrationNumber || null,
        specialization: specialtyName || profileData.specialty || profileData.specialization || null,
        verified,
        profileImage: profileData.avatar || profileData.profileImage || null,
        contactNumber: doctorRow.phone || profileData.phone || userRow.phone || null,
        email: doctorRow.email || profileData.email || userRow.email || req.user?.email || null,
        experience: toNumber(profileData.experience),
        consultationFee: toNumber(
          doctorRow.fee_amount ?? profileData.consultationFee ?? profileData.fee ?? profileData.consultation_fee
        ),
        rating: toNumber(doctorRow.rating ?? profileData.rating),
        totalConsultations: 0
      };

      const appointmentRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment' ORDER BY created_at DESC`
      );

      const appointments = appointmentRows
        .map((row) => ({
          ...parseJson(row.data, {}),
          id: row.id,
          createdAt: row.created_at,
          userId: row.user_id || parseJson(row.data, {}).userId
        }))
        .filter((appt) => appt && appt.doctorId === doctorId);

      const patientIds = appointments
        .map((appt) => appt.patientId || appt.userId)
        .filter(Boolean);
      const patientProfiles = await loadPatientProfiles(patientIds);

      const consultationFee = profile.consultationFee;

      const consultations = appointments.map((appt) =>
        buildConsultationFromAppointment(appt, patientProfiles, consultationFee)
      );

      profile.totalConsultations = consultations.length;

      const todayKey = new Date().toISOString().split('T')[0];
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const todayConsultations = consultations.filter(
        (c) => typeof c.scheduledAt === 'string' && c.scheduledAt.startsWith(todayKey)
      );
      const upcomingConsultations = consultations.filter((c) => {
        if (!c.scheduledAt) return false;
        const scheduled = new Date(c.scheduledAt);
        return Number.isFinite(scheduled.getTime()) && scheduled > endOfToday;
      });

      const toTimestamp = (value) => {
        if (!value) return null;
        const date = new Date(value);
        const time = date.getTime();
        return Number.isFinite(time) ? time : null;
      };

      const normalizeRiskLevel = (value) => {
        if (!value) return null;
        const level = String(value).toLowerCase();
        if (level === 'low' || level === 'moderate' || level === 'high') return level;
        return null;
      };

      const recentPatients = [];
      const seenPatients = new Set();
      consultations
        .slice()
        .sort((a, b) => {
          const aTime = toTimestamp(a.scheduledAt) ?? 0;
          const bTime = toTimestamp(b.scheduledAt) ?? 0;
          return bTime - aTime;
        })
        .forEach((consultation) => {
          if (!consultation.patientId || seenPatients.has(consultation.patientId)) return;
          const profileInfo = patientProfiles.get(consultation.patientId) || {};
          let consentStatus = null;
          if (consultation.consentGranted === true) consentStatus = 'active';
          if (consultation.consentGranted === false) consentStatus = 'pending';
          recentPatients.push({
            id: consultation.patientId,
            name: consultation.patientName ?? profileInfo.full_name ?? null,
            age: consultation.patientAge ?? null,
            gestationalWeek: consultation.gestationalWeek ?? null,
            profileImage: profileInfo.avatar || profileInfo.profileImage || null,
            riskLevel: normalizeRiskLevel(profileInfo.riskLevel),
            consentStatus,
            consentExpiresAt: profileInfo.consentExpiresAt || null
          });
          seenPatients.add(consultation.patientId);
        });

      const completedConsultations = consultations.filter((c) => c.status === 'completed');
      const pendingConsultations = consultations.filter((c) => c.status && c.status !== 'completed');

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);

      const monthMatches = (dateString, month, year) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        if (!Number.isFinite(date.getTime())) return false;
        return date.getMonth() === month && date.getFullYear() === year;
      };

      const sumFees = (items) =>
        items.reduce((sum, item) => sum + (Number.isFinite(item.fee) ? item.fee : 0), 0);

      const thisMonthConsultations = completedConsultations.filter((c) =>
        monthMatches(c.scheduledAt, currentMonth, currentYear)
      );
      const lastMonthConsultations = completedConsultations.filter((c) =>
        monthMatches(c.scheduledAt, lastMonthDate.getMonth(), lastMonthDate.getFullYear())
      );

      const earningsHistory = completedConsultations
        .filter((c) => Number.isFinite(c.fee))
        .slice()
        .sort((a, b) => {
          const aTime = toTimestamp(a.scheduledAt) ?? 0;
          const bTime = toTimestamp(b.scheduledAt) ?? 0;
          return bTime - aTime;
        })
        .slice(0, 10)
        .map((c) => ({
          date: c.scheduledAt,
          amount: c.fee,
          consultationId: c.id
        }));

      const earnings = {
        totalEarnings: sumFees(completedConsultations),
        thisMonth: sumFees(thisMonthConsultations),
        lastMonth: sumFees(lastMonthConsultations),
        pendingPayments: sumFees(pendingConsultations),
        consultationCount: completedConsultations.length,
        earningsHistory
      };

      const scheduleRows = await query(
        `SELECT data FROM app_entities WHERE type = 'doctor_schedule' AND user_id = ? LIMIT 1`,
        [doctorId]
      );

      let schedule = [];
      if (scheduleRows.length > 0) {
        const scheduleData = parseJson(scheduleRows[0].data, {});
        schedule = normalizeScheduleItems(scheduleData.schedule || scheduleData.items || scheduleData);
      }

      const notificationRows = await query(
        `SELECT id, data, created_at FROM app_entities WHERE type = 'notification' AND user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [doctorId]
      );
      const notifications = notificationRows.map((row) => {
        const data = parseJson(row.data, {});
        return {
          id: row.id,
          type: data.type ? String(data.type).toLowerCase() : null,
          title: data.title ?? null,
          message: data.message ?? null,
          timestamp: data.createdAt || row.created_at || null,
          read: data.isRead ?? data.read ?? false,
          actionUrl: data.link || null
        };
      });

      res.json({
        profile,
        todayConsultations,
        upcomingConsultations,
        recentPatients,
        earnings,
        schedule,
        notifications
      });
    } catch (err) {
      next(err);
    }
  });

  // Get consultations list
  router.get('/doctor/consultations', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      const doctorId = req.user.sub;

      const doctorFeeRows = await query(
        `SELECT fee_amount FROM doctors WHERE id = ? LIMIT 1`,
        [doctorId]
      );
      const doctorFeeValue =
        doctorFeeRows.length > 0 && doctorFeeRows[0].fee_amount !== null && doctorFeeRows[0].fee_amount !== ''
          ? Number(doctorFeeRows[0].fee_amount)
          : null;
      const consultationFee = Number.isFinite(doctorFeeValue) ? doctorFeeValue : null;

      const appointmentRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment' ORDER BY created_at DESC`
      );

      const appointments = appointmentRows
        .map((row) => ({
          ...parseJson(row.data, {}),
          id: row.id,
          createdAt: row.created_at,
          userId: row.user_id || parseJson(row.data, {}).userId
        }))
        .filter((appt) => appt && appt.doctorId === doctorId);

      const patientIds = appointments
        .map((appt) => appt.patientId || appt.userId)
        .filter(Boolean);
      const patientProfiles = await loadPatientProfiles(patientIds);

      let consultations = appointments.map((appt) =>
        buildConsultationFromAppointment(appt, patientProfiles, consultationFee)
      );

      if (status && status !== 'all') {
        consultations = consultations.filter((c) => c.status === normalizeConsultationStatus(status));
      }

      const startIdx = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const endIdx = startIdx + parseInt(limit, 10);
      const paginatedItems = consultations.slice(startIdx, endIdx);

      res.json({
        items: paginatedItems,
        page: parseInt(page, 10),
        pageSize: parseInt(limit, 10),
        total: consultations.length,
        totalPages: Math.ceil(consultations.length / parseInt(limit, 10))
      });
    } catch (err) {
      next(err);
    }
  });

  // Get patient details
  // 🔐 PATIENT DETAILS - REQUIRES CONSENT (DATABASE-BACKED)
  router.get('/doctor/patients/:id', requireAuth, requireRole('doctor'), requireConsentForPatient('id'), async (req, res, next) => {
    try {
      const patientId = req.params.id;
      
      // Query real patient profile from database
      const userRows = await query(
        `SELECT id, phone, email, health_id FROM users WHERE id = ? LIMIT 1`,
        [patientId]
      );
      
      if (!userRows.length) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      
      const user = userRows[0];
      
      // Get patient profile
      const profileRows = await query(
        `SELECT full_name, date_of_birth FROM user_profiles WHERE user_id = ? LIMIT 1`,
        [patientId]
      );
      
      const profile = profileRows.length > 0 ? profileRows[0] : {};
      
      // Get medical history
      const medicalRows = await query(
        `SELECT data FROM app_entities WHERE type = 'medical_report' AND user_id = ? LIMIT 1`,
        [patientId]
      );
      
      let medicalData = {};
      if (medicalRows.length > 0) {
        try {
          medicalData = JSON.parse(medicalRows[0].data || '{}');
        } catch (e) {
          medicalData = {};
        }
      }
      
      // Get pregnancy information
      const pregnancyRows = await query(
        `SELECT data FROM app_entities WHERE type = 'pregnancy' AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
        [patientId]
      );
      
      let pregnancyData = {};
      if (pregnancyRows.length > 0) {
        try {
          pregnancyData = JSON.parse(pregnancyRows[0].data || '{}');
        } catch (e) {
          pregnancyData = {};
        }
      }
      
      // Get consultation history
      const consultationRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'appointment' AND user_id = ? ORDER BY created_at DESC`,
        [patientId]
      );
      
      let lastConsultation = null;
      const consultations = consultationRows.map(row => {
        try {
          return JSON.parse(row.data || '{}');
        } catch (e) {
          return {};
        }
      }).filter(c => c && c.status === 'completed');
      
      if (consultations.length > 0) {
        lastConsultation = consultations[0].createdAt || consultations[0].date;
      }
      
      // Calculate age from DOB
      let age = null;
      if (profile.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        age = new Date().getFullYear() - dob.getFullYear();
      }
      
      // Get avatar (or use placeholder)
      const meta = await getUserMeta(patientId, ['avatar']);
      
      const patient = {
        id: patientId,
        name: profile.full_name || null,
        age: age ?? null,
        phone: user.phone || null,
        email: user.email || null,
        avatar: meta.avatar || null,
        healthId: user.health_id || null,
        currentPregnancy: {
          gestationalWeek: pregnancyData.gestationalWeek ?? null,
          expectedDueDate: pregnancyData.expectedDueDate ?? null,
          complications: pregnancyData.complications ?? []
        },
        medicalHistory: [
          ...(medicalData.allergies ? [{ condition: `Allergies: ${medicalData.allergies}` }] : []),
          ...(medicalData.knownConditions ? [{ condition: medicalData.knownConditions }] : [])
        ],
        consultationHistory: consultations.length,
        lastConsultation: lastConsultation
      };

      res.json({ patient });
    } catch (err) {
      console.error('Error fetching patient details:', err);
      next(err);
    }
  });

  // 🔐 UPDATE APPOINTMENT - VERIFY DOCTOR-PATIENT RELATIONSHIP
  router.patch('/doctor/appointments/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const appointmentId = req.params.id;
      const { status, notes } = req.body;
      const normalizedStatus = normalizeAppointmentStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid appointment status' });
      }
      
      // Fetch the appointment
      const rows = await query(
        `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
        [appointmentId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Appointment not found' });
      }
      
      const appointment = JSON.parse(rows[0].data);
      const patientId = appointment.userId || appointment.patientId;
      
      // Verify this doctor owns this appointment
      if (appointment.doctorId !== req.user.sub) {
        return res.status(403).json({ error: 'Not authorized to update this appointment' });
      }

      // 🔐 Verify consent exists (time-sensitive for active consultations)
      const consentRows = await query(
        `SELECT id, data FROM app_entities 
         WHERE type = 'medical_consent' 
         AND user_id = ?
         LIMIT 100`,
        [patientId]
      );

      const now = new Date();
      const activeConsent = consentRows.some(row => {
        try {
          const consent = JSON.parse(row.data || '{}');
          if (consent.doctorId !== req.user.sub) return false;
          if (consent.status !== 'active') return false;
          if (consent.expiresAt && now > new Date(consent.expiresAt)) return false;
          return true;
        } catch (err) {
          return false;
        }
      });

      if (!activeConsent) {
        return res.status(403).json({
          error: 'Access denied: Patient consent required',
          reason: 'no_active_consent'
        });
      }
      
      // Update appointment
      appointment.status = normalizedStatus;
      if (notes) appointment.doctorNotes = notes;
      appointment.updatedAt = new Date().toISOString();
      
      await query(
        `UPDATE app_entities SET data = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(appointment), new Date(), appointmentId]
      );
      
      // Notify patient about status change
      const statusMessages = {
        scheduled: 'Your appointment has been scheduled.',
        'in-progress': 'Your consultation is now in progress.',
        completed: 'Your consultation has been completed.',
        cancelled: 'Your appointment has been cancelled.'
      };
      
      if (statusMessages[normalizedStatus]) {
        await createNotification(patientId, {
          type: 'APPOINTMENT_STATUS',
          entityId: appointmentId,
          title: 'Appointment Update',
          message: statusMessages[normalizedStatus],
          link: '/appointments'
        });
      }
      
      res.json({ item: appointment });
    } catch (err) {
      next(err);
    }
  });

  // 🔐 CREATE PRESCRIPTION - REQUIRES PATIENT CONSENT
  router.post('/doctor/prescriptions', requireAuth, requireRole('doctor'), requireConsentForPatient('patientId'), async (req, res, next) => {
    try {
      const { consultationId, patientId, medications, instructions, followUpDate, locale } = req.body;

      if (!consultationId || !patientId || !medications || !Array.isArray(medications)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const prescription = {
        id: uuidv4(),
        consultationId,
        patientId,
        doctorId: req.user.sub,
        medications,
        instructions: instructions || '',
        followUpDate: followUpDate || null,
        createdAt: new Date().toISOString(),
        locale: locale || 'en',
        status: 'active'
      };

      // In real implementation, save to database
      // await createEntity({ type: 'prescription', userId: patientId, data: prescription });

      res.status(201).json(prescription);
    } catch (err) {
      next(err);
    }
  });

  // Get doctor schedule (DATABASE-BACKED)
  router.get('/doctor/schedule', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;
      
      // Query from database
      const scheduleRows = await query(
        `SELECT data FROM app_entities WHERE type = 'doctor_schedule' AND user_id = ? LIMIT 1`,
        [doctorId]
      );
      
      let schedule = [];
      if (scheduleRows.length > 0) {
        const scheduleData = parseJson(scheduleRows[0].data, {});
        schedule = normalizeScheduleItems(scheduleData.schedule || scheduleData.items || scheduleData);
      }

      res.json(schedule);
    } catch (err) {
      console.error('Error fetching schedule:', err);
      next(err);
    }
  });

  // Update doctor schedule (SAVE TO DATABASE)
  router.put('/doctor/schedule', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;
      const schedulePayload = Array.isArray(req.body) ? req.body : req.body?.schedule;

      if (!schedulePayload || !Array.isArray(schedulePayload)) {
        return res.status(400).json({ error: 'Invalid schedule data' });
      }

      const schedule = normalizeScheduleItems(schedulePayload);

      if (!schedule.length) {
        return res.status(400).json({ error: 'Schedule cannot be empty' });
      }

      for (const slot of schedule) {
        if (slot.isAvailable && (!slot.startTime || !slot.endTime)) {
          return res.status(400).json({ error: `Missing times for day ${slot.dayOfWeek}` });
        }
      }

      // Save to database
      const scheduleItem = await upsertBySubtype({ 
        type: 'doctor_schedule', 
        userId: doctorId, 
        subtype: 'weekly', 
        data: { 
          schedule,
          updatedAt: new Date().toISOString()
        }
      });

      res.json({ 
        success: true,
        message: 'Schedule saved to database',
        schedule,
        id: scheduleItem.id
      });
    } catch (err) {
      console.error('Error updating schedule:', err);
      next(err);
    }
  });

  // Get doctor earnings (CALCULATED FROM REAL DATA)
  router.get('/doctor/earnings', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const doctorId = req.user.sub;

      const doctorRows = await query(
        `SELECT fee_amount FROM doctors WHERE id = ? LIMIT 1`,
        [doctorId]
      );
      const doctorFeeValue =
        doctorRows.length > 0 && doctorRows[0].fee_amount !== null && doctorRows[0].fee_amount !== ''
          ? Number(doctorRows[0].fee_amount)
          : null;
      const defaultFee = Number.isFinite(doctorFeeValue) ? doctorFeeValue : null;

      const appointmentRows = await query(
        `SELECT id, user_id, data, created_at FROM app_entities WHERE type = 'appointment' ORDER BY created_at DESC`
      );

      const appointments = appointmentRows
        .map((row) => ({
          ...parseJson(row.data, {}),
          id: row.id,
          createdAt: row.created_at,
          userId: row.user_id || parseJson(row.data, {}).userId
        }))
        .filter((appt) => appt && appt.doctorId === doctorId);

      const consultations = appointments.map((appt) =>
        buildConsultationFromAppointment(appt, new Map(), defaultFee)
      );

      const completedConsultations = consultations.filter((c) => c.status === 'completed');
      const pendingConsultations = consultations.filter((c) => c.status && c.status !== 'completed');

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

      const inRange = (dateString, start, end) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const time = date.getTime();
        if (!Number.isFinite(time)) return false;
        return date >= start && date < end;
      };

      const sumFees = (items) =>
        items.reduce((sum, item) => sum + (Number.isFinite(item.fee) ? item.fee : 0), 0);

      const thisMonthConsultations = completedConsultations.filter((c) =>
        inRange(c.scheduledAt, currentMonthStart, currentMonthEnd)
      );
      const lastMonthConsultations = completedConsultations.filter((c) =>
        inRange(c.scheduledAt, lastMonthStart, lastMonthEnd)
      );

      const earningsHistory = completedConsultations
        .filter((c) => Number.isFinite(c.fee))
        .slice()
        .sort((a, b) => {
          const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
          const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5)
        .map((c) => ({
          date: c.scheduledAt,
          amount: c.fee,
          consultationId: c.id
        }));

      const earnings = {
        totalEarnings: sumFees(completedConsultations),
        thisMonth: sumFees(thisMonthConsultations),
        lastMonth: sumFees(lastMonthConsultations),
        pendingPayments: sumFees(pendingConsultations),
        consultationCount: completedConsultations.length,
        earningsHistory
      };

      res.json(earnings);
    } catch (err) {
      console.error('Error fetching earnings:', err);
      next(err);
    }
  });

  // Update consultation status
  router.put('/doctor/consultations/:id/status', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const normalizedStatus = normalizeAppointmentStatus(status);
      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Update consultation in database
      const consultation = await updateEntity({ 
        type: 'appointment', 
        id,
        userId: req.user.sub,
        data: { status: normalizedStatus, updatedAt: new Date().toISOString() } 
      });

      if (!consultation) {
        return res.status(404).json({ error: 'Consultation not found' });
      }

      res.json({ 
        success: true,
        message: 'Consultation status updated',
        consultationId: id,
        newStatus: normalizedStatus,
        consultation
      });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // PHARMACY DASHBOARD ROUTES
  // =====================================================

  // Get pharmacy dashboard overview
  router.get('/pharmacy/dashboard', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const pharmacyId = req.user.sub;
      
      // Fetch pharmacy profile
      const profileRows = await query(
        `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [pharmacyId]
      );
      
      let profile = {
        id: pharmacyId,
        name: 'Pharmacy Owner',
        email: req.user.email || 'pharmacy@nurtureglow.com',
        phone: '+880-1234-567890',
        avatar: `https://picsum.photos/seed/${pharmacyId}/100/100`,
        verificationStatus: 'Verified'
      };
      
      if (profileRows.length > 0) {
        const profileData = JSON.parse(profileRows[0].data);
        profile = {
          ...profile,
          name: profileData.name || profileData.username || profile.name,
          phone: profileData.phone || profile.phone,
          shopName: profileData.shopName || 'Nurture Glow Pharmacy',
          license: profileData.license || 'Pending',
          address: profileData.address || 'Dhaka, Bangladesh'
        };
      }
      
      // Fetch all orders
      const allOrdersRows = await query(
        `SELECT data FROM app_entities WHERE type = 'order'`
      );
      
      const allOrders = allOrdersRows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return null;
        }
      }).filter(order => order !== null);
      
      const today = new Date().toISOString().split('T')[0];
      const todayOrders = allOrders.filter(order => order.orderDate?.startsWith(today)).length;
      const pendingOrders = allOrders.filter(order => order.status === 'pending' || order.status === 'scheduled').length;
      const processingOrders = allOrders.filter(order => order.status === 'processing' || order.status === 'in-progress').length;
      const totalRevenue = allOrders
        .filter(order => order.status === 'delivered')
        .reduce((sum, order) => sum + (order.total || 0), 0);
      
      const dashboardData = {
        profile,
        stats: {
          todayOrders,
          pendingOrders,
          processingOrders,
          totalRevenue,
          totalOrders: allOrders.length
        }
      };
      
      res.json(dashboardData);
    } catch (err) {
      next(err);
    }
  });

  // Get all orders for pharmacy
  router.get('/pharmacy/orders', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const { status, page = 1, limit = 10 } = req.query;
      
      // Fetch all orders
      const allOrdersRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'order' ORDER BY created_at DESC`
      );
      
      let orders = allOrdersRows.map(row => {
        try {
          return JSON.parse(row.data);
        } catch (e) {
          return null;
        }
      }).filter(order => order !== null);
      
      // Filter by status if provided
      if (status && status !== 'all') {
        orders = orders.filter(o => o.status === status);
      }
      
      // Fetch customer names for each order
      for (let order of orders) {
        try {
          const userRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [order.userId]
          );
          if (userRows.length > 0) {
            const profile = JSON.parse(userRows[0].data);
            order.customerName = profile.name || profile.username || 'Customer';
            order.customerPhone = profile.phone || 'N/A';
          } else {
            order.customerName = 'Customer';
            order.customerPhone = 'N/A';
          }
        } catch (e) {
          order.customerName = 'Customer';
          order.customerPhone = 'N/A';
        }
      }
      
      const startIdx = (parseInt(page) - 1) * parseInt(limit);
      const endIdx = startIdx + parseInt(limit);
      const paginatedItems = orders.slice(startIdx, endIdx);
      
      res.json({
        items: paginatedItems,
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: orders.length,
        totalPages: Math.ceil(orders.length / parseInt(limit))
      });
    } catch (err) {
      next(err);
    }
  });

  // Update order status
  router.patch('/pharmacy/orders/:id', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const { status, notes } = req.body;
      
      if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      // Fetch the order
      const rows = await query(
        `SELECT id, user_id, data FROM app_entities WHERE id = ? AND type = 'order' LIMIT 1`,
        [orderId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = JSON.parse(rows[0].data);
      
      // Update order
      order.status = status;
      if (notes) order.pharmacyNotes = notes;
      order.updatedAt = new Date().toISOString();
      
      if (status === 'shipped') {
        order.shippedAt = new Date().toISOString();
      } else if (status === 'delivered') {
        order.deliveredAt = new Date().toISOString();
      }
      
      await query(
        `UPDATE app_entities SET data = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(order), new Date(), orderId]
      );
      
      // Notify customer about status change
      const statusMessages = {
        processing: 'Your order is being prepared.',
        shipped: 'Your order has been shipped and is on the way!',
        delivered: 'Your order has been delivered. Thank you!',
        cancelled: 'Your order has been cancelled.'
      };
      
      if (statusMessages[status]) {
        await createNotification(order.userId, {
          type: 'ORDER_STATUS',
          entityId: orderId,
          title: 'Order Update',
          message: statusMessages[status],
          link: '/orders'
        });
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  // Get order details for pharmacy
  router.get('/pharmacy/orders/:id', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const orderId = req.params.id;
      
      const rows = await query(
        `SELECT data FROM app_entities WHERE id = ? AND type = 'order' LIMIT 1`,
        [orderId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const order = JSON.parse(rows[0].data);
      
      // Fetch customer details
      try {
        const userRows = await query(
          `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
          [order.userId]
        );
        if (userRows.length > 0) {
          const profile = JSON.parse(userRows[0].data);
          order.customerName = profile.name || profile.username || 'Customer';
          order.customerPhone = profile.phone || 'N/A';
          order.customerEmail = profile.email || 'N/A';
        }
      } catch (e) {
        order.customerName = 'Customer';
      }
      
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // MEDICAL RECORD SHARING & CONSENT SYSTEM
  // =====================================================

  // Patient grants access to their medical records to a doctor
  router.post('/medical/consent/grant', requireAuth, async (req, res, next) => {
    try {
      const { doctorId, expiresInDays = 30 } = req.body;
      
      if (!doctorId) {
        return res.status(400).json({ error: 'doctorId is required' });
      }
      
      const consentData = {
        patientId: req.user.sub,
        doctorId,
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        accessLevel: 'full' // full, limited
      };
      
      const consent = await createEntity({
        type: 'medical_consent',
        userId: req.user.sub,
        data: consentData
      });
      
      // Notify doctor
      await createNotification(doctorId, {
        type: 'MEDICAL_ACCESS_GRANTED',
        entityId: consent.id,
        title: 'Medical Records Access Granted',
        message: 'A patient has granted you access to their medical records.',
        link: '/doctor/patients'
      });
      
      res.status(201).json({ consent });
    } catch (err) {
      next(err);
    }
  });

  // Patient revokes access
  router.delete('/medical/consent/:id', requireAuth, async (req, res, next) => {
    try {
      const consentId = req.params.id;
      
      const rows = await query(
        `SELECT id, data FROM app_entities WHERE id = ? AND type = 'medical_consent' AND user_id = ? LIMIT 1`,
        [consentId, req.user.sub]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Consent not found' });
      }
      
      const consent = JSON.parse(rows[0].data);
      consent.status = 'revoked';
      consent.revokedAt = new Date().toISOString();
      
      await query(
        `UPDATE app_entities SET data = ? WHERE id = ?`,
        [JSON.stringify(consent), consentId]
      );
      
      // Notify doctor
      await createNotification(consent.doctorId, {
        type: 'MEDICAL_ACCESS_REVOKED',
        entityId: consentId,
        title: 'Medical Records Access Revoked',
        message: 'A patient has revoked your access to their medical records.',
        link: '/doctor/patients'
      });
      
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Patient views who has access to their records
  router.get('/medical/consent', requireAuth, async (req, res, next) => {
    try {
      const consents = await listEntities({
        type: 'medical_consent',
        userId: req.user.sub
      });
      
      // Fetch doctor names
      for (let consent of consents) {
        try {
          const doctorRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [consent.doctorId]
          );
          if (doctorRows.length > 0) {
            const doctorProfile = JSON.parse(doctorRows[0].data);
            consent.doctorName = doctorProfile.name || 'Doctor';
            consent.doctorSpecialty = doctorProfile.specialty || 'General';
          }
        } catch (e) {
          consent.doctorName = 'Doctor';
        }
      }
      
      res.json({ items: consents });
    } catch (err) {
      next(err);
    }
  });

  // Doctor requests access to patient's medical records
  router.post('/medical/consent/request', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { patientId, reason } = req.body;
      
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
      }
      
      const requestData = {
        doctorId: req.user.sub,
        patientId,
        reason: reason || 'Medical consultation',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      const request = await createEntity({
        type: 'medical_access_request',
        userId: req.user.sub,
        data: requestData
      });
      
      // Notify patient
      await createNotification(patientId, {
        type: 'MEDICAL_ACCESS_REQUEST',
        entityId: request.id,
        title: 'Medical Records Access Request',
        message: 'A doctor has requested access to your medical records.',
        link: '/profile'
      });
      
      res.status(201).json({ request });
    } catch (err) {
      next(err);
    }
  });

  // Doctor views patients with granted access
  router.get('/doctor/accessible-patients', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const allConsentsRows = await query(
        `SELECT data FROM app_entities WHERE type = 'medical_consent'`
      );
      
      const doctorConsents = allConsentsRows
        .map(row => {
          try {
            return JSON.parse(row.data);
          } catch (e) {
            return null;
          }
        })
        .filter(consent => 
          consent && 
          consent.doctorId === req.user.sub && 
          consent.status === 'active' &&
          new Date(consent.expiresAt) > new Date()
        );
      
      // Fetch patient details
      for (let consent of doctorConsents) {
        try {
          const patientRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [consent.patientId]
          );
          if (patientRows.length > 0) {
            const profile = JSON.parse(patientRows[0].data);
            consent.patientName = profile.name || 'Patient';
          }
          
          // Fetch medical records
          const medicalRows = await query(
            `SELECT data FROM app_entities WHERE type = 'medical_report' AND user_id = ? LIMIT 1`,
            [consent.patientId]
          );
          if (medicalRows.length > 0) {
            consent.medicalReport = JSON.parse(medicalRows[0].data);
          }
          
          // Fetch visit history
          const visitsRows = await query(
            `SELECT data FROM app_entities WHERE type = 'visit_record' AND user_id = ?`,
            [consent.patientId]
          );
          consent.visitHistory = visitsRows.map(row => JSON.parse(row.data));
          
        } catch (e) {
          consent.patientName = 'Patient';
        }
      }
      
      res.json({ items: doctorConsents });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // HEALTH ID VERIFICATION SYSTEM
  // =====================================================

  // Submit health ID verification request (User)
  router.post('/health-id/verify', requireAuth, async (req, res, next) => {
    try {
      const { documents, notes } = req.body;
      
      const verificationData = {
        userId: req.user.sub,
        documents: documents || {},
        notes: notes || '',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };
      
      const verification = await createEntity({
        type: 'health_id_verification',
        userId: req.user.sub,
        data: verificationData
      });
      
      // Update user profile status
      const profileRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );
      
      if (profileRows.length > 0) {
        const profile = JSON.parse(profileRows[0].data);
        profile.healthIdStatus = 'pending';
        
        await query(
          `UPDATE app_entities SET data = ? WHERE id = ?`,
          [JSON.stringify(profile), profileRows[0].id]
        );
      }
      
      res.status(201).json({ verification });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // ENHANCED PRESCRIPTION SYSTEM
  // =====================================================

  // Create prescription (linked to consultation)
  router.post('/prescriptions', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { consultationId, patientId, medications, instructions, followUpDate, diagnosis } = req.body;
      
      if (!patientId || !medications || medications.length === 0) {
        return res.status(400).json({ error: 'patientId and medications are required' });
      }
      
      const prescriptionData = {
        doctorId: req.user.sub,
        patientId,
        consultationId: consultationId || null,
        medications, // Array of { name, dosage, frequency, duration }
        instructions: instructions || '',
        diagnosis: diagnosis || '',
        followUpDate: followUpDate || null,
        prescribedAt: new Date().toISOString(),
        status: 'active'
      };
      
      const prescription = await createEntity({
        type: 'prescription',
        userId: patientId, // Store under patient's account
        data: prescriptionData
      });
      
      // Update consultation with prescription ID if provided
      if (consultationId) {
        const consultationRows = await query(
          `SELECT id, data FROM app_entities WHERE id = ? AND type = 'appointment' LIMIT 1`,
          [consultationId]
        );
        
        if (consultationRows.length > 0) {
          const consultation = JSON.parse(consultationRows[0].data);
          consultation.prescriptionId = prescription.id;
          consultation.hasPrescription = true;
          
          await query(
            `UPDATE app_entities SET data = ? WHERE id = ?`,
            [JSON.stringify(consultation), consultationId]
          );
        }
      }
      
      // Notify patient
      await createNotification(patientId, {
        type: 'PRESCRIPTION_CREATED',
        entityId: prescription.id,
        title: 'New Prescription',
        message: 'Your doctor has created a new prescription for you.',
        link: '/health'
      });
      
      res.status(201).json({ prescription });
    } catch (err) {
      next(err);
    }
  });

  // Get patient's prescriptions
  router.get('/prescriptions', requireAuth, async (req, res, next) => {
    try {
      const prescriptions = await listEntities({
        type: 'prescription',
        userId: req.user.sub
      });
      
      // Fetch doctor names
      for (let prescription of prescriptions) {
        try {
          const doctorRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [prescription.doctorId]
          );
          if (doctorRows.length > 0) {
            const doctorProfile = JSON.parse(doctorRows[0].data);
            prescription.doctorName = doctorProfile.name || 'Doctor';
            prescription.doctorSpecialty = doctorProfile.specialty || '';
          }
        } catch (e) {
          prescription.doctorName = 'Doctor';
        }
      }
      
      res.json({ items: prescriptions });
    } catch (err) {
      next(err);
    }
  });

  // Doctor gets all their issued prescriptions
  router.get('/doctor/prescriptions', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const allPrescriptionsRows = await query(
        `SELECT data FROM app_entities WHERE type = 'prescription'`
      );
      
      const doctorPrescriptions = allPrescriptionsRows
        .map(row => {
          try {
            return JSON.parse(row.data);
          } catch (e) {
            return null;
          }
        })
        .filter(prescription => prescription && prescription.doctorId === req.user.sub);
      
      // Fetch patient names
      for (let prescription of doctorPrescriptions) {
        try {
          const patientRows = await query(
            `SELECT data FROM app_entities WHERE type = 'user_profile' AND user_id = ? LIMIT 1`,
            [prescription.patientId]
          );
          if (patientRows.length > 0) {
            const profile = JSON.parse(patientRows[0].data);
            prescription.patientName = profile.name || 'Patient';
          }
        } catch (e) {
          prescription.patientName = 'Patient';
        }
      }
      
      res.json({ items: doctorPrescriptions });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // DOCTOR & PHARMACIST VERIFICATION SUBMISSION
  // =====================================================

  // Doctor submits verification request
  router.post('/doctor/submit-verification', requireAuth, requireRole('doctor'), async (req, res, next) => {
    try {
      const { name, specialty, bmdc, hospital, experience, education, documents } = req.body;

      if (!name || !specialty || !bmdc) {
        return res.status(400).json({ error: 'name, specialty, and bmdc are required' });
      }

      // Check if already verified or pending
      const existingRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'doctor_verification' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );

      if (existingRows.length > 0) {
        const existing = JSON.parse(existingRows[0].data);
        if (existing.status === 'approved') {
          return res.status(400).json({ error: 'Already verified' });
        }
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'Verification request already pending' });
        }
      }

      const verification = await createEntity({
        type: 'doctor_verification',
        userId: req.user.sub,
        data: {
          name,
          specialty,
          bmdc,
          hospital: hospital || '',
          experience: experience || 0,
          education: education || '',
          documents: documents || [],
          status: 'pending',
          submittedAt: new Date().toISOString()
        }
      });

      // Notify all medical admins
      const medicalRoleOptions = getRoleFilterOptions('medical_admin');
      const medicalRolePlaceholders = medicalRoleOptions.map(() => '?').join(', ');
      const adminUsers = await query(
        `SELECT id FROM users WHERE role IN (${medicalRolePlaceholders})`,
        medicalRoleOptions
      );
      for (const admin of adminUsers) {
        await createNotification(admin.id, {
          type: 'NEW_DOCTOR_VERIFICATION',
          entityId: verification.id,
          title: 'New Doctor Verification Request',
          message: `Dr. ${name} has submitted a verification request.`,
          link: '/admin/medical/verifications'
        });
      }

      res.status(201).json({ success: true, verification });
    } catch (err) {
      next(err);
    }
  });

  // Pharmacist submits verification request
  router.post('/pharmacist/submit-verification', requireAuth, requireRole('pharmacist'), async (req, res, next) => {
    try {
      const { pharmacyName, licenseNumber, address, phone, ownerName, documents } = req.body;

      if (!pharmacyName || !licenseNumber) {
        return res.status(400).json({ error: 'pharmacyName and licenseNumber are required' });
      }

      // Check if already verified or pending
      const existingRows = await query(
        `SELECT id, data FROM app_entities WHERE type = 'pharmacist_verification' AND user_id = ? LIMIT 1`,
        [req.user.sub]
      );

      if (existingRows.length > 0) {
        const existing = JSON.parse(existingRows[0].data);
        if (existing.status === 'approved') {
          return res.status(400).json({ error: 'Already verified' });
        }
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'Verification request already pending' });
        }
      }

      const verification = await createEntity({
        type: 'pharmacist_verification',
        userId: req.user.sub,
        data: {
          pharmacyName,
          licenseNumber,
          address: address || '',
          phone: phone || '',
          ownerName: ownerName || '',
          documents: documents || [],
          status: 'pending',
          submittedAt: new Date().toISOString()
        }
      });

      // Notify all ops admins
      const opsRoleOptions = getRoleFilterOptions('ops_admin');
      const opsRolePlaceholders = opsRoleOptions.map(() => '?').join(', ');
      const adminUsers = await query(
        `SELECT id FROM users WHERE role IN (${opsRolePlaceholders})`,
        opsRoleOptions
      );
      for (const admin of adminUsers) {
        await createNotification(admin.id, {
          type: 'NEW_PHARMACIST_VERIFICATION',
          entityId: verification.id,
          title: 'New Pharmacy Verification Request',
          message: `${pharmacyName} has submitted a verification request.`,
          link: '/admin/verifications/pharmacies'
        });
      }

      res.status(201).json({ success: true, verification });
    } catch (err) {
      next(err);
    }
  });

  // =====================================================
  // PUBLIC ANNOUNCEMENTS (All Users)
  // =====================================================

  // Get active announcements for current user's role
  router.get('/announcements', requireAuth, async (req, res, next) => {
    try {
      const userRole = await resolveUserRole(req);
      
      const announcementsRows = await query(
        `SELECT id, data, created_at FROM app_entities 
         WHERE type = 'system_announcement' AND JSON_EXTRACT(data, '$.active') = true 
         ORDER BY created_at DESC LIMIT 20`
      );

      const announcements = announcementsRows.map(row => {
        try {
          const data = JSON.parse(row.data);
          return {
            id: row.id,
            ...data,
            timestamp: row.created_at
          };
        } catch (e) {
          return null;
        }
      }).filter(a => {
        if (!a) return false;
        if (a.targetRole === 'all' || !a.targetRole) return true;
        const normalizedTarget = normalizeRoleValue(a.targetRole) || a.targetRole;
        return normalizedTarget === userRole;
      });

      res.json({ items: announcements });
    } catch (err) {
      next(err);
    }
  });
  return router;
}




