import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './src/server/db.ts';
import {
  computeAvailability,
  createBookingTransaction,
  BookingError,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  phoneLast10,
  rescheduleAppointmentTransaction,
  updateAppointmentFullTransaction,
} from './src/server/booking.ts';
import {
  hasClaimedAdminAccount,
  hashPassword,
  isEnvPasscodeConfigured,
  requireAdmin,
  requirePatient,
  requireSuperAdmin,
  signAdminToken,
  signPatientToken,
  verifyAdminToken,
  verifyEnvPasscode,
  verifyPassword,
  type AuthenticatedAdminRequest,
  type AuthenticatedPatientRequest,
} from './src/server/auth.ts';
import {
  format12Hour,
  getISTDateString,
  getISTTimestampISO,
  isValidDateString,
  parseHHMM,
} from './src/server/timezone.ts';
import {
  checkSupabaseConnection,
  pullAppointmentsFromSupabase,
  syncAppointmentUpdateToSupabase,
  syncBookingToSupabase,
  syncContactInquiryToSupabase,
  syncUnsyncedAppointments,
} from './src/server/supabaseSync.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.set('trust proxy', true);
app.use(express.json({ limit: '150kb' }));

// Security headers (allowing iframe embedding in AI Studio preview)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple sliding-window in-memory rate limiter for public mutation routes
const rateBuckets = new Map<string, number[]>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.path}:${req.ip || 'unknown'}`;
    const now = Date.now();
    const entries = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (entries.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests in a short period. Please wait a moment and try again.',
      });
      return;
    }
    entries.push(now);
    rateBuckets.set(key, entries);
    next();
  };
}

function mapServiceRow(row: Record<string, unknown>) {
  let benefits: string[] = [];
  let suitableFor: string[] = [];
  try {
    benefits = JSON.parse(String(row.benefits_json || '[]'));
  } catch {
    benefits = [];
  }
  try {
    suitableFor = JSON.parse(String(row.suitable_for_json || '[]'));
  } catch {
    suitableFor = [];
  }
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    category: String(row.category),
    short_description: String(row.short_description),
    description: String(row.description),
    benefits,
    suitable_for: suitableFor,
    duration_minutes: Number(row.duration_minutes),
    image_url: String(row.image_url),
    icon_name: String(row.icon_name || 'Activity'),
    is_active: Number(row.is_active),
    sort_order: Number(row.sort_order),
  };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

// SEO: robots.txt and sitemap.xml
app.get('/robots.txt', (req: Request, res: Response) => {
  const baseUrl =
    process.env.APP_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\n\nSitemap: ${baseUrl}/sitemap.xml\n`
  );
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const baseUrl =
    process.env.APP_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
  const pages = ['/', '/about', '/services', '/book', '/contact', '/privacy', '/terms'];
  const today = getISTDateString();
  const urls = pages
    .map(
      (p) =>
        `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`
    )
    .join('\n');

  res
    .type('application/xml')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
});

// Public clinic bundle (no patient PII)
app.get('/api/clinic/public', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM clinic_settings WHERE id = 1').get();
    const workingHours = db
      .prepare('SELECT * FROM working_hours ORDER BY day_of_week ASC')
      .all();
    const todayIST = getISTDateString();
    const blockedDates = db
      .prepare('SELECT * FROM blocked_dates WHERE blocked_date >= ? ORDER BY blocked_date ASC')
      .all(todayIST);
    const services = (
      db
        .prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC, id ASC')
        .all() as unknown as Record<string, unknown>[]
    ).map(mapServiceRow);
    const testimonials = db
      .prepare('SELECT * FROM testimonials WHERE is_published = 1 ORDER BY id DESC')
      .all();
    const gallery = db
      .prepare('SELECT * FROM gallery_images ORDER BY sort_order ASC, id ASC')
      .all();
    const team = db
      .prepare('SELECT * FROM team_members WHERE is_published = 1 ORDER BY sort_order ASC, id ASC')
      .all();

    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      '';

    res.json({
      settings,
      workingHours,
      blockedDates,
      services,
      testimonials,
      gallery,
      team,
      todayIST,
      mapsApiKey,
    });
  } catch (err) {
    console.error('Error loading public clinic info:', err);
    res.status(500).json({ error: 'Unable to load clinic details.' });
  }
});

// Real-time IST slot availability
app.get('/api/availability', (req: Request, res: Response) => {
  try {
    const dateStr = String(req.query.date || '');
    const serviceId = Number(req.query.serviceId);
    if (!dateStr || !Number.isInteger(serviceId) || serviceId <= 0) {
      res.status(400).json({ error: 'Valid date and serviceId are required.' });
      return;
    }
    const result = computeAvailability(dateStr, serviceId);
    res.json(result);
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('Availability error:', err);
    res.status(500).json({ error: 'Unable to check slot availability.' });
  }
});

// Public appointment creation
app.post('/api/appointments', rateLimit(15, 60_000), async (req: Request, res: Response) => {
  try {
    const { serviceId, appointmentDate, startTime, fullName, phone, email, notes } = req.body || {};
    const parsedServiceId = Number(serviceId);
    if (!Number.isInteger(parsedServiceId) || parsedServiceId <= 0) {
      res.status(400).json({ error: 'Please select a valid physiotherapy service.' });
      return;
    }

    const db = getDb();
    const serviceRow = db
      .prepare('SELECT slug FROM services WHERE id = ?')
      .get(parsedServiceId) as { slug: string } | undefined;

    const confirmation = createBookingTransaction({
      serviceId: parsedServiceId,
      appointmentDate: String(appointmentDate || ''),
      startTime: String(startTime || ''),
      fullName: String(fullName || ''),
      phone: String(phone || ''),
      email: typeof email === 'string' ? email : '',
      notes: typeof notes === 'string' ? notes : '',
    });

    const syncRes = await syncBookingToSupabase({
      referenceCode: confirmation.referenceCode,
      patientName: confirmation.patientName,
      patientPhone: confirmation.patientPhone,
      patientEmail: confirmation.patientEmail,
      serviceSlug: serviceRow?.slug || '',
      serviceName: confirmation.serviceName,
      appointmentDate: confirmation.appointmentDate,
      startTime: confirmation.startTime,
      endTime: confirmation.endTime,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
    });

    res.status(201).json({ ...confirmation, supabaseSynced: syncRes.synced });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('Create appointment error:', err);
    res.status(500).json({ error: 'Unable to complete booking right now. Please try again.' });
  }
});

