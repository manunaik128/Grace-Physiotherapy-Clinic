export interface ClinicSettings {
  id: number;
  business_name: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  timezone: string;
  slot_buffer_minutes: number;
  max_concurrent_per_slot: number;
  hours_confirmation_note: string;
  about_overview: string;
  mission: string;
  vision: string;
  philosophy: string;
  latitude: number;
  longitude: number;
  updated_at: string;
}

export interface WorkingHour {
  id: number;
  day_of_week: number;
  day_name: string;
  is_open: number;
  morning_start: string;
  morning_end: string;
  evening_start: string;
  evening_end: string;
}

export interface BlockedDate {
  id: number;
  blocked_date: string;
  reason: string;
  block_type: 'holiday' | 'closure';
  created_at: string;
}

export interface Service {
  id: number;
  slug: string;
  name: string;
  category: string;
  short_description: string;
  description: string;
  benefits: string[];
  suitable_for: string[];
  duration_minutes: number;
  image_url: string;
  icon_name: string;
  is_active: number;
  sort_order: number;
}

export interface Testimonial {
  id: number;
  patient_name: string;
  condition_tag: string;
  quote: string;
  visit_context: string;
  is_published: number;
  created_at: string;
}

export interface GalleryImage {
  id: number;
  title: string;
  caption: string;
  category: string;
  image_url: string;
  is_illustrative: number;
  sort_order: number;
}

export interface TeamMember {
  id: number;
  name: string;
  role_title: string;
  bio: string;
  focus_areas: string;
  photo_url: string;
  is_published: number;
  sort_order: number;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  label: string;
  endLabel: string;
  session: 'morning' | 'evening';
  remainingCapacity: number;
}

export interface AvailabilityResponse {
  date: string;
  serviceId: number;
  durationMinutes: number;
  isOpen: boolean;
  closedReason: string | null;
  slots: TimeSlot[];
}

export interface BookingConfirmation {
  referenceCode: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  serviceName: string;
  serviceDuration: number;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  startTimeLabel: string;
  endTimeLabel: string;
  status: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  whatsappNumber: string;
  emailSentNote: string | null;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface AdminAppointment {
  id: number;
  reference_code: string;
  patient_id: number;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  service_id: number;
  service_name: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string;
  admin_notes: string;
  supabase_synced?: number;
  supabase_sync_error?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentHistoryItem {
  id: number;
  appointment_id: number;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  details: string;
  created_at: string;
}

export interface AdminOverviewMetrics {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  pending: number;
  todayDateIST: string;
}

export interface ContactInquiry {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export interface AdminProfile {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'staff';
  created_at: string;
}

export interface SupabaseStatusResponse {
  configured: boolean;
  projectHost: string;
  hasServiceRole: boolean;
  tables: Record<string, { exists: boolean; message: string }>;
  syncedCount: number;
  unsyncedCount: number;
  schemaSql: string;
}

export interface PatientProfile {
  accountId: number;
  patientId: number;
  name: string;
  phone: string;
  email: string;
}

export interface PatientAppointment {
  id: number;
  referenceCode: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  startTimeLabel: string;
  endTimeLabel: string;
  status: AppointmentStatus;
  serviceId: number;
  serviceName: string;
  durationMinutes: number;
  notes: string;
  updatedAt: string;
}
