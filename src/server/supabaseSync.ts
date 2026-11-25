import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDb } from './db.ts';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  return {
    url,
    publishableKey,
    serviceRoleKey,
    activeKey: serviceRoleKey || publishableKey,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, activeKey } = getSupabaseConfig();
  return Boolean(url && activeKey);
}

function getClient(preferServiceRole = false): SupabaseClient | null {
  const { url, publishableKey, serviceRoleKey } = getSupabaseConfig();
  const key = preferServiceRole ? serviceRoleKey || publishableKey : publishableKey || serviceRoleKey;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface SupabaseBookingPayload {
  referenceCode: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  serviceSlug: string;
  serviceName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export interface SupabaseSyncResult {
  synced: boolean;
  error: string | null;
}

export async function syncBookingToSupabase(
  payload: SupabaseBookingPayload
): Promise<SupabaseSyncResult> {
  const supabase = getClient(true);
  if (!supabase) {
    return { synced: false, error: 'Supabase credentials are not configured.' };
  }

  const db = getDb();

  try {
    // Attempt atomic RPC first (works safely with RLS + publishable key)
    const { error: rpcError } = await supabase.rpc('book_clinic_appointment', {
      p_reference_code: payload.referenceCode,
      p_patient_name: payload.patientName,
      p_patient_phone: payload.patientPhone,
      p_patient_email: payload.patientEmail,
      p_service_slug: payload.serviceSlug,
      p_service_name: payload.serviceName,
      p_appointment_date: payload.appointmentDate,
      p_start_time: payload.startTime,
      p_end_time: payload.endTime,
      p_notes: payload.notes,
    });

    if (!rpcError) {
      db.prepare(
        'UPDATE appointments SET supabase_synced = 1, supabase_sync_error = ? WHERE reference_code = ?'
      ).run('', payload.referenceCode);
      return { synced: true, error: null };
    }

    // If RPC function is not yet installed, fallback to direct table insert
    if (rpcError.code === 'PGRST202' || rpcError.message?.includes('Could not find the function')) {
      const { error: insertErr } = await supabase.from('appointments').insert({
        reference_code: payload.referenceCode,
        patient_name: payload.patientName,
        patient_phone: payload.patientPhone,
        patient_email: payload.patientEmail,
        service_name: payload.serviceName,
        appointment_date: payload.appointmentDate,
        start_time: payload.startTime,
        end_time: payload.endTime,
        status: 'pending',
        notes: payload.notes,
      });

      if (!insertErr) {
        db.prepare(
          'UPDATE appointments SET supabase_synced = 1, supabase_sync_error = ? WHERE reference_code = ?'
        ).run('', payload.referenceCode);
        return { synced: true, error: null };
      }

      const msg = insertErr.message || 'Supabase table insert failed.';
      db.prepare(
        'UPDATE appointments SET supabase_synced = 0, supabase_sync_error = ? WHERE reference_code = ?'
      ).run(msg.slice(0, 300), payload.referenceCode);
      return { synced: false, error: msg };
    }

    const errMsg = rpcError.message || 'Supabase booking sync failed.';
    db.prepare(
      'UPDATE appointments SET supabase_synced = 0, supabase_sync_error = ? WHERE reference_code = ?'
    ).run(errMsg.slice(0, 300), payload.referenceCode);
    return { synced: false, error: errMsg };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unexpected Supabase sync error.';
    db.prepare(
      'UPDATE appointments SET supabase_synced = 0, supabase_sync_error = ? WHERE reference_code = ?'
    ).run(errMsg.slice(0, 300), payload.referenceCode);
    return { synced: false, error: errMsg };
  }
}

export async function syncContactInquiryToSupabase(inquiry: {
  fullName: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
}): Promise<SupabaseSyncResult> {
  const supabase = getClient(true);
  if (!supabase) return { synced: false, error: 'Supabase not configured.' };

  try {
    const { error } = await supabase.from('contact_inquiries').insert({
      full_name: inquiry.fullName,
      phone: inquiry.phone,
      email: inquiry.email,
      subject: inquiry.subject,
      message: inquiry.message,
      status: 'new',
    });
    if (error) return { synced: false, error: error.message };
    return { synced: true, error: null };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Sync failed.' };
  }
}

export async function syncAppointmentUpdateToSupabase(
  referenceCode: string,
  patch: {
    patient_name?: string;
    patient_phone?: string;
    patient_email?: string;
    service_name?: string;
    status?: string;
    appointment_date?: string;
    start_time?: string;
    end_time?: string;
    notes?: string;
  }
): Promise<SupabaseSyncResult> {
  const { serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    return {
      synced: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is required for updating existing Supabase rows.',
    };
  }
  const supabase = getClient(true);
  if (!supabase) {
    return { synced: false, error: 'Supabase client unavailable.' };
  }
  try {
    const { error } = await supabase
      .from('appointments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('reference_code', referenceCode);
    if (error) {
      return { synced: false, error: error.message };
    }
    const db = getDb();
    db.prepare(
      'UPDATE appointments SET supabase_synced = 1, supabase_sync_error = ? WHERE reference_code = ?'
    ).run('', referenceCode);
    return { synced: true, error: null };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Update sync failed.' };
  }
}

export async function pullAppointmentsFromSupabase(): Promise<{
  pulled: number;
  error: string | null;
}> {
  const { serviceRoleKey } = getSupabaseConfig();
  if (!serviceRoleKey) {
    return { pulled: 0, error: null };
  }
  const supabase = getClient(true);
  if (!supabase) return { pulled: 0, error: null };

  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        'reference_code, patient_name, patient_phone, patient_email, service_name, appointment_date, start_time, end_time, status, notes, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !data) {
      return { pulled: 0, error: error?.message || null };
    }

    const db = getDb();
    const fallbackService = db
      .prepare('SELECT id FROM services ORDER BY sort_order ASC, id ASC LIMIT 1')
      .get() as { id: number } | undefined;

    if (!fallbackService) return { pulled: 0, error: null };

    let pulled = 0;
    for (const row of data) {
      const ref = String(row.reference_code || '').trim();
      if (!ref) continue;

      const existing = db
        .prepare('SELECT id FROM appointments WHERE reference_code = ?')
        .get(ref) as { id: number } | undefined;

      if (existing) continue;

      const svc = db
        .prepare('SELECT id FROM services WHERE LOWER(name) = LOWER(?) LIMIT 1')
        .get(String(row.service_name || '')) as { id: number } | undefined;

      const phone = String(row.patient_phone || '').trim() || '0000000000';
      const fullName = String(row.patient_name || 'Patient').trim();
      const email = String(row.patient_email || '').trim();
      const now = String(row.created_at || new Date().toISOString());

      const existingPatient = db
        .prepare('SELECT id FROM patients WHERE phone = ? ORDER BY id DESC LIMIT 1')
        .get(phone) as { id: number } | undefined;

      let patientId: number;
      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        const pRes = db
          .prepare(
            'INSERT INTO patients (full_name, phone, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(fullName, phone, email, now, now);
        patientId = Number(pRes.lastInsertRowid);
      }

      const validStatus = ['pending', 'confirmed', 'completed', 'cancelled'].includes(
        String(row.status)
      )
        ? String(row.status)
        : 'pending';

      const aRes = db
        .prepare(
          `INSERT INTO appointments (
            reference_code, patient_id, service_id, appointment_date, start_time, end_time,
            status, notes, admin_notes, supabase_synced, supabase_sync_error, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 1, '', ?, ?)`
        )
        .run(
          ref,
          patientId,
          svc?.id ?? fallbackService.id,
          String(row.appointment_date),
          String(row.start_time || '10:00'),
          String(row.end_time || '10:30'),
          validStatus,
          String(row.notes || ''),
          now,
          String(row.updated_at || now)
        );

      db.prepare(
        `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
         VALUES (?, 'imported', NULL, ?, 'Imported from Supabase database', ?)`
      ).run(Number(aRes.lastInsertRowid), validStatus, now);

      pulled += 1;
    }

    return { pulled, error: null };
  } catch (err) {
    return { pulled: 0, error: err instanceof Error ? err.message : 'Pull failed.' };
  }
}

export async function checkSupabaseConnection() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const configured = isSupabaseConfigured();
  const tables: Record<string, { exists: boolean; message: string }> = {
    services: { exists: false, message: 'Not checked' },
    patients: { exists: false, message: 'Not checked' },
    appointments: { exists: false, message: 'Not checked' },
    contact_inquiries: { exists: false, message: 'Not checked' },
  };

  if (configured) {
    const supabase = getClient(true)!;
    for (const table of Object.keys(tables)) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
        tables[table] = { exists: true, message: 'Ready' };
      } else if (error.code === 'PGRST205') {
        tables[table] = { exists: false, message: 'Table not created yet' };
      } else {
        // RLS blocking public SELECT still means the table exists!
        const isRlsOrAuth =
          error.code === '42501' ||
          error.message?.toLowerCase().includes('permission') ||
          error.message?.toLowerCase().includes('policy');
        tables[table] = {
          exists: isRlsOrAuth,
          message: isRlsOrAuth ? 'Ready (RLS protected)' : error.message,
        };
      }
    }
  }

  let projectHost = '';
  try {
    projectHost = url ? new URL(url).hostname : '';
  } catch {
    projectHost = '';
  }

  const db = getDb();
  const unsyncedCount = (
    db.prepare('SELECT COUNT(*) as c FROM appointments WHERE supabase_synced = 0').get() as {
      c: number;
    }
  ).c;
  const syncedCount = (
    db.prepare('SELECT COUNT(*) as c FROM appointments WHERE supabase_synced = 1').get() as {
      c: number;
    }
  ).c;

  return {
    configured,
    projectHost,
    hasServiceRole: Boolean(serviceRoleKey),
    tables,
    syncedCount,
    unsyncedCount,
    schemaSql: getSupabaseSqlMigration(),
  };
}

export async function syncUnsyncedAppointments(): Promise<{
  attempted: number;
  synced: number;
  lastError: string | null;
}> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.reference_code, a.appointment_date, a.start_time, a.end_time, a.notes,
              p.full_name, p.phone, p.email, s.slug, s.name as service_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN services s ON s.id = a.service_id
       WHERE a.supabase_synced = 0`
    )
    .all() as Array<Record<string, unknown>>;

  let synced = 0;
  let lastError: string | null = null;

  for (const r of rows) {
    const res = await syncBookingToSupabase({
      referenceCode: String(r.reference_code),
      patientName: String(r.full_name),
      patientPhone: String(r.phone),
      patientEmail: String(r.email || ''),
      serviceSlug: String(r.slug),
      serviceName: String(r.service_name),
      appointmentDate: String(r.appointment_date),
      startTime: String(r.start_time),
      endTime: String(r.end_time),
      notes: String(r.notes || ''),
    });
    if (res.synced) synced += 1;
    else lastError = res.error;
  }

  return { attempted: rows.length, synced, lastError };
}

export function getSupabaseSqlMigration(): string {
  const filePath = path.resolve(process.cwd(), 'supabase/migrations/001_grace_physio_schema.sql');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}