// Privacy-safe self-service lookup (requires BOTH reference code and registered phone)
app.post('/api/appointments/lookup', rateLimit(20, 60_000), (req: Request, res: Response) => {
  try {
    const referenceCode = String(req.body?.referenceCode || '').trim().toUpperCase();
    const phone = String(req.body?.phone || '').trim();
    if (!referenceCode || !isValidPhone(phone)) {
      res.status(400).json({ error: 'Enter both your booking reference code and mobile number.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.id, a.reference_code, a.appointment_date, a.start_time, a.end_time, a.status, a.updated_at,
                s.id as service_id, s.name as service_name, s.duration_minutes,
                p.full_name as patient_name, p.phone as patient_phone
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN services s ON s.id = a.service_id
         WHERE UPPER(a.reference_code) = ?`
      )
      .get(referenceCode) as Record<string, unknown> | undefined;

    if (!row || phoneLast10(String(row.patient_phone)) !== phoneLast10(phone)) {
      res.status(404).json({ error: 'No matching booking found for that reference and mobile number.' });
      return;
    }

    res.json({
      id: Number(row.id),
      referenceCode: String(row.reference_code),
      appointmentDate: String(row.appointment_date),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      startTimeLabel: format12Hour(String(row.start_time)),
      endTimeLabel: format12Hour(String(row.end_time)),
      status: String(row.status),
      updatedAt: String(row.updated_at || ''),
      serviceId: Number(row.service_id),
      serviceName: String(row.service_name),
      durationMinutes: Number(row.duration_minutes),
      patientName: String(row.patient_name),
    });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Unable to look up appointment.' });
  }
});

app.post('/api/appointments/self-cancel', rateLimit(15, 60_000), async (req: Request, res: Response) => {
  try {
    const referenceCode = String(req.body?.referenceCode || '').trim().toUpperCase();
    const phone = String(req.body?.phone || '').trim();
    if (!referenceCode || !isValidPhone(phone)) {
      res.status(400).json({ error: 'Booking reference code and mobile number are required.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.id, a.reference_code, a.status, p.phone as patient_phone
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE UPPER(a.reference_code) = ?`
      )
      .get(referenceCode) as { id: number; reference_code: string; status: string; patient_phone: string } | undefined;

    if (!row || phoneLast10(row.patient_phone) !== phoneLast10(phone)) {
      res.status(404).json({ error: 'No matching booking found.' });
      return;
    }
    if (row.status === 'cancelled') {
      res.status(400).json({ error: 'This appointment is already cancelled.' });
      return;
    }
    if (row.status === 'completed') {
      res.status(400).json({ error: 'Completed appointments cannot be cancelled.' });
      return;
    }

    const nowIST = getISTTimestampISO();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?').run(
        'cancelled',
        nowIST,
        row.id
      );
      db.prepare(
        `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
         VALUES (?, 'cancelled', ?, 'cancelled', 'Cancelled by patient via self-service portal', ?)`
      ).run(row.id, row.status, nowIST);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    await syncAppointmentUpdateToSupabase(row.reference_code, { status: 'cancelled' });

    res.json({ success: true, status: 'cancelled' });
  } catch (err) {
    console.error('Self-cancel error:', err);
    res.status(500).json({ error: 'Unable to cancel appointment.' });
  }
});

app.post('/api/appointments/self-reschedule', rateLimit(15, 60_000), async (req: Request, res: Response) => {
  try {
    const referenceCode = String(req.body?.referenceCode || '').trim().toUpperCase();
    const phone = String(req.body?.phone || '').trim();
    const newDate = String(req.body?.appointmentDate || '');
    const newStartTime = String(req.body?.startTime || '');

    if (!referenceCode || !isValidPhone(phone)) {
      res.status(400).json({ error: 'Booking reference code and mobile number are required.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        `SELECT a.id, a.reference_code, p.phone as patient_phone
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE UPPER(a.reference_code) = ?`
      )
      .get(referenceCode) as { id: number; reference_code: string; patient_phone: string } | undefined;

    if (!row || phoneLast10(row.patient_phone) !== phoneLast10(phone)) {
      res.status(404).json({ error: 'No matching booking found.' });
      return;
    }

    rescheduleAppointmentTransaction(row.id, newDate, newStartTime, 'Patient');
    const updated = db
      .prepare('SELECT end_time FROM appointments WHERE id = ?')
      .get(row.id) as { end_time: string } | undefined;

    await syncAppointmentUpdateToSupabase(row.reference_code, {
      appointment_date: newDate,
      start_time: newStartTime,
      ...(updated?.end_time ? { end_time: updated.end_time } : {}),
    });

    res.json({
      success: true,
      appointmentDate: newDate,
      startTime: newStartTime,
      startTimeLabel: format12Hour(newStartTime),
    });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('Self-reschedule error:', err);
    res.status(500).json({ error: 'Unable to reschedule appointment.' });
  }
});

// Public Contact Enquiry Form
app.post('/api/contact', rateLimit(10, 60_000), async (req: Request, res: Response) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim();
    const subject = String(req.body?.subject || 'General Enquiry').trim().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 1000);

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (message.length < 5) {
      res.status(400).json({ error: 'Please enter a short message explaining your enquiry.' });
      return;
    }

    const db = getDb();
    const nowIST = getISTTimestampISO();
    db.prepare(
      `INSERT INTO contact_inquiries (full_name, phone, email, subject, message, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'new', ?)`
    ).run(fullName, phone, email, subject, message, nowIST);

    await syncContactInquiryToSupabase({ fullName, phone, email, subject, message });

    res.status(201).json({
      success: true,
      message: 'Thank you. Our clinic desk will review your enquiry and get back to you.',
    });
  } catch (err) {
    console.error('Contact enquiry error:', err);
    res.status(500).json({ error: 'Unable to submit enquiry right now.' });
  }
});

// ---------------- Patient Authentication & Portal Routes ----------------

app.post('/api/patient/auth/register', rateLimit(10, 60_000), (req: Request, res: Response) => {
  try {
    const fullName = String(req.body?.fullName || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (fullName.length < 2 || fullName.length > 100) {
      res.status(400).json({ error: 'Please enter your full name (2–100 characters).' });
      return;
    }
    if (!isValidPhone(phone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please enter a valid email address or leave it blank.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const db = getDb();
    const nowIST = getISTTimestampISO();
    const last10 = phoneLast10(phone);
    const normPhone = normalizePhone(phone);
    const passwordHash = hashPassword(password);

    let accountId = 0;
    let patientId = 0;

    db.exec('BEGIN IMMEDIATE');
    try {
      const existingByPhone = db
        .prepare('SELECT id FROM patient_accounts WHERE phone_last10 = ?')
        .get(last10) as { id: number } | undefined;

      if (existingByPhone) {
        db.exec('ROLLBACK');
        res.status(409).json({
          error: 'An account with this mobile number already exists. Please sign in instead.',
        });
        return;
      }

      if (email) {
        const existingByEmail = db
          .prepare('SELECT id FROM patient_accounts WHERE LOWER(email) = ?')
          .get(email) as { id: number } | undefined;
        if (existingByEmail) {
          db.exec('ROLLBACK');
          res.status(409).json({
            error: 'An account with this email address already exists. Please sign in instead.',
          });
          return;
        }
      }

      const existingPatient = db
        .prepare(
          `SELECT id FROM patients
           WHERE LENGTH(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '')) >= 10
             AND SUBSTR(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', ''), -10) = ?
           ORDER BY id DESC LIMIT 1`
        )
        .get(last10) as { id: number } | undefined;

      if (existingPatient) {
        patientId = existingPatient.id;
        db.prepare(
          `UPDATE patients
           SET full_name = ?, phone = ?, email = COALESCE(NULLIF(?, ''), email), updated_at = ?
           WHERE id = ?`
        ).run(fullName, normPhone, email, nowIST, patientId);
      } else {
        const pRes = db
          .prepare(
            'INSERT INTO patients (full_name, phone, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(fullName, normPhone, email, nowIST, nowIST);
        patientId = Number(pRes.lastInsertRowid);
      }

      const accRes = db
        .prepare(
          `INSERT INTO patient_accounts (
            patient_id, full_name, phone, phone_last10, email, password_hash, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(patientId, fullName, normPhone, last10, email, passwordHash, nowIST, nowIST);
      accountId = Number(accRes.lastInsertRowid);
      db.exec('COMMIT');
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw e;
    }

    const token = signPatientToken({
      accountId,
      patientId,
      name: fullName,
      phone: normPhone,
      phoneLast10: last10,
      email,
    });

    res.status(201).json({
      token,
      patient: { accountId, patientId, name: fullName, phone: normPhone, email },
    });
  } catch (err) {
    console.error('Patient register error:', err);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

app.post('/api/patient/auth/login', rateLimit(15, 60_000), (req: Request, res: Response) => {
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      res.status(400).json({ error: 'Please enter your mobile number/email and password.' });
      return;
    }

    const db = getDb();
    let account:
      | {
          id: number;
          patient_id: number;
          full_name: string;
          phone: string;
          phone_last10: string;
          email: string;
          password_hash: string;
        }
      | undefined;

    if (identifier.includes('@')) {
      account = db
        .prepare('SELECT * FROM patient_accounts WHERE LOWER(email) = ?')
        .get(identifier.toLowerCase()) as typeof account;
    } else {
      const last10 = phoneLast10(identifier);
      if (last10.length < 10) {
        res.status(400).json({ error: 'Enter a valid 10-digit mobile number or email.' });
        return;
      }
      account = db
        .prepare('SELECT * FROM patient_accounts WHERE phone_last10 = ?')
        .get(last10) as typeof account;
    }

    if (!account || !verifyPassword(password, account.password_hash)) {
      res.status(401).json({ error: 'Invalid mobile number/email or password.' });
      return;
    }

    const token = signPatientToken({
      accountId: account.id,
      patientId: account.patient_id,
      name: account.full_name,
      phone: account.phone,
      phoneLast10: account.phone_last10,
      email: account.email,
    });

    res.json({
      token,
      patient: {
        accountId: account.id,
        patientId: account.patient_id,
        name: account.full_name,
        phone: account.phone,
        email: account.email,
      },
    });
  } catch (err) {
    console.error('Patient login error:', err);
    res.status(500).json({ error: 'Sign in failed.' });
  }
});

app.get('/api/patient/auth/me', requirePatient, (req: AuthenticatedPatientRequest, res: Response) => {
  const p = req.patient!;
  res.json({
    authenticated: true,
    patient: {
      accountId: p.accountId,
      patientId: p.patientId,
      name: p.name,
      phone: p.phone,
      email: p.email,
    },
  });
});

app.get(
  '/api/patient/appointments',
  requirePatient,
  (req: AuthenticatedPatientRequest, res: Response) => {
    try {
      const p = req.patient!;
      const db = getDb();
      const rows = db
        .prepare(
          `SELECT a.id, a.reference_code, a.appointment_date, a.start_time, a.end_time,
                  a.status, a.notes, a.updated_at,
                  s.id as service_id, s.name as service_name, s.duration_minutes
           FROM appointments a
           JOIN patients pt ON pt.id = a.patient_id
           JOIN services s ON s.id = a.service_id
           WHERE a.patient_id = ?
              OR (
                LENGTH(REPLACE(REPLACE(REPLACE(pt.phone, ' ', ''), '-', ''), '+', '')) >= 10
                AND SUBSTR(REPLACE(REPLACE(REPLACE(pt.phone, ' ', ''), '-', ''), '+', ''), -10) = ?
              )
           ORDER BY a.appointment_date DESC, a.start_time DESC, a.id DESC`
        )
        .all(p.patientId, p.phoneLast10) as Array<Record<string, unknown>>;

      res.json(
        rows.map((row) => ({
          id: Number(row.id),
          referenceCode: String(row.reference_code),
          appointmentDate: String(row.appointment_date),
          startTime: String(row.start_time),
          endTime: String(row.end_time),
          startTimeLabel: format12Hour(String(row.start_time)),
          endTimeLabel: format12Hour(String(row.end_time)),
          status: String(row.status),
          serviceId: Number(row.service_id),
          serviceName: String(row.service_name),
          durationMinutes: Number(row.duration_minutes),
          notes: String(row.notes || ''),
          updatedAt: String(row.updated_at || ''),
        }))
      );
    } catch (err) {
      console.error('Patient appointments error:', err);
      res.status(500).json({ error: 'Unable to load your appointments.' });
    }
  }
);

app.post(
  '/api/patient/appointments/:id/cancel',
  requirePatient,
  async (req: AuthenticatedPatientRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid appointment id.' });
        return;
      }
      const p = req.patient!;
      const db = getDb();
      const row = db
        .prepare(
          `SELECT a.id, a.reference_code, a.patient_id, a.status, pt.phone as patient_phone
           FROM appointments a
           JOIN patients pt ON pt.id = a.patient_id
           WHERE a.id = ?`
        )
        .get(id) as
        | { id: number; reference_code: string; patient_id: number; status: string; patient_phone: string }
        | undefined;

      const ownsBooking =
        row &&
        (row.patient_id === p.patientId ||
          (p.phoneLast10.length === 10 && phoneLast10(row.patient_phone) === p.phoneLast10));

      if (!row || !ownsBooking) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }
      if (row.status === 'cancelled' || row.status === 'completed') {
        res.status(400).json({ error: `Cannot cancel a ${row.status} appointment.` });
        return;
      }

      const nowIST = getISTTimestampISO();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?').run(
          'cancelled',
          nowIST,
          row.id
        );
        db.prepare(
          `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
           VALUES (?, 'cancelled', ?, 'cancelled', 'Cancelled by patient from Patient Portal', ?)`
        ).run(row.id, row.status, nowIST);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      await syncAppointmentUpdateToSupabase(row.reference_code, { status: 'cancelled' });
      res.json({ success: true, status: 'cancelled' });
    } catch (err) {
      console.error('Patient portal cancel error:', err);
      res.status(500).json({ error: 'Unable to cancel appointment.' });
    }
  }
);

app.post(
  '/api/patient/appointments/:id/reschedule',
  requirePatient,
  async (req: AuthenticatedPatientRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const newDate = String(req.body?.appointmentDate || '');
      const newStartTime = String(req.body?.startTime || '');
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid appointment id.' });
        return;
      }

      const p = req.patient!;
      const db = getDb();
      const row = db
        .prepare(
          `SELECT a.id, a.reference_code, a.patient_id, pt.phone as patient_phone
           FROM appointments a
           JOIN patients pt ON pt.id = a.patient_id
           WHERE a.id = ?`
        )
        .get(id) as
        | { id: number; reference_code: string; patient_id: number; patient_phone: string }
        | undefined;

      const ownsBooking =
        row &&
        (row.patient_id === p.patientId ||
          (p.phoneLast10.length === 10 && phoneLast10(row.patient_phone) === p.phoneLast10));

      if (!row || !ownsBooking) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }

      rescheduleAppointmentTransaction(row.id, newDate, newStartTime, p.name);
      const updated = db
        .prepare('SELECT end_time FROM appointments WHERE id = ?')
        .get(row.id) as { end_time: string } | undefined;

      await syncAppointmentUpdateToSupabase(row.reference_code, {
        appointment_date: newDate,
        start_time: newStartTime,
        ...(updated?.end_time ? { end_time: updated.end_time } : {}),
      });

      res.json({
        success: true,
        appointmentDate: newDate,
        startTime: newStartTime,
        startTimeLabel: format12Hour(newStartTime),
      });
    } catch (err) {
      if (err instanceof BookingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('Patient portal reschedule error:', err);
      res.status(500).json({ error: 'Unable to reschedule appointment.' });
    }
  }
);

