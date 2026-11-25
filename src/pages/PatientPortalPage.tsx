import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  Plus,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import type { AvailabilityResponse, PatientAppointment, TimeSlot } from '../types/clinic';

function formatReadableDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const STATUS_META: Record<
  string,
  { label: string; note: string; cls: string }
> = {
  pending: {
    label: 'Waiting for Confirmation',
    note: 'Reserved and waiting for confirmation from the clinic desk.',
    cls: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  confirmed: {
    label: 'Confirmed',
    note: 'Confirmed by Grace Physiotherapy Clinic.',
    cls: 'bg-[#EBF2EC] text-[#174D3B] border-[#174D3B]/30',
  },
  completed: {
    label: 'Completed',
    note: 'Session completed.',
    cls: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  cancelled: {
    label: 'Cancelled',
    note: 'Cancelled and time slot released.',
    cls: 'bg-red-50 text-red-800 border-red-200',
  },
};

export function PatientPortalPage() {
  const { data, patientToken, patientUser, clearPatientSession } = useClinic();
  const todayIST = data?.todayIST || new Date().toISOString().slice(0, 10);

  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Reschedule state
  const [rescheduleTarget, setRescheduleTarget] = useState<PatientAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleErr, setRescheduleErr] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!patientToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/patient/appointments', {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      if (res.status === 401) {
        clearPatientSession();
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load appointments.');
      setAppointments(json as PatientAppointment[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch your appointments.');
    } finally {
      setLoading(false);
    }
  }, [patientToken, clearPatientSession]);

  useEffect(() => {
    if (patientToken) {
      void loadAppointments();
    } else {
      setLoading(false);
    }
  }, [patientToken, loadAppointments]);

  const handleCancel = async (appt: PatientAppointment) => {
    if (!patientToken) return;
    setBanner(null);
    setError(null);
    const res = await fetch(`/api/patient/appointments/${appt.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Unable to cancel appointment.');
      return;
    }
    setBanner(`Appointment ${appt.referenceCode} has been cancelled.`);
    await loadAppointments();
  };

  const loadSlots = async (dateVal: string, serviceId: number) => {
    setRescheduleDate(dateVal);
    setRescheduleTime('');
    setRescheduleErr(null);
    if (!dateVal) return;
    const res = await fetch(
      `/api/availability?date=${encodeURIComponent(dateVal)}&serviceId=${serviceId}`
    );
    const json = (await res.json()) as AvailabilityResponse;
    setRescheduleSlots(json.slots || []);
  };

  const submitReschedule = async () => {
    if (!patientToken || !rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    setRescheduleErr(null);
    const res = await fetch(`/api/patient/appointments/${rescheduleTarget.id}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        appointmentDate: rescheduleDate,
        startTime: rescheduleTime,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setRescheduleErr(json.error || 'Could not reschedule appointment.');
      return;
    }
    setBanner(`Appointment ${rescheduleTarget.referenceCode} has been rescheduled.`);
    setRescheduleTarget(null);
    await loadAppointments();
  };

  if (!patientToken || !patientUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center mx-auto">
          <User className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[#252B29]">
          Sign in to view your appointments
        </h1>
        <p className="text-sm text-[#252B29]/70">
          Please sign in with your patient account to track booking confirmation status and manage
          visits.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-xl bg-[#174D3B] px-6 py-3 text-sm font-semibold text-white hover:bg-[#10382B]"
        >
          Go to Patient Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#252B29]/10">
        <div>
          <p className="text-xs font-semibold text-[#174D3B]">
            Grace Physiotherapy Clinic · Patient Portal
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#252B29]">
            Welcome, {patientUser.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#252B29]/70 tabular-nums">
            {patientUser.phone}
            {patientUser.email ? ` · ${patientUser.email}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadAppointments()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#252B29]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
          <Link
            to="/book"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B]"
          >
            <Plus className="w-3.5 h-3.5" />
            Book New Appointment
          </Link>
          <button
            type="button"
            onClick={clearPatientSession}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#252B29]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {banner && (
        <div className="rounded-xl border border-[#174D3B]/20 bg-[#EBF2EC] px-4 py-3 text-xs font-semibold text-[#174D3B] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Appointments List */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-[#252B29]">
          Your Physiotherapy Appointments
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[#F3F3EC] animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[#252B29]/10 p-8 text-center space-y-3">
            <p className="text-sm font-medium text-[#252B29]">
              You do not have any physiotherapy appointments yet.
            </p>
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#10382B]"
            >
              Book Your First Visit
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {appointments.map((appt) => {
              const meta = STATUS_META[appt.status] || STATUS_META.pending;
              const isActive = appt.status === 'pending' || appt.status === 'confirmed';
              return (
                <div
                  key={appt.id}
                  className="rounded-2xl bg-white border border-[#252B29]/10 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-[#174D3B] tabular-nums">
                        {appt.referenceCode}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}
                      >
                        {appt.status === 'cancelled' ? (
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : appt.status === 'pending' ? (
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        {meta.label}
                      </span>
                    </div>

                    <h3 className="font-display text-lg font-bold text-[#252B29]">
                      {appt.serviceName}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-[#252B29]/75 tabular-nums">
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#252B29]">
                        <Calendar className="w-3.5 h-3.5 text-[#174D3B]" />
                        {formatReadableDate(appt.appointmentDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium text-[#174D3B]">
                        <Clock className="w-3.5 h-3.5" />
                        {appt.startTimeLabel} – {appt.endTimeLabel} (IST)
                      </span>
                    </div>

                    <p className="text-xs text-[#252B29]/65">{meta.note}</p>
                  </div>

                  {isActive && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setRescheduleTarget(appt);
                          void loadSlots(appt.appointmentDate, appt.serviceId);
                        }}
                        className="rounded-xl border border-[#252B29]/15 bg-[#FAFAF6] px-3.5 py-2 text-xs font-semibold text-[#174D3B] hover:bg-[#EBF2EC] cursor-pointer"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancel(appt)}
                        className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#252B29]/10 max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#252B29]">
              Reschedule {rescheduleTarget.referenceCode}
            </h3>
            <p className="text-xs text-[#252B29]/70">{rescheduleTarget.serviceName}</p>
            <div>
              <label className="block text-xs font-semibold mb-1">Choose New Date</label>
              <input
                type="date"
                min={todayIST}
                value={rescheduleDate}
                onChange={(e) => void loadSlots(e.target.value, rescheduleTarget.serviceId)}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5">Available Time Slots</label>
              {rescheduleSlots.length === 0 ? (
                <p className="text-xs text-[#252B29]/60">No open slots on this date.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {rescheduleSlots.map((slot) => (
                    <button
                      key={slot.startTime}
                      type="button"
                      onClick={() => setRescheduleTime(slot.startTime)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border tabular-nums cursor-pointer ${
                        rescheduleTime === slot.startTime
                          ? 'bg-[#174D3B] text-white border-[#174D3B]'
                          : 'bg-[#FAFAF6] border-[#252B29]/15 text-[#252B29]'
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {rescheduleErr && <p className="text-xs text-red-700">{rescheduleErr}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="rounded-lg border border-[#252B29]/15 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!rescheduleTime}
                onClick={() => void submitReschedule()}
                className="rounded-lg bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
              >
                Save New Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
