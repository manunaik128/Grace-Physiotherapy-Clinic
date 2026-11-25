-- Grace Physiotherapy Clinic — Supabase PostgreSQL Schema & RLS Setup
-- Run this script once in your Supabase Dashboard -> SQL Editor

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Admins
CREATE TABLE IF NOT EXISTS public.admins (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Clinic Settings
CREATE TABLE IF NOT EXISTS public.clinic_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  business_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  email TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  slot_buffer_minutes INTEGER NOT NULL DEFAULT 10,
  max_concurrent_per_slot INTEGER NOT NULL DEFAULT 1,
  hours_confirmation_note TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL DEFAULT 12.9012,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 77.5892,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Working Hours
CREATE TABLE IF NOT EXISTS public.working_hours (
  id BIGSERIAL PRIMARY KEY,
  day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
  day_name TEXT NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  morning_start TEXT NOT NULL DEFAULT '10:00',
  morning_end TEXT NOT NULL DEFAULT '13:00',
  evening_start TEXT NOT NULL DEFAULT '17:00',
  evening_end TEXT NOT NULL DEFAULT '20:00'
);

-- 4. Blocked Dates / Holidays
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id BIGSERIAL PRIMARY KEY,
  blocked_date DATE NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  block_type TEXT NOT NULL DEFAULT 'holiday' CHECK (block_type IN ('holiday', 'closure')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Services
CREATE TABLE IF NOT EXISTS public.services (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);

-- 7. Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id BIGSERIAL PRIMARY KEY,
  reference_code TEXT NOT NULL UNIQUE,
  patient_id BIGINT REFERENCES public.patients(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES public.services(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT NOT NULL DEFAULT '',
  service_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date_status ON public.appointments(appointment_date, status);

-- Prevent overlapping active bookings when max_concurrent_per_slot = 1
CREATE OR REPLACE FUNCTION public.prevent_overlapping_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max_concurrent INTEGER := 1;
  v_overlap_count INTEGER := 0;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(max_concurrent_per_slot, 1) INTO v_max_concurrent
  FROM public.clinic_settings WHERE id = 1;

  SELECT COUNT(*) INTO v_overlap_count
  FROM public.appointments a
  WHERE a.appointment_date = NEW.appointment_date
    AND a.status != 'cancelled'
    AND a.id IS DISTINCT FROM NEW.id
    AND (NEW.start_time < a.end_time AND NEW.end_time > a.start_time);

  IF v_overlap_count >= v_max_concurrent THEN
    RAISE EXCEPTION 'Selected time slot is already booked.' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_appointment ON public.appointments;
CREATE TRIGGER trg_prevent_overlapping_appointment
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.prevent_overlapping_appointment();

-- 8. Testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id BIGSERIAL PRIMARY KEY,
  patient_name TEXT NOT NULL,
  condition_tag TEXT NOT NULL,
  quote TEXT NOT NULL,
  visit_context TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Gallery Images
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Clinic Spaces',
  image_url TEXT NOT NULL,
  is_illustrative BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Contact Inquiries
CREATE TABLE IF NOT EXISTS public.contact_inquiries (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT 'General Enquiry',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Public Read Policies (Non-PII Catalog Data Only)
DROP POLICY IF EXISTS "Public read clinic settings" ON public.clinic_settings;
CREATE POLICY "Public read clinic settings" ON public.clinic_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read working hours" ON public.working_hours;
CREATE POLICY "Public read working hours" ON public.working_hours FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read blocked dates" ON public.blocked_dates;
CREATE POLICY "Public read blocked dates" ON public.blocked_dates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public read active services" ON public.services;
CREATE POLICY "Public read active services" ON public.services FOR SELECT TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "Public read published testimonials" ON public.testimonials;
CREATE POLICY "Public read published testimonials" ON public.testimonials FOR SELECT TO anon, authenticated USING (is_published = true);

DROP POLICY IF EXISTS "Public read gallery images" ON public.gallery_images;
CREATE POLICY "Public read gallery images" ON public.gallery_images FOR SELECT TO anon, authenticated USING (true);

-- Insert-only policies for patient booking & contact inquiries (no public SELECT on PII!)
DROP POLICY IF EXISTS "Allow booking patient insert" ON public.patients;
CREATE POLICY "Allow booking patient insert" ON public.patients FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow booking appointment insert" ON public.appointments;
CREATE POLICY "Allow booking appointment insert" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public contact inquiry insert" ON public.contact_inquiries;
CREATE POLICY "Allow public contact inquiry insert" ON public.contact_inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Atomic Server-Side Booking RPC (works safely with publishable key while keeping patients/appointments private)
CREATE OR REPLACE FUNCTION public.book_clinic_appointment(
  p_reference_code TEXT,
  p_patient_name TEXT,
  p_patient_phone TEXT,
  p_patient_email TEXT,
  p_service_slug TEXT,
  p_service_name TEXT,
  p_appointment_date DATE,
  p_start_time TEXT,
  p_end_time TEXT,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id BIGINT;
  v_service_id BIGINT;
  v_appt_id BIGINT;
BEGIN
  SELECT id INTO v_service_id FROM public.services WHERE slug = p_service_slug LIMIT 1;

  SELECT id INTO v_patient_id
  FROM public.patients
  WHERE regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_patient_phone, '\D', '', 'g')
  ORDER BY id DESC
  LIMIT 1;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (full_name, phone, email)
    VALUES (p_patient_name, p_patient_phone, COALESCE(p_patient_email, ''))
    RETURNING id INTO v_patient_id;
  ELSE
    UPDATE public.patients
    SET full_name = p_patient_name,
        email = COALESCE(NULLIF(p_patient_email, ''), email),
        updated_at = NOW()
    WHERE id = v_patient_id;
  END IF;

  INSERT INTO public.appointments (
    reference_code, patient_id, service_id,
    patient_name, patient_phone, patient_email, service_name,
    appointment_date, start_time, end_time, status, notes
  ) VALUES (
    p_reference_code, v_patient_id, v_service_id,
    p_patient_name, p_patient_phone, COALESCE(p_patient_email, ''), p_service_name,
    p_appointment_date, p_start_time, p_end_time, 'pending', COALESCE(p_notes, '')
  )
  ON CONFLICT (reference_code) DO NOTHING
  RETURNING id INTO v_appt_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id,
    'patient_id', v_patient_id,
    'reference_code', p_reference_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_clinic_appointment(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Seed Initial Clinic Settings, Working Hours, and 11 Services
INSERT INTO public.clinic_settings (
  id, business_name, tagline, address, phone, whatsapp_number, email,
  timezone, slot_buffer_minutes, max_concurrent_per_slot, hours_confirmation_note
) VALUES (
  1,
  'Grace Physiotherapy Clinic',
  'Personalized Physiotherapy & Guided Rehabilitation in JP Nagar',
  '2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India',
  '+91 95913 71199',
  '919591371199',
  'appointments@gracephysiotherapy.in',
  'Asia/Kolkata',
  10,
  1,
  'Monday to Saturday: 10:00 AM - 1:00 PM & 5:00 PM - 8:00 PM. Sunday Closed.'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.working_hours (day_of_week, day_name, is_open, morning_start, morning_end, evening_start, evening_end)
VALUES
  (0, 'Sunday', FALSE, '10:00', '13:00', '17:00', '20:00'),
  (1, 'Monday', TRUE, '10:00', '13:00', '17:00', '20:00'),
  (2, 'Tuesday', TRUE, '10:00', '13:00', '17:00', '20:00'),
  (3, 'Wednesday', TRUE, '10:00', '13:00', '17:00', '20:00'),
  (4, 'Thursday', TRUE, '10:00', '13:00', '17:00', '20:00'),
  (5, 'Friday', TRUE, '10:00', '13:00', '17:00', '20:00'),
  (6, 'Saturday', TRUE, '10:00', '13:00', '17:00', '20:00')
ON CONFLICT (day_of_week) DO NOTHING;

INSERT INTO public.services (slug, name, category, short_description, description, duration_minutes, sort_order)
VALUES
  ('neck-and-shoulder-pain', 'Neck and Shoulder Pain', 'Spine & Posture', 'Targeted assessment and gentle mobilization for cervical stiffness and upper-back tension.', 'Targeted assessment and gentle mobilization for cervical stiffness and upper-back tension.', 35, 1),
  ('back-pain-and-spine-rehabilitation', 'Back Pain and Spine Rehabilitation', 'Spine & Posture', 'Structured lumbar and thoracic care focused on core stability and safe movement mechanics.', 'Structured lumbar and thoracic care focused on core stability and safe movement mechanics.', 40, 2),
  ('frozen-shoulder-rehabilitation', 'Frozen Shoulder Rehabilitation', 'Joint Rehabilitation', 'Progressive joint capsule mobilization and pain-paced range-of-motion exercises.', 'Progressive joint capsule mobilization and pain-paced range-of-motion exercises.', 40, 3),
  ('knee-and-joint-pain', 'Knee and Joint Pain', 'Joint Rehabilitation', 'Strengthening and alignment programs for knee stiffness, stair discomfort, and joint overload.', 'Strengthening and alignment programs for knee stiffness, stair discomfort, and joint overload.', 35, 4),
  ('sports-injury-rehabilitation', 'Sports Injury Rehabilitation', 'Active & Sports Care', 'Goal-oriented recovery for sprains, muscle strains, and overuse injuries.', 'Goal-oriented recovery for sprains, muscle strains, and overuse injuries.', 45, 5),
  ('post-surgical-rehabilitation', 'Post-Surgical Rehabilitation', 'Surgical Recovery', 'Protocol-aligned physiotherapy following orthopaedic procedures to rebuild mobility and strength.', 'Protocol-aligned physiotherapy following orthopaedic procedures to rebuild mobility and strength.', 45, 6),
  ('balance-and-mobility-rehabilitation', 'Balance and Mobility Rehabilitation', 'Mobility & Seniors', 'Supervised gait training, coordination drills, and functional strength care.', 'Supervised gait training, coordination drills, and functional strength care.', 35, 7),
  ('ultrasound-therapy', 'Ultrasound Therapy', 'Electrotherapy Modalities', 'Targeted therapeutic acoustic waves used alongside manual care to support soft-tissue comfort.', 'Targeted therapeutic acoustic waves used alongside manual care to support soft-tissue comfort.', 25, 8),
  ('tens-therapy', 'TENS Therapy', 'Electrotherapy Modalities', 'Transcutaneous Electrical Nerve Stimulation calibrated for gentle, non-invasive comfort.', 'Transcutaneous Electrical Nerve Stimulation calibrated for gentle, non-invasive comfort.', 25, 9),
  ('laser-therapy', 'Laser Therapy', 'Electrotherapy Modalities', 'Low-level therapeutic photobiomodulation applied to superficial joints and soft tissues.', 'Low-level therapeutic photobiomodulation applied to superficial joints and soft tissues.', 25, 10),
  ('therapeutic-exercises', 'Therapeutic Exercises', 'Active & Sports Care', 'One-to-one guided strength, flexibility, and motor-control training.', 'One-to-one guided strength, flexibility, and motor-control training.', 35, 11)
ON CONFLICT (slug) DO NOTHING;