// ---------------- Admin Authentication Routes ----------------

app.get('/api/admin/auth/status', (req: Request, res: Response) => {
  try {
    getDb();
    const envPasscodeMode = isEnvPasscodeConfigured();
    const claimed = hasClaimedAdminAccount();
    const setupRequired = !envPasscodeMode && !claimed;

    const authHeader = req.headers.authorization;
    let admin = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      admin = verifyAdminToken(authHeader.slice('Bearer '.length).trim());
    }

    res.json({
      setupRequired,
      envPasscodeMode,
      authenticated: Boolean(admin),
      admin: admin
        ? { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
        : null,
    });
  } catch (err) {
    console.error('Auth status error:', err);
    res.status(500).json({ error: 'Unable to check authentication status.' });
  }
});

// One-time first-run admin bootstrap (locks automatically once claimed or when ADMIN_PASSCODE is set)
app.post('/api/admin/auth/bootstrap', rateLimit(10, 60_000), (req: Request, res: Response) => {
  try {
    if (isEnvPasscodeConfigured()) {
      res.status(403).json({
        error: 'Admin passcode is managed by environment configuration. Sign in with the passcode.',
      });
      return;
    }

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2) {
      res.status(400).json({ error: 'Please provide an administrator name.' });
      return;
    }
    if (!email || !isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid administrator email.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }

    const db = getDb();
    const nowIST = getISTTimestampISO();
    let createdId = 0;

    db.exec('BEGIN IMMEDIATE');
    try {
      const countRow = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number };
      if (countRow.count > 0) {
        db.exec('ROLLBACK');
        res.status(409).json({ error: 'Administrator account has already been claimed. Please sign in.' });
        return;
      }

      const passwordHash = hashPassword(password);
      const result = db
        .prepare(
          `INSERT INTO admins (name, email, password_hash, role, created_at)
           VALUES (?, ?, ?, 'super_admin', ?)`
        )
        .run(name, email, passwordHash, nowIST);
      createdId = Number(result.lastInsertRowid);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const token = signAdminToken({
      id: createdId,
      email,
      name,
      role: 'super_admin',
    });

    res.status(201).json({
      token,
      admin: { id: createdId, name, email, role: 'super_admin' },
    });
  } catch (err) {
    console.error('Admin bootstrap error:', err);
    res.status(500).json({ error: 'Unable to complete admin setup.' });
  }
});

