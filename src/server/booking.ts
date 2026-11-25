import crypto from 'node:crypto';
import { getDb } from './db.ts';
import {
  format12Hour,
  formatHHMM,
  getDayOfWeekFromDateString,
  getISTDateString,
  getISTTimeMinutes,
  getISTTimestampISO,
  isValidDateString,
  parseHHMM,
} from './timezone.ts';
import type {
  AppointmentStatus,
  AvailabilityResponse,
  BookingConfirmation,
  ClinicSettings,
  TimeSlot,
  WorkingHour,
} from '../types/clinic.ts';

export class BookingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '').trim();
}

export function phoneLast10(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmail(raw: string): boolean {
  if (!raw.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

interface ActiveSlotRow {
  id: number;
  start_time: string;
  end_time: string;
}

export function computeAvailability(dateStr: string, serviceId: number): AvailabilityResponse {
  if (!isValidDateString(dateStr)) {
    throw new BookingError('Please select a valid date (YYYY-MM-DD).', 400);
  }

  const db = getDb();
  const service = db
    .prepare('SELECT id, name, duration_minutes, is_active FROM services WHERE id = ?')
    .get(serviceId) as
    | { id: number; name: string; duration_minutes: number; is_active: number }
    | undefined;

  if (!service || service.is_active !== 1) {
    throw new BookingError('Selected service is currently unavailable.', 404);
  }

  const settings = db
    .prepare('SELECT * FROM clinic_settings WHERE id = 1')
    .get() as unknown as ClinicSettings;

  const todayIST = getISTDateString();
  if (dateStr < todayIST) {
    return {
      date: dateStr,
      serviceId,
      durationMinutes: service.duration_minutes,
      isOpen: false,
      closedReason: 'Past dates cannot be booked.',
      slots: [],
    };
  }

  const blocked = db
    .prepare('SELECT reason, block_type FROM blocked_dates WHERE blocked_date = ?')
    .get(dateStr) as { reason: string; block_type: string } | undefined;

  if (blocked) {
    return {
      date: dateStr,
      serviceId,
      durationMinutes: service.duration_minutes,
      isOpen: false,
      closedReason: blocked.reason || 'Clinic closed on this date.',
      slots: [],
    };
  }

  const dayOfWeek = getDayOfWeekFromDateString(dateStr);
  const workingHour = db
    .prepare('SELECT * FROM working_hours WHERE day_of_week = ?')
    .get(dayOfWeek) as WorkingHour | undefined;

  if (!workingHour || workingHour.is_open !== 1) {
    return {
      date: dateStr,
      serviceId,
      durationMinutes: service.duration_minutes,
      isOpen: false,
      closedReason: `${workingHour?.day_name ?? 'This day'} is closed.`,
      slots: [],
    };
  }

  const activeAppointments = db
    .prepare(
      `SELECT id, start_time, end_time FROM appointments
       WHERE appointment_date = ? AND status != 'cancelled'`
    )
    .all(dateStr) as unknown as ActiveSlotRow[];

  const duration = Math.max(15, Number(service.duration_minutes) || 30);
  const buffer = Math.max(0, Number(settings.slot_buffer_minutes) || 0);
  const maxConcurrent = Math.max(1, Number(settings.max_concurrent_per_slot) || 1);
  const step = duration + buffer;
  const nowMinutesIST = dateStr === todayIST ? getISTTimeMinutes() : -1;

  const windows: Array<{ session: 'morning' | 'evening'; start: string; end: string }> = [
    { session: 'morning', start: workingHour.morning_start, end: workingHour.morning_end },
    { session: 'evening', start: workingHour.evening_start, end: workingHour.evening_end },
  ];

  const slots: TimeSlot[] = [];

  for (const win of windows) {
    const winStart = parseHHMM(win.start);
    const winEnd = parseHHMM(win.end);
    if (winStart < 0 || winEnd <= winStart) continue;

    for (let t = winStart; t + duration <= winEnd; t += step) {
      if (dateStr === todayIST && t <= nowMinutesIST + 10) {
        continue;
      }
      const slotEnd = t + duration;
      let overlapping = 0;

      for (const appt of activeAppointments) {
        const apptStart = parseHHMM(appt.start_time);
        const apptEnd = parseHHMM(appt.end_time);
        if (apptStart < 0 || apptEnd < 0) continue;
        if (t < apptEnd && slotEnd > apptStart) {
          overlapping += 1;
        }
      }

      const remaining = maxConcurrent - overlapping;
      if (remaining > 0) {
        const startTime = formatHHMM(t);
        const endTime = formatHHMM(slotEnd);
        slots.push({
          startTime,
          endTime,
          label: format12Hour(startTime),
          endLabel: format12Hour(endTime),
          session: win.session,
          remainingCapacity: remaining,
        });
      }
    }
  }

  return {
    date: dateStr,
    serviceId,
    durationMinutes: duration,
    isOpen: true,
    closedReason: null,
    slots,
  };
}

function generateReferenceCode(dateStr: string): string {
  const compact = dateStr.replace(/-/g, '');
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `GPC-${compact}-${rand}`;
}

export interface CreateBookingInput {
  serviceId: number;
  appointmentDate: string;
  startTime: string;
  fullName: string;
  phone: string;
  email?: string;
  notes?: string;
}

export function createBookingTransaction(input: CreateBookingInput): BookingConfirmation {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const email = (input.email ?? '').trim();
  const notes = (input.notes ?? '').trim().slice(0, 500);

  if (fullName.length < 2 || fullName.length > 100) {
    throw new BookingError('Please enter your full name (2–100 characters).', 400);
  }
  if (!isValidPhone(phone)) {
    throw new BookingError('Please enter a valid 10-digit mobile number.', 400);
  }
  if (!isValidEmail(email)) {
    throw new BookingError('Please enter a valid email address or leave it blank.', 400);
  }
  if (!isValidDateString(input.appointmentDate)) {
    throw new BookingError('Please choose a valid appointment date.', 400);
  }
  if (parseHHMM(input.startTime) < 0) {
    throw new BookingError('Please select a valid appointment time slot.', 400);
  }

  const db = getDb();
  const nowIST = getISTTimestampISO();

  db.exec('BEGIN IMMEDIATE');
  try {
    const availability = computeAvailability(input.appointmentDate, input.serviceId);
    if (!availability.isOpen) {
      throw new BookingError(
        availability.closedReason || 'Clinic is closed on the selected date.',
        409
      );
    }

    const matchingSlot = availability.slots.find((s) => s.startTime === input.startTime);
    if (!matchingSlot) {
      throw new BookingError(
        'That time slot is no longer available. Please select another slot.',
        409
      );
    }

    const normalizedLast10 = phoneLast10(phone);
    const existingDuplicate = db
      .prepare(
        `SELECT a.id FROM appointments a
         JOIN patients p ON p.id = a.patient_id
         WHERE a.appointment_date = ?
           AND a.start_time = ?
           AND a.status != 'cancelled'
           AND REPLACE(REPLACE(REPLACE(p.phone, ' ', ''), '-', ''), '+', '') LIKE ?`
      )
      .get(input.appointmentDate, input.startTime, `%${normalizedLast10}`) as
      | { id: number }
      | undefined;

    if (existingDuplicate) {
      throw new BookingError(
        'An active appointment with this mobile number already exists for this date and time.',
        409
      );
    }

    const service = db
      .prepare('SELECT id, name, duration_minutes FROM services WHERE id = ?')
      .get(input.serviceId) as { id: number; name: string; duration_minutes: number };

    const settings = db
      .prepare('SELECT * FROM clinic_settings WHERE id = 1')
      .get() as unknown as ClinicSettings;

    const existingPatient = db
      .prepare(
        `SELECT id FROM patients
         WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') LIKE ?
         ORDER BY id DESC LIMIT 1`
      )
      .get(`%${normalizedLast10}`) as { id: number } | undefined;

    let patientId: number;
    if (existingPatient) {
      patientId = existingPatient.id;
      db.prepare(
        'UPDATE patients SET full_name = ?, phone = ?, email = COALESCE(NULLIF(?, \'\'), email), updated_at = ? WHERE id = ?'
      ).run(fullName, normalizePhone(phone), email, nowIST, patientId);
    } else {
      const patientResult = db
        .prepare(
          'INSERT INTO patients (full_name, phone, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(fullName, normalizePhone(phone), email, nowIST, nowIST);
      patientId = Number(patientResult.lastInsertRowid);
    }

    const referenceCode = generateReferenceCode(input.appointmentDate);

    const apptResult = db
      .prepare(
        `INSERT INTO appointments (
          reference_code, patient_id, service_id, appointment_date,
          start_time, end_time, status, notes, admin_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, '', ?, ?)`
      )
      .run(
        referenceCode,
        patientId,
        service.id,
        input.appointmentDate,
        matchingSlot.startTime,
        matchingSlot.endTime,
        notes,
        nowIST,
        nowIST
      );

    const appointmentId = Number(apptResult.lastInsertRowid);

    db.prepare(
      `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
       VALUES (?, 'created', NULL, 'pending', ?, ?)`
    ).run(
      appointmentId,
      `Booked ${service.name} for ${input.appointmentDate} at ${matchingSlot.label}`,
      nowIST
    );

    db.exec('COMMIT');

    return {
      referenceCode,
      patientName: fullName,
      patientPhone: normalizePhone(phone),
      patientEmail: email,
      serviceName: service.name,
      serviceDuration: service.duration_minutes,
      appointmentDate: input.appointmentDate,
      startTime: matchingSlot.startTime,
      endTime: matchingSlot.endTime,
      startTimeLabel: matchingSlot.label,
      endTimeLabel: matchingSlot.endLabel,
      status: 'pending',
      clinicName: settings.business_name,
      clinicAddress: settings.address,
      clinicPhone: settings.phone,
      whatsappNumber: settings.whatsapp_number,
      emailSentNote: email
        ? `Confirmation summary prepared for ${email}. Please keep your reference ${referenceCode}.`
        : null,
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // already rolled back
    }
    throw err;
  }
}

export function rescheduleAppointmentTransaction(
  appointmentId: number,
  newDate: string,
  newStartTime: string,
  actorLabel = 'Admin'
): void {
  if (!isValidDateString(newDate)) {
    throw new BookingError('Invalid target date.', 400);
  }
  if (parseHHMM(newStartTime) < 0) {
    throw new BookingError('Invalid target start time.', 400);
  }

  const db = getDb();
  const nowIST = getISTTimestampISO();

  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .get(appointmentId) as
      | {
          id: number;
          service_id: number;
          appointment_date: string;
          start_time: string;
          status: AppointmentStatus;
        }
      | undefined;

    if (!existing) {
      throw new BookingError('Appointment not found.', 404);
    }
    if (existing.status === 'cancelled' || existing.status === 'completed') {
      throw new BookingError('Cancelled or completed appointments cannot be rescheduled.', 400);
    }

    const todayIST = getISTDateString();
    if (newDate < todayIST) {
      throw new BookingError('Cannot reschedule to a past date.', 400);
    }

    // Temporarily evaluate slot availability excluding this appointment's current reservation
    const service = db
      .prepare('SELECT id, duration_minutes, is_active FROM services WHERE id = ?')
      .get(existing.service_id) as
      | { id: number; duration_minutes: number; is_active: number }
      | undefined;

    if (!service || service.is_active !== 1) {
      throw new BookingError('Service is inactive.', 400);
    }

    const settings = db
      .prepare('SELECT * FROM clinic_settings WHERE id = 1')
      .get() as unknown as ClinicSettings;

    const blocked = db
      .prepare('SELECT reason FROM blocked_dates WHERE blocked_date = ?')
      .get(newDate) as { reason: string } | undefined;
    if (blocked) {
      throw new BookingError(blocked.reason || 'Selected date is blocked.', 409);
    }

    const dayOfWeek = getDayOfWeekFromDateString(newDate);
    const workingHour = db
      .prepare('SELECT * FROM working_hours WHERE day_of_week = ?')
      .get(dayOfWeek) as WorkingHour | undefined;

    if (!workingHour || workingHour.is_open !== 1) {
      throw new BookingError('Clinic is closed on the selected day.', 409);
    }

    const duration = Math.max(15, Number(service.duration_minutes) || 30);
    const startMin = parseHHMM(newStartTime);
    const endMin = startMin + duration;
    const newEndTime = formatHHMM(endMin);

    if (newDate === todayIST && startMin <= getISTTimeMinutes()) {
      throw new BookingError('Selected time has already passed today.', 400);
    }

    const inMorning =
      startMin >= parseHHMM(workingHour.morning_start) &&
      endMin <= parseHHMM(workingHour.morning_end);
    const inEvening =
      startMin >= parseHHMM(workingHour.evening_start) &&
      endMin <= parseHHMM(workingHour.evening_end);

    if (!inMorning && !inEvening) {
      throw new BookingError('Selected time is outside clinic working hours.', 400);
    }

    const activeOther = db
      .prepare(
        `SELECT id, start_time, end_time FROM appointments
         WHERE appointment_date = ? AND status != 'cancelled' AND id != ?`
      )
      .all(newDate, appointmentId) as unknown as ActiveSlotRow[];

    let overlaps = 0;
    for (const row of activeOther) {
      const aStart = parseHHMM(row.start_time);
      const aEnd = parseHHMM(row.end_time);
      if (startMin < aEnd && endMin > aStart) {
        overlaps += 1;
      }
    }

    const maxConcurrent = Math.max(1, Number(settings.max_concurrent_per_slot) || 1);
    if (overlaps >= maxConcurrent) {
      throw new BookingError('Target time slot is already booked.', 409);
    }

    db.prepare(
      `UPDATE appointments
       SET appointment_date = ?, start_time = ?, end_time = ?, updated_at = ?
       WHERE id = ?`
    ).run(newDate, newStartTime, newEndTime, nowIST, appointmentId);

    db.prepare(
      `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
       VALUES (?, 'rescheduled', ?, ?, ?, ?)`
    ).run(
      appointmentId,
      existing.status,
      existing.status,
      `${actorLabel} moved appointment from ${existing.appointment_date} ${format12Hour(existing.start_time)} to ${newDate} ${format12Hour(newStartTime)}`,
      nowIST
    );

    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

export interface AdminUpdateAppointmentInput {
  appointmentId: number;
  fullName: string;
  phone: string;
  email: string;
  serviceId: number;
  appointmentDate: string;
  startTime: string;
  status: AppointmentStatus;
  notes: string;
  adminNotes: string;
  actorLabel?: string;
}

export function updateAppointmentFullTransaction(input: AdminUpdateAppointmentInput): {
  referenceCode: string;
  endTime: string;
  serviceName: string;
} {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const notes = input.notes.trim().slice(0, 500);
  const adminNotes = input.adminNotes.trim().slice(0, 500);
  const actorLabel = input.actorLabel || 'Admin';

  if (fullName.length < 2 || fullName.length > 100) {
    throw new BookingError('Patient name must be 2–100 characters.', 400);
  }
  if (!isValidPhone(phone)) {
    throw new BookingError('Please enter a valid 10-digit mobile number.', 400);
  }
  if (!isValidEmail(email)) {
    throw new BookingError('Please enter a valid email address.', 400);
  }
  if (!isValidDateString(input.appointmentDate)) {
    throw new BookingError('Invalid appointment date.', 400);
  }
  const startMin = parseHHMM(input.startTime);
  if (startMin < 0) {
    throw new BookingError('Invalid appointment start time.', 400);
  }
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(input.status)) {
    throw new BookingError('Invalid appointment status.', 400);
  }

  const db = getDb();
  const nowIST = getISTTimestampISO();

  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db
      .prepare('SELECT * FROM appointments WHERE id = ?')
      .get(input.appointmentId) as
      | {
          id: number;
          reference_code: string;
          patient_id: number;
          service_id: number;
          appointment_date: string;
          start_time: string;
          end_time: string;
          status: AppointmentStatus;
        }
      | undefined;

    if (!existing) {
      throw new BookingError('Appointment not found.', 404);
    }

    const service = db
      .prepare('SELECT id, name, duration_minutes FROM services WHERE id = ?')
      .get(input.serviceId) as
      | { id: number; name: string; duration_minutes: number }
      | undefined;

    if (!service) {
      throw new BookingError('Selected physiotherapy service not found.', 404);
    }

    const duration = Math.max(15, Number(service.duration_minutes) || 30);
    const endMin = startMin + duration;
    const newEndTime = formatHHMM(endMin);

    const scheduleChanged =
      existing.service_id !== input.serviceId ||
      existing.appointment_date !== input.appointmentDate ||
      existing.start_time !== input.startTime ||
      (existing.status === 'cancelled' && input.status !== 'cancelled');

    if (input.status !== 'cancelled' && scheduleChanged) {
      const settings = db
        .prepare('SELECT * FROM clinic_settings WHERE id = 1')
        .get() as unknown as ClinicSettings;

      const blocked = db
        .prepare('SELECT reason FROM blocked_dates WHERE blocked_date = ?')
        .get(input.appointmentDate) as { reason: string } | undefined;
      if (blocked) {
        throw new BookingError(blocked.reason || 'Selected date is marked as closed.', 409);
      }

      const dayOfWeek = getDayOfWeekFromDateString(input.appointmentDate);
      const workingHour = db
        .prepare('SELECT * FROM working_hours WHERE day_of_week = ?')
        .get(dayOfWeek) as WorkingHour | undefined;
      if (!workingHour || workingHour.is_open !== 1) {
        throw new BookingError('Clinic is closed on the selected day.', 409);
      }

      const inMorning =
        startMin >= parseHHMM(workingHour.morning_start) &&
        endMin <= parseHHMM(workingHour.morning_end);
      const inEvening =
        startMin >= parseHHMM(workingHour.evening_start) &&
        endMin <= parseHHMM(workingHour.evening_end);

      if (!inMorning && !inEvening) {
        throw new BookingError('Selected time is outside clinic working hours.', 400);
      }

      const activeOther = db
        .prepare(
          `SELECT id, start_time, end_time FROM appointments
           WHERE appointment_date = ? AND status != 'cancelled' AND id != ?`
        )
        .all(input.appointmentDate, input.appointmentId) as unknown as ActiveSlotRow[];

      let overlaps = 0;
      for (const row of activeOther) {
        const aStart = parseHHMM(row.start_time);
        const aEnd = parseHHMM(row.end_time);
        if (startMin < aEnd && endMin > aStart) {
          overlaps += 1;
        }
      }

      const maxConcurrent = Math.max(1, Number(settings.max_concurrent_per_slot) || 1);
      if (overlaps >= maxConcurrent) {
        throw new BookingError('Selected time slot overlaps with another active booking.', 409);
      }
    }

    db.prepare(
      'UPDATE patients SET full_name = ?, phone = ?, email = ?, updated_at = ? WHERE id = ?'
    ).run(fullName, normalizePhone(phone), email, nowIST, existing.patient_id);

    db.prepare(
      `UPDATE appointments
       SET service_id = ?, appointment_date = ?, start_time = ?, end_time = ?,
           status = ?, notes = ?, admin_notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      service.id,
      input.appointmentDate,
      input.startTime,
      newEndTime,
      input.status,
      notes,
      adminNotes,
      nowIST,
      input.appointmentId
    );

    db.prepare(
      `INSERT INTO appointment_history (appointment_id, action, previous_status, new_status, details, created_at)
       VALUES (?, 'edited', ?, ?, ?, ?)`
    ).run(
      input.appointmentId,
      existing.status,
      input.status,
      `${actorLabel} updated booking (${service.name}, ${input.appointmentDate} ${format12Hour(
        input.startTime
      )}, status: ${input.status})`,
      nowIST
    );

    db.exec('COMMIT');

    return {
      referenceCode: existing.reference_code,
      endTime: newEndTime,
      serviceName: service.name,
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}