app.post('/api/admin/auth/login', rateLimit(15, 60_000), (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!password) {
      res.status(400).json({ error: 'Please enter your password or passcode.' });
      return;
    }

    if (isEnvPasscodeConfigured()) {
      if (!verifyEnvPasscode(password)) {
        res.status(401).json({ error: 'Invalid admin passcode.' });
        return;
      }
      const token = signAdminToken({
        id: 1,
        email: email || 'admin@gracephysiotherapy.in',
        name: 'Clinic Administrator',
        role: 'super_admin',
      });
      res.json({
        token,
        admin: {
          id: 1,
          name: 'Clinic Administrator',
          email: email || 'admin@gracephysiotherapy.in',
          role: 'super_admin',
        },
      });
      return;
    }

    const db = getDb();
    const adminRow = db
      .prepare('SELECT * FROM admins WHERE LOWER(email) = ?')
      .get(email) as
      | { id: number; name: string; email: string; password_hash: string; role: 'super_admin' | 'staff' }
      | undefined;

    if (!adminRow || !verifyPassword(password, adminRow.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signAdminToken({
      id: adminRow.id,
      email: adminRow.email,
      name: adminRow.name,
      role: adminRow.role,
    });

    res.json({
      token,
      admin: {
        id: adminRow.id,
        name: adminRow.name,
        email: adminRow.email,
        role: adminRow.role,
      },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Sign in failed.' });
  }
});

// ---------------- Protected Admin Dashboard Routes ----------------

app.get('/api/admin/overview', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const db = getDb();
    const todayIST = getISTDateString();

    const total = (db.prepare('SELECT COUNT(*) as c FROM appointments').get() as { c: number }).c;
    const today = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM appointments WHERE appointment_date = ? AND status != 'cancelled'"
        )
        .get(todayIST) as { c: number }
    ).c;
    const upcoming = (
      db
        .prepare(
          "SELECT COUNT(*) as c FROM appointments WHERE appointment_date >= ? AND status IN ('pending', 'confirmed')"
        )
        .get(todayIST) as { c: number }
    ).c;
    const completed = (
      db
        .prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'completed'")
        .get() as { c: number }
    ).c;
    const cancelled = (
      db
        .prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'cancelled'")
        .get() as { c: number }
    ).c;
    const pending = (
      db
        .prepare("SELECT COUNT(*) as c FROM appointments WHERE status = 'pending'")
        .get() as { c: number }
    ).c;

    res.json({
      total,
      today,
      upcoming,
      completed,
      cancelled,
      pending,
      todayDateIST: todayIST,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load dashboard overview.' });
  }
});

app.get('/api/admin/appointments', requireAdmin, async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    await pullAppointmentsFromSupabase();

    const db = getDb();
    const search = String(req.query.search || '').trim();
    const date = String(req.query.date || '').trim();
    const serviceId = req.query.serviceId ? Number(req.query.serviceId) : null;
    const status = String(req.query.status || '').trim();

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (search) {
      conditions.push(
        '(p.full_name LIKE ? OR p.phone LIKE ? OR a.reference_code LIKE ?)'
      );
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (date && isValidDateString(date)) {
      conditions.push('a.appointment_date = ?');
      params.push(date);
    }
    if (serviceId && Number.isInteger(serviceId)) {
      conditions.push('a.service_id = ?');
      params.push(serviceId);
    }
    if (status && ['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT a.*, p.full_name as patient_name, p.phone as patient_phone, p.email as patient_email,
                s.name as service_name
         FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         JOIN services s ON s.id = a.service_id
         ${whereClause}
         ORDER BY a.appointment_date DESC, a.start_time ASC, a.id DESC`
      )
      .all(...params);

    res.json(rows);
  } catch (err) {
    console.error('Admin appointments error:', err);
    res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
});

app.post('/api/admin/appointments', requireAdmin, async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const { serviceId, appointmentDate, startTime, fullName, phone, email, notes, status } = req.body || {};
    const parsedServiceId = Number(serviceId);
    if (!Number.isInteger(parsedServiceId) || parsedServiceId <= 0) {
      res.status(400).json({ error: 'Please select a valid physiotherapy service.' });
      return;
    }

    const db = getDb();
    const serviceRow = db
      .prepare('SELECT slug FROM services WHERE id = ?')
      .get(parsedServiceId) as { slug: string } | undefined;

    const confirmation = createBookingTransaction({
      serviceId: parsedServiceId,
      appointmentDate: String(appointmentDate || ''),
      startTime: String(startTime || ''),
      fullName: String(fullName || ''),
      phone: String(phone || ''),
      email: typeof email === 'string' ? email : '',
      notes: typeof notes === 'string' ? notes : '',
    });

    if (status === 'confirmed') {
      db.prepare('UPDATE appointments SET status = ?, updated_at = ? WHERE reference_code = ?').run(
        'confirmed',
        getISTTimestampISO(),
        confirmation.referenceCode
      );
    }

    const syncRes = await syncBookingToSupabase({
      referenceCode: confirmation.referenceCode,
      patientName: confirmation.patientName,
      patientPhone: confirmation.patientPhone,
      patientEmail: confirmation.patientEmail,
      serviceSlug: serviceRow?.slug || '',
      serviceName: confirmation.serviceName,
      appointmentDate: confirmation.appointmentDate,
      startTime: confirmation.startTime,
      endTime: confirmation.endTime,
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : '',
    });

    if (status === 'confirmed') {
      await syncAppointmentUpdateToSupabase(confirmation.referenceCode, { status: 'confirmed' });
    }

    res.status(201).json({ ...confirmation, status: status === 'confirmed' ? 'confirmed' : 'pending', supabaseSynced: syncRes.synced });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('Admin create appointment error:', err);
    res.status(500).json({ error: 'Failed to create appointment.' });
  }
});

app.put(
  '/api/admin/appointments/:id',
  requireAdmin,
  async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid appointment id.' });
        return;
      }

      const b = req.body || {};
      const result = updateAppointmentFullTransaction({
        appointmentId: id,
        fullName: String(b.patient_name ?? b.fullName ?? ''),
        phone: String(b.patient_phone ?? b.phone ?? ''),
        email: String(b.patient_email ?? b.email ?? ''),
        serviceId: Number(b.service_id ?? b.serviceId),
        appointmentDate: String(b.appointment_date ?? b.appointmentDate ?? ''),
        startTime: String(b.start_time ?? b.startTime ?? ''),
        status: String(b.status || 'pending') as 'pending' | 'confirmed' | 'completed' | 'cancelled',
        notes: String(b.notes ?? ''),
        adminNotes: String(b.admin_notes ?? b.adminNotes ?? ''),
        actorLabel: req.admin?.name || 'Admin',
      });

      await syncAppointmentUpdateToSupabase(result.referenceCode, {
        patient_name: String(b.patient_name ?? b.fullName ?? '').trim(),
        patient_phone: String(b.patient_phone ?? b.phone ?? '').trim(),
        patient_email: String(b.patient_email ?? b.email ?? '').trim(),
        service_name: result.serviceName,
        appointment_date: String(b.appointment_date ?? b.appointmentDate ?? ''),
        start_time: String(b.start_time ?? b.startTime ?? ''),
        end_time: result.endTime,
        status: String(b.status || 'pending'),
        notes: String(b.notes ?? '').trim().slice(0, 500),
      });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof BookingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('Admin full edit error:', err);
      res.status(500).json({ error: 'Failed to update appointment.' });
    }
  }
);

app.get(
  '/api/admin/appointments/:id/history',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid appointment id.' });
        return;
      }
      const db = getDb();
      const rows = db
        .prepare(
          'SELECT * FROM appointment_history WHERE appointment_id = ? ORDER BY id DESC'
        )
        .all(id);
      res.json(rows);
    } catch (err) {
      console.error('Appointment history error:', err);
      res.status(500).json({ error: 'Failed to fetch appointment history.' });
    }
  }
);

app.patch(
  '/api/admin/appointments/:id/status',
  requireAdmin,
  async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const nextStatus = String(req.body?.status || '');
      const reason =
        typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 240) : '';
      const adminNotes =
        typeof req.body?.adminNotes === 'string' ? req.body.adminNotes.trim().slice(0, 500) : null;

      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid appointment id.' });
        return;
      }
      if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(nextStatus)) {
        res.status(400).json({ error: 'Invalid appointment status.' });
        return;
      }

      const db = getDb();
      const existing = db
        .prepare('SELECT id, reference_code, status, admin_notes FROM appointments WHERE id = ?')
        .get(id) as { id: number; reference_code: string; status: string; admin_notes: string } | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Appointment not found.' });
        return;
      }

      const nextAdminNotes =
        adminNotes !== null
          ? adminNotes
          : reason && nextStatus === 'cancelled'
          ? [existing.admin_notes, `Cancellation note: ${reason}`].filter(Boolean).join(' · ').slice(0, 500)
          : existing.admin_notes;

      const nowIST = getISTTimestampISO();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          'UPDATE appointments SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?'
        ).run(nextStatus, nextAdminNotes, nowIST, id);

        db.prepare(
          `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
           VALUES (?, 'status_updated', ?, ?, ?, ?)`
        ).run(
          id,
          existing.status,
          nextStatus,
          `Status changed by ${req.admin?.name || 'Admin'} from ${existing.status} to ${nextStatus}${
            reason ? ` (${reason})` : ''
          }`,
          nowIST
        );
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      await syncAppointmentUpdateToSupabase(existing.reference_code, { status: nextStatus });

      res.json({ success: true });
    } catch (err) {
      console.error('Update appointment status error:', err);
      res.status(500).json({ error: 'Failed to update appointment.' });
    }
  }
);

app.patch(
  '/api/admin/appointments/:id/reschedule',
  requireAdmin,
  async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const appointmentDate = String(req.body?.appointmentDate || '');
      const startTime = String(req.body?.startTime || '');
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Invalid appointment id.' });
        return;
      }
      rescheduleAppointmentTransaction(
        id,
        appointmentDate,
        startTime,
        req.admin?.name || 'Admin'
      );

      const db = getDb();
      const updated = db
        .prepare('SELECT reference_code, end_time FROM appointments WHERE id = ?')
        .get(id) as { reference_code: string; end_time: string } | undefined;

      if (updated) {
        await syncAppointmentUpdateToSupabase(updated.reference_code, {
          appointment_date: appointmentDate,
          start_time: startTime,
          end_time: updated.end_time,
        });
      }

      res.json({ success: true });
    } catch (err) {
      if (err instanceof BookingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('Admin reschedule error:', err);
      res.status(500).json({ error: 'Failed to reschedule appointment.' });
    }
  }
);

// Admin Services CRUD
app.get('/api/admin/services', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  const rows = (
    db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all() as unknown as Record<
      string,
      unknown
    >[]
  ).map(mapServiceRow);
  res.json(rows);
});

app.post('/api/admin/services', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const category = String(body.category || 'Physiotherapy').trim();
    const shortDescription = String(body.short_description || '').trim();
    const description = String(body.description || '').trim();
    const durationMinutes = Math.min(180, Math.max(15, Number(body.duration_minutes) || 30));
    const imageUrl = String(
      body.image_url || '/src/assets/images/service_spine_manual_1795584347255.jpg'
    ).trim();
    const iconName = String(body.icon_name || 'Activity').trim();
    const isActive = body.is_active === 0 ? 0 : 1;
    const sortOrder = Number(body.sort_order) || 99;
    const benefits = Array.isArray(body.benefits) ? body.benefits.map(String) : [];
    const suitableFor = Array.isArray(body.suitable_for) ? body.suitable_for.map(String) : [];

    if (name.length < 2 || shortDescription.length < 5) {
      res.status(400).json({ error: 'Service name and short description are required.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'Please provide a valid image path or http(s) URL.' });
      return;
    }

    const db = getDb();
    const nowIST = getISTTimestampISO();
    const baseSlug = slugify(name) || `service-${Date.now()}`;
    const existingSlug = db.prepare('SELECT id FROM services WHERE slug = ?').get(baseSlug);
    const slug = existingSlug ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;

    const result = db
      .prepare(
        `INSERT INTO services (
          slug, name, category, short_description, description,
          benefits_json, suitable_for_json, duration_minutes, image_url,
          icon_name, is_active, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        slug,
        name,
        category,
        shortDescription,
        description || shortDescription,
        JSON.stringify(benefits),
        JSON.stringify(suitableFor),
        durationMinutes,
        imageUrl,
        iconName,
        isActive,
        sortOrder,
        nowIST,
        nowIST
      );

    res.status(201).json({ id: Number(result.lastInsertRowid), slug });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

app.put('/api/admin/services/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid service id.' });
      return;
    }
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const category = String(body.category || 'Physiotherapy').trim();
    const shortDescription = String(body.short_description || '').trim();
    const description = String(body.description || '').trim();
    const durationMinutes = Math.min(180, Math.max(15, Number(body.duration_minutes) || 30));
    const imageUrl = String(body.image_url || '').trim();
    const iconName = String(body.icon_name || 'Activity').trim();
    const isActive = body.is_active === 0 ? 0 : 1;
    const sortOrder = Number(body.sort_order) || 0;
    const benefits = Array.isArray(body.benefits) ? body.benefits.map(String) : [];
    const suitableFor = Array.isArray(body.suitable_for) ? body.suitable_for.map(String) : [];

    if (name.length < 2 || shortDescription.length < 5) {
      res.status(400).json({ error: 'Service name and short description are required.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'Please provide a valid image path or http(s) URL.' });
      return;
    }

    const db = getDb();
    const nowIST = getISTTimestampISO();
    db.prepare(
      `UPDATE services
       SET name = ?, category = ?, short_description = ?, description = ?,
           benefits_json = ?, suitable_for_json = ?, duration_minutes = ?,
           image_url = ?, icon_name = ?, is_active = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      name,
      category,
      shortDescription,
      description || shortDescription,
      JSON.stringify(benefits),
      JSON.stringify(suitableFor),
      durationMinutes,
      imageUrl,
      iconName,
      isActive,
      sortOrder,
      nowIST,
      id
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

app.delete('/api/admin/services/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid service id.' });
      return;
    }
    const db = getDb();
    const linked = db
      .prepare('SELECT COUNT(*) as c FROM appointments WHERE service_id = ?')
      .get(id) as { c: number };

    if (linked.c > 0) {
      db.prepare('UPDATE services SET is_active = 0, updated_at = ? WHERE id = ?').run(
        getISTTimestampISO(),
        id
      );
      res.json({
        success: true,
        archived: true,
        message: 'Service has existing appointments so it was deactivated instead of deleted.',
      });
      return;
    }

    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    res.json({ success: true, archived: false });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Failed to delete service.' });
  }
});

// Admin Schedule Management
app.get('/api/admin/schedule', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  const workingHours = db.prepare('SELECT * FROM working_hours ORDER BY day_of_week ASC').all();
  const blockedDates = db.prepare('SELECT * FROM blocked_dates ORDER BY blocked_date ASC').all();
  const settings = db
    .prepare('SELECT slot_buffer_minutes, max_concurrent_per_slot, hours_confirmation_note FROM clinic_settings WHERE id = 1')
    .get();
  res.json({ workingHours, blockedDates, settings });
});

app.put(
  '/api/admin/schedule/working-hours',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const days = Array.isArray(req.body?.workingHours) ? req.body.workingHours : [];
      if (days.length === 0) {
        res.status(400).json({ error: 'Working hours array is required.' });
        return;
      }

      const db = getDb();
      const stmt = db.prepare(
        `UPDATE working_hours
         SET is_open = ?, morning_start = ?, morning_end = ?, evening_start = ?, evening_end = ?
         WHERE day_of_week = ?`
      );

      db.exec('BEGIN IMMEDIATE');
      try {
        for (const d of days) {
          const dow = Number(d.day_of_week);
          if (dow < 0 || dow > 6) continue;
          const isOpen = d.is_open ? 1 : 0;
          const ms = String(d.morning_start || '10:00');
          const me = String(d.morning_end || '13:00');
          const es = String(d.evening_start || '17:00');
          const ee = String(d.evening_end || '20:00');
          if (
            parseHHMM(ms) < 0 ||
            parseHHMM(me) < 0 ||
            parseHHMM(es) < 0 ||
            parseHHMM(ee) < 0
          ) {
            throw new BookingError(`Invalid time format for ${d.day_name || 'day'}.`, 400);
          }
          stmt.run(isOpen, ms, me, es, ee, dow);
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }

      res.json({ success: true });
    } catch (err) {
      if (err instanceof BookingError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error('Update working hours error:', err);
      res.status(500).json({ error: 'Failed to update working hours.' });
    }
  }
);

app.put(
  '/api/admin/schedule/capacity',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const buffer = Math.min(60, Math.max(0, Number(req.body?.slot_buffer_minutes ?? 10)));
      const maxConcurrent = Math.min(10, Math.max(1, Number(req.body?.max_concurrent_per_slot ?? 1)));
      const note = String(req.body?.hours_confirmation_note || '').trim();

      const db = getDb();
      db.prepare(
        `UPDATE clinic_settings
         SET slot_buffer_minutes = ?, max_concurrent_per_slot = ?,
             hours_confirmation_note = COALESCE(NULLIF(?, ''), hours_confirmation_note),
             updated_at = ?
         WHERE id = 1`
      ).run(buffer, maxConcurrent, note, getISTTimestampISO());

      res.json({ success: true });
    } catch (err) {
      console.error('Update capacity error:', err);
      res.status(500).json({ error: 'Failed to update slot configuration.' });
    }
  }
);

app.post(
  '/api/admin/schedule/blocked-dates',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const blockedDate = String(req.body?.blocked_date || '').trim();
      const reason = String(req.body?.reason || 'Clinic Holiday').trim().slice(0, 160);
      const blockType = req.body?.block_type === 'closure' ? 'closure' : 'holiday';

      if (!isValidDateString(blockedDate)) {
        res.status(400).json({ error: 'Valid YYYY-MM-DD date is required.' });
        return;
      }

      const db = getDb();
      const nowIST = getISTTimestampISO();
      db.prepare(
        `INSERT INTO blocked_dates (blocked_date, reason, block_type, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(blocked_date) DO UPDATE SET reason = excluded.reason, block_type = excluded.block_type`
      ).run(blockedDate, reason, blockType, nowIST);

      res.status(201).json({ success: true });
    } catch (err) {
      console.error('Add blocked date error:', err);
      res.status(500).json({ error: 'Failed to block date.' });
    }
  }
);

app.delete(
  '/api/admin/schedule/blocked-dates/:id',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blocked date id.' });
      return;
    }
    const db = getDb();
    db.prepare('DELETE FROM blocked_dates WHERE id = ?').run(id);
    res.json({ success: true });
  }
);

// Admin Clinic Content & Settings
app.put('/api/admin/settings', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const b = req.body || {};
    const db = getDb();
    db.prepare(
      `UPDATE clinic_settings
       SET business_name = ?, tagline = ?, address = ?, phone = ?, whatsapp_number = ?,
           email = ?, hours_confirmation_note = ?, about_overview = ?, mission = ?,
           vision = ?, philosophy = ?, latitude = ?, longitude = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      String(b.business_name || 'Grace Physiotherapy Clinic').trim(),
      String(b.tagline || '').trim(),
      String(b.address || '').trim(),
      String(b.phone || '').trim(),
      String(b.whatsapp_number || '').replace(/\D/g, ''),
      String(b.email || '').trim(),
      String(b.hours_confirmation_note || '').trim(),
      String(b.about_overview || '').trim(),
      String(b.mission || '').trim(),
      String(b.vision || '').trim(),
      String(b.philosophy || '').trim(),
      Number(b.latitude) || 12.9012,
      Number(b.longitude) || 77.5892,
      getISTTimestampISO()
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update clinic settings.' });
  }
});

// Admin Testimonials CRUD
app.get('/api/admin/testimonials', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all());
});

app.post('/api/admin/testimonials', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const b = req.body || {};
  const patientName = String(b.patient_name || '').trim();
  const quote = String(b.quote || '').trim();
  if (patientName.length < 2 || quote.length < 10) {
    res.status(400).json({ error: 'Patient name and quote are required.' });
    return;
  }
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO testimonials (patient_name, condition_tag, quote, visit_context, is_published, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      patientName,
      String(b.condition_tag || 'Physiotherapy').trim(),
      quote,
      String(b.visit_context || 'Clinic Patient').trim(),
      b.is_published === 0 ? 0 : 1,
      getISTTimestampISO()
    );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/testimonials/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  db.prepare(
    `UPDATE testimonials
     SET patient_name = ?, condition_tag = ?, quote = ?, visit_context = ?, is_published = ?
     WHERE id = ?`
  ).run(
    String(b.patient_name || '').trim(),
    String(b.condition_tag || '').trim(),
    String(b.quote || '').trim(),
    String(b.visit_context || '').trim(),
    b.is_published === 0 ? 0 : 1,
    id
  );
  res.json({ success: true });
});

app.delete(
  '/api/admin/testimonials/:id',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    const db = getDb();
    db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true });
  }
);

// Admin Gallery CRUD
app.get('/api/admin/gallery', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM gallery_images ORDER BY sort_order ASC, id ASC').all());
});

app.post('/api/admin/gallery', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const imageUrl = String(b.image_url || '').trim();
  if (!title || !isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'Valid title and image URL are required.' });
    return;
  }
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO gallery_images (title, caption, category, image_url, is_illustrative, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      String(b.caption || '').trim(),
      String(b.category || 'Clinic Spaces').trim(),
      imageUrl,
      b.is_illustrative ? 1 : 0,
      Number(b.sort_order) || 10,
      getISTTimestampISO()
    );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/gallery/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const b = req.body || {};
  const imageUrl = String(b.image_url || '').trim();
  if (!isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'Valid image URL is required.' });
    return;
  }
  const db = getDb();
  db.prepare(
    `UPDATE gallery_images
     SET title = ?, caption = ?, category = ?, image_url = ?, is_illustrative = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    String(b.title || '').trim(),
    String(b.caption || '').trim(),
    String(b.category || 'Clinic Spaces').trim(),
    imageUrl,
    b.is_illustrative ? 1 : 0,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  res.json({ success: true });
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM gallery_images WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// Admin Team Profiles CRUD
app.get('/api/admin/team', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM team_members ORDER BY sort_order ASC, id ASC').all());
});

app.post('/api/admin/team', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const roleTitle = String(b.role_title || '').trim();
  const photoUrl = String(
    b.photo_url || '/src/assets/images/service_spine_manual_1795584347255.jpg'
  ).trim();
  if (!name || !roleTitle || !isSafeImageUrl(photoUrl)) {
    res.status(400).json({ error: 'Name, role title, and valid photo URL are required.' });
    return;
  }
  const db = getDb();
  const r = db
    .prepare(
      `INSERT INTO team_members (name, role_title, bio, focus_areas, photo_url, is_published, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      roleTitle,
      String(b.bio || '').trim(),
      String(b.focus_areas || '').trim(),
      photoUrl,
      b.is_published === 0 ? 0 : 1,
      Number(b.sort_order) || 10
    );
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

app.put('/api/admin/team/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const b = req.body || {};
  const photoUrl = String(b.photo_url || '').trim();
  if (!isSafeImageUrl(photoUrl)) {
    res.status(400).json({ error: 'Valid photo URL is required.' });
    return;
  }
  const db = getDb();
  db.prepare(
    `UPDATE team_members
     SET name = ?, role_title = ?, bio = ?, focus_areas = ?, photo_url = ?, is_published = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    String(b.name || '').trim(),
    String(b.role_title || '').trim(),
    String(b.bio || '').trim(),
    String(b.focus_areas || '').trim(),
    photoUrl,
    b.is_published === 0 ? 0 : 1,
    Number(b.sort_order) || 0,
    Number(req.params.id)
  );
  res.json({ success: true });
});

app.delete('/api/admin/team/:id', requireAdmin, (req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  db.prepare('DELETE FROM team_members WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// Admin Contact Inquiries
app.get('/api/admin/inquiries', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM contact_inquiries ORDER BY id DESC').all());
});

app.patch(
  '/api/admin/inquiries/:id',
  requireAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    const status = String(req.body?.status || 'reviewed');
    const db = getDb();
    db.prepare('UPDATE contact_inquiries SET status = ? WHERE id = ?').run(
      status,
      Number(req.params.id)
    );
    res.json({ success: true });
  }
);

// Role-based Admin Staff Management (super_admin only)
app.get('/api/admin/staff', requireAdmin, (_req: AuthenticatedAdminRequest, res: Response) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, name, email, role, created_at FROM admins ORDER BY id ASC').all());
});

app.post(
  '/api/admin/staff',
  requireAdmin,
  requireSuperAdmin,
  (req: AuthenticatedAdminRequest, res: Response) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = req.body?.role === 'super_admin' ? 'super_admin' : 'staff';

    if (name.length < 2 || !isValidEmail(email) || password.length < 8) {
      res.status(400).json({ error: 'Name, valid email, and password (8+ chars) are required.' });
      return;
    }

    const db = getDb();
    try {
      const result = db
        .prepare(
          'INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(name, email, hashPassword(password), role, getISTTimestampISO());
      res.status(201).json({ id: Number(result.lastInsertRowid), name, email, role });
    } catch {
      res.status(409).json({ error: 'An administrator with that email already exists.' });
    }
  }
);

// Admin Supabase Sync & Diagnostics
app.get(
  '/api/admin/supabase/status',
  requireAdmin,
  async (_req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const status = await checkSupabaseConnection();
      res.json(status);
    } catch (err) {
      console.error('Supabase status error:', err);
      res.status(500).json({ error: 'Failed to check Supabase status.' });
    }
  }
);

app.post(
  '/api/admin/supabase/sync',
  requireAdmin,
  async (_req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const pullResult = await pullAppointmentsFromSupabase();
      const pushResult = await syncUnsyncedAppointments();
      res.json({ ...pushResult, pulled: pullResult.pulled });
    } catch (err) {
      console.error('Supabase manual sync error:', err);
      res.status(500).json({ error: 'Failed to sync bookings with Supabase.' });
    }
  }
);

// Ensure DB initializes cleanly
getDb();

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Grace Physiotherapy Clinic server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
