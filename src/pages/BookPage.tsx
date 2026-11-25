import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { ServiceIcon } from '../components/ServiceIcon';
import { getDirectionsUrl, getWhatsAppUrl } from '../components/ClinicMap';
import type { AvailabilityResponse, BookingConfirmation, TimeSlot } from '../types/clinic';

const STEP_LABELS = [
  '01. Service',
  '02. Date',
  '03. Time Slot',
  '04. Your Details',
  '05. Reserved',
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatReadableDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const BOOKING_STATUS_META: Record<
  string,
  {
    label: string;
    description: string;
    badgeCls: string;
    bannerCls: string;
  }
> = {
  pending: {
    label: 'Waiting for Confirmation',
    description:
      'Your time slot is reserved and waiting for confirmation from the Grace Physiotherapy clinic desk.',
    badgeCls: 'bg-amber-50 text-amber-900 border-amber-300',
    bannerCls: 'bg-amber-50 border-amber-200 text-amber-950',
  },
  confirmed: {
    label: 'Confirmed',
    description:
      'Your appointment is confirmed by the clinic. Please arrive 5–10 minutes prior to your slot.',
    badgeCls: 'bg-[#EBF2EC] text-[#174D3B] border-[#174D3B]/30',
    bannerCls: 'bg-[#EBF2EC] border-[#174D3B]/25 text-[#174D3B]',
  },
  completed: {
    label: 'Completed',
    description: 'Your physiotherapy session has been completed.',
    badgeCls: 'bg-slate-100 text-slate-700 border-slate-300',
    bannerCls: 'bg-slate-100 border-slate-200 text-slate-800',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This booking was cancelled and the time slot has been released.',
    badgeCls: 'bg-red-50 text-red-800 border-red-200',
    bannerCls: 'bg-red-50 border-red-200 text-red-900',
  },
};

interface LookupResult {
  id: number;
  referenceCode: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  startTimeLabel: string;
  endTimeLabel: string;
  status: string;
  updatedAt?: string;
  serviceId: number;
  serviceName: string;
  durationMinutes: number;
  patientName: string;
}

export function BookPage() {
  const { data, patientUser } = useClinic();
  const [searchParams] = useSearchParams();

  const services = data?.services || [];
  const settings = data?.settings;
  const workingHours = data?.workingHours || [];
  const blockedDates = data?.blockedDates || [];
  const todayIST = data?.todayIST || new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<'book' | 'manage'>('book');
  const [step, setStep] = useState<number>(1);

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const [y, m] = todayIST.split('-').map(Number);
    return { year: y || 2026, month: (m || 1) - 1 };
  });

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // Patient form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Self-service Manage Booking state
  const [lookupRef, setLookupRef] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [manageMsg, setManageMsg] = useState<string | null>(null);

  useEffect(() => {
    if (patientUser) {
      setFullName((prev) => prev || patientUser.name);
      setPhone((prev) => prev || patientUser.phone);
      setEmail((prev) => prev || patientUser.email || '');
    }
  }, [patientUser]);

  // Preselect service from ?service=slug
  useEffect(() => {
    const slug = searchParams.get('service');
    if (slug && services.length > 0 && !selectedServiceId) {
      const found = services.find((s) => s.slug === slug);
      if (found) {
        setSelectedServiceId(found.id);
        setStep(2);
      }
    }
  }, [searchParams, services, selectedServiceId]);

  // Sync calendar month with IST today once loaded
  useEffect(() => {
    if (data?.todayIST) {
      const [y, m] = data.todayIST.split('-').map(Number);
      setCalendarMonth({ year: y, month: m - 1 });
    }
  }, [data?.todayIST]);

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || null,
    [services, selectedServiceId]
  );

  const workingHoursMap = useMemo(() => {
    const rec: Record<number, { is_open: number; day_name: string }> = {};
    for (const wh of workingHours) {
      rec[wh.day_of_week] = { is_open: wh.is_open, day_name: wh.day_name };
    }
    return rec;
  }, [workingHours]);

  const blockedMap = useMemo(() => {
    const rec: Record<string, string> = {};
    for (const b of blockedDates) {
      rec[b.blocked_date] = b.reason;
    }
    return rec;
  }, [blockedDates]);

  const fetchSlotsForDate = async (dateStr: string, serviceId: number) => {
    setLoadingSlots(true);
    setSlotError(null);
    setSelectedSlot(null);
    try {
      const res = await fetch(
        `/api/availability?date=${encodeURIComponent(dateStr)}&serviceId=${serviceId}`
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not load time slots.');
      }
      setAvailability(json as AvailabilityResponse);
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : 'Unable to check availability.');
      setAvailability(null);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    if (!selectedServiceId) return;
    setSelectedDate(dateStr);
    void fetchSlotsForDate(dateStr, selectedServiceId);
    setStep(3);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedSlot || submitting) return;

    setSubmitError(null);
    const trimmedName = fullName.trim();
    const digits = phone.replace(/\D/g, '');
    if (trimmedName.length < 2) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (digits.length < 10 || digits.length > 15) {
      setSubmitError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setSubmitError('Please enter a valid email address or leave it empty.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          appointmentDate: selectedDate,
          startTime: selectedSlot.startTime,
          fullName: trimmedName,
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          await fetchSlotsForDate(selectedDate, selectedService.id);
        }
        throw new Error(json.error || 'Unable to complete booking.');
      }

      setConfirmation(json as BookingConfirmation);
      setStep(5);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Booking submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: Array<{
      dateStr: string | null;
      dayNum: number | null;
      disabled: boolean;
      reason: string | null;
    }> = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push({ dateStr: null, dayNum: null, disabled: true, reason: null });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`;
      const dow = new Date(Date.UTC(year, month, d)).getUTCDay();
      const isPast = dateStr < todayIST;
      const wh = workingHoursMap[dow];
      const isClosedDay = wh ? wh.is_open !== 1 : dow === 0;
      const blockedReason = blockedMap[dateStr] || null;

      let reason: string | null = null;
      if (isPast) reason = 'Past date';
      else if (blockedReason) reason = blockedReason;
      else if (isClosedDay) reason = 'Closed';

      cells.push({
        dateStr,
        dayNum: d,
        disabled: Boolean(reason),
        reason,
      });
    }
    return cells;
  }, [calendarMonth, todayIST, workingHoursMap, blockedMap]);

  const monthTitle = useMemo(() => {
    const dt = new Date(Date.UTC(calendarMonth.year, calendarMonth.month, 1));
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    }).format(dt);
  }, [calendarMonth]);

  const morningSlots = useMemo(
    () => (availability?.slots || []).filter((s) => s.session === 'morning'),
    [availability]
  );
  const eveningSlots = useMemo(
    () => (availability?.slots || []).filter((s) => s.session === 'evening'),
    [availability]
  );

  // Manage & Track Booking handlers
  const runLookup = async (refCode: string, phoneNum: string) => {
    setLookupError(null);
    setManageMsg(null);
    setLookupLoading(true);
    try {
      const res = await fetch('/api/appointments/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceCode: refCode.trim(), phone: phoneNum.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Booking not found.');
      setLookupResult(json as LookupResult);
      setRescheduleDate('');
      setRescheduleSlots([]);
      setRescheduleTime('');
    } catch (err) {
      setLookupResult(null);
      setLookupError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    await runLookup(lookupRef, lookupPhone);
  };

  const handleLoadRescheduleSlots = async (dateVal: string) => {
    if (!lookupResult || !dateVal) return;
    setRescheduleDate(dateVal);
    setRescheduleTime('');
    const res = await fetch(
      `/api/availability?date=${encodeURIComponent(dateVal)}&serviceId=${lookupResult.serviceId}`
    );
    const json = (await res.json()) as AvailabilityResponse;
    setRescheduleSlots(json.slots || []);
  };

  const handleSelfReschedule = async () => {
    if (!lookupResult || !rescheduleDate || !rescheduleTime) return;
    setLookupError(null);
    const res = await fetch('/api/appointments/self-reschedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceCode: lookupResult.referenceCode,
        phone: lookupPhone.trim(),
        appointmentDate: rescheduleDate,
        startTime: rescheduleTime,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setLookupError(json.error || 'Reschedule failed.');
      return;
    }
    setLookupResult({
      ...lookupResult,
      appointmentDate: json.appointmentDate,
      startTime: json.startTime,
      startTimeLabel: json.startTimeLabel,
    });
    setManageMsg('Your appointment has been rescheduled.');
    setRescheduleDate('');
    setRescheduleSlots([]);
    setRescheduleTime('');
  };

  const handleSelfCancel = async () => {
    if (!lookupResult) return;
    setLookupError(null);
    const res = await fetch('/api/appointments/self-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceCode: lookupResult.referenceCode,
        phone: lookupPhone.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setLookupError(json.error || 'Cancellation failed.');
      return;
    }
    setLookupResult({ ...lookupResult, status: 'cancelled' });
    setManageMsg('Your appointment has been cancelled.');
  };

  const resetBookingFlow = () => {
    setStep(1);
    setSelectedServiceId(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setAvailability(null);
    setConfirmation(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setSubmitError(null);
  };

  const whatsappShareUrl = confirmation
    ? getWhatsAppUrl(
        confirmation.whatsappNumber,
        `Hello Grace Physiotherapy Clinic,\nI have booked an appointment:\nReference: ${confirmation.referenceCode}\nName: ${confirmation.patientName}\nService: ${confirmation.serviceName}\nDate: ${formatReadableDate(confirmation.appointmentDate)}\nTime: ${confirmation.startTimeLabel}\nThank you.`
      )
    : '#';

  const mailtoConfirmUrl = confirmation
    ? `mailto:${encodeURIComponent(confirmation.patientEmail || settings?.email || '')}?subject=${encodeURIComponent(
        `Appointment Summary - ${confirmation.referenceCode}`
      )}&body=${encodeURIComponent(
        `Grace Physiotherapy Clinic Booking Confirmation\n\nReference: ${confirmation.referenceCode}\nPatient: ${confirmation.patientName}\nService: ${confirmation.serviceName}\nDate: ${formatReadableDate(confirmation.appointmentDate)}\nTime: ${confirmation.startTimeLabel} - ${confirmation.endTimeLabel}\nClinic Address: ${confirmation.clinicAddress}\nPhone: ${confirmation.clinicPhone}`
      )}`
    : '#';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#252B29]/10">
        <div>
          <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
            Online Appointment Scheduling · Asia/Kolkata (IST)
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#252B29]">
            Book a physiotherapy appointment
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#252B29]/72">
            Morning (10:00 AM – 1:00 PM) and Evening (5:00 PM – 8:00 PM) · Monday to Saturday.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="inline-flex p-1 rounded-xl bg-[#F3F3EC] border border-[#252B29]/10 self-start">
          <button
            type="button"
            onClick={() => setMode('book')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'book'
                ? 'bg-[#174D3B] text-white'
                : 'text-[#252B29]/75 hover:text-[#174D3B]'
            }`}
          >
            New Booking
          </button>
          <button
            type="button"
            onClick={() => setMode('manage')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'manage'
                ? 'bg-[#174D3B] text-white'
                : 'text-[#252B29]/75 hover:text-[#174D3B]'
            }`}
          >
            Track / Manage Booking
          </button>
        </div>
      </div>

      {mode === 'manage' ? (
        <div className="mt-8 max-w-2xl">
          <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8">
            <h2 className="font-display text-xl font-bold text-[#252B29]">
              Track, reschedule, or cancel your appointment
            </h2>
            <p className="mt-1.5 text-sm text-[#252B29]/70">
              Enter your booking reference number and registered mobile number to check whether your
              booking is waiting for confirmation, confirmed, or cancelled.
            </p>

            <form onSubmit={handleLookup} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="lookup-ref"
                  className="block text-xs font-semibold text-[#252B29] mb-1.5"
                >
                  Booking Reference
                </label>
                <input
                  id="lookup-ref"
                  type="text"
                  required
                  placeholder="e.g. GPC-20261126-A1B2"
                  value={lookupRef}
                  onChange={(e) => setLookupRef(e.target.value)}
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                />
              </div>
              <div>
                <label
                  htmlFor="lookup-phone"
                  className="block text-xs font-semibold text-[#252B29] mb-1.5"
                >
                  Mobile Number
                </label>
                <input
                  id="lookup-phone"
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  value={lookupPhone}
                  onChange={(e) => setLookupPhone(e.target.value)}
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#10382B] disabled:opacity-60 cursor-pointer"
                >
                  <Search className="w-4 h-4" aria-hidden="true" />
                  {lookupLoading ? 'Checking Status...' : 'Track Appointment'}
                </button>
              </div>
            </form>

            {lookupError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{lookupError}</span>
              </div>
            )}

            {manageMsg && (
              <div className="mt-4 rounded-xl bg-[#EBF2EC] border border-[#174D3B]/20 px-4 py-3 text-sm text-[#174D3B] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{manageMsg}</span>
              </div>
            )}

            {lookupResult && (() => {
              const statusMeta =
                BOOKING_STATUS_META[lookupResult.status] || BOOKING_STATUS_META.pending;
              const isPending = lookupResult.status === 'pending';
              const isConfirmed = lookupResult.status === 'confirmed';
              const isCompleted = lookupResult.status === 'completed';
              const isCancelled = lookupResult.status === 'cancelled';

              return (
                <div className="mt-6 pt-6 border-t border-[#252B29]/10 space-y-5">
                  {/* Live Status Banner */}
                  <div className={`rounded-xl border p-4 space-y-3 ${statusMeta.bannerCls}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isCancelled ? (
                          <XCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
                        ) : isPending ? (
                          <Clock className="w-5 h-5 shrink-0" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                        )}
                        <span className="font-display text-base font-bold">
                          Booking Status: {statusMeta.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void runLookup(lookupResult.referenceCode, lookupPhone)}
                        disabled={lookupLoading}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/80 border border-current/20 px-2.5 py-1 text-xs font-semibold hover:bg-white cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${lookupLoading ? 'animate-spin' : ''}`}
                          aria-hidden="true"
                        />
                        Refresh Status
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">{statusMeta.description}</p>

                    {/* 3-Step Visual Status Tracker */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="rounded-lg bg-white/80 px-2.5 py-2 text-[11px] font-semibold border border-current/15">
                        <span className="block opacity-65">Step 1</span>
                        <span>Request Received</span>
                      </div>
                      <div
                        className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold border ${
                          isCancelled
                            ? 'bg-white/50 opacity-60 border-transparent'
                            : isPending
                            ? 'bg-white border-amber-400 text-amber-900'
                            : 'bg-white/90 border-[#174D3B]/30 text-[#174D3B]'
                        }`}
                      >
                        <span className="block opacity-65">Step 2</span>
                        <span>{isPending ? 'Waiting Confirmation' : 'Confirmed'}</span>
                      </div>
                      <div
                        className={`rounded-lg px-2.5 py-2 text-[11px] font-semibold border ${
                          isCancelled
                            ? 'bg-white border-red-300 text-red-800'
                            : isCompleted
                            ? 'bg-white border-[#174D3B]/30 text-[#174D3B]'
                            : 'bg-white/45 opacity-60 border-transparent'
                        }`}
                      >
                        <span className="block opacity-65">Step 3</span>
                        <span>{isCancelled ? 'Cancelled' : 'Visit Completed'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-[#252B29]/60">Patient & Service</p>
                      <p className="font-semibold text-[#252B29] mt-0.5">
                        {lookupResult.patientName} · {lookupResult.serviceName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#252B29]/60">Appointment Time</p>
                      <p className="font-semibold text-[#174D3B] mt-0.5 tabular-nums">
                        {formatReadableDate(lookupResult.appointmentDate)} ·{' '}
                        {lookupResult.startTimeLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#252B29]/60">Current Status</p>
                      <span
                        className={`inline-block mt-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeCls}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-[#252B29]/60">Reference Code</p>
                      <p className="font-mono text-xs font-semibold text-[#252B29] mt-1 tabular-nums">
                        {lookupResult.referenceCode}
                      </p>
                    </div>
                  </div>

                  {!isCancelled && !isCompleted && (
                  <div className="space-y-4 pt-3 border-t border-[#252B29]/8">
                    <div>
                      <label className="block text-xs font-semibold text-[#252B29] mb-1.5">
                        Reschedule to a new date
                      </label>
                      <input
                        type="date"
                        min={todayIST}
                        value={rescheduleDate}
                        onChange={(e) => void handleLoadRescheduleSlots(e.target.value)}
                        className="rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2 text-sm"
                      />
                    </div>

                    {rescheduleDate && (
                      <div>
                        <p className="text-xs font-semibold text-[#252B29] mb-2">
                          Available Slots on {rescheduleDate}
                        </p>
                        {rescheduleSlots.length === 0 ? (
                          <p className="text-xs text-[#252B29]/65">
                            No slots available on this date.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
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
                    )}

                    <div className="flex flex-wrap gap-3 pt-2">
                      {rescheduleTime && (
                        <button
                          type="button"
                          onClick={() => void handleSelfReschedule()}
                          className="rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] cursor-pointer"
                        >
                          Confirm New Time
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSelfCancel()}
                        className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        Cancel Appointment
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <>
          {/* Progress Steps Bar */}
          <nav aria-label="Booking progress" className="mt-8">
            <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {STEP_LABELS.map((label, idx) => {
                const num = idx + 1;
                const isCurrent = step === num;
                const isDone = step > num;
                const canJump = num < step && step < 5;
                return (
                  <li key={label}>
                    <button
                      type="button"
                      disabled={!canJump}
                      onClick={() => canJump && setStep(num)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-colors tabular-nums ${
                        isCurrent
                          ? 'bg-[#174D3B] text-white border-[#174D3B]'
                          : isDone
                          ? 'bg-[#EBF2EC] text-[#174D3B] border-[#174D3B]/20 cursor-pointer'
                          : 'bg-white text-[#252B29]/50 border-[#252B29]/10'
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Step 1: Select Service */}
          {step === 1 && (
            <section className="mt-8">
              <h2 className="font-display text-xl font-bold text-[#252B29]">
                Step 1: Choose your physiotherapy service
              </h2>
              <p className="mt-1 text-sm text-[#252B29]/68">
                Select the focus area most relevant to your concern.
              </p>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((svc) => {
                  const selected = selectedServiceId === svc.id;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(svc.id);
                        setSelectedDate('');
                        setSelectedSlot(null);
                        setStep(2);
                      }}
                      className={`text-left rounded-2xl p-5 border transition-colors flex flex-col justify-between cursor-pointer ${
                        selected
                          ? 'bg-[#EBF2EC] border-[#174D3B]'
                          : 'bg-white border-[#252B29]/10 hover:border-[#174D3B]/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center">
                            <ServiceIcon name={svc.icon_name} className="w-5 h-5" />
                          </div>
                          <span className="text-xs text-[#252B29]/60 tabular-nums">
                            {svc.duration_minutes} min
                          </span>
                        </div>
                        <h3 className="mt-4 font-display text-base font-bold text-[#252B29]">
                          {svc.name}
                        </h3>
                        <p className="mt-1.5 text-xs sm:text-sm text-[#252B29]/72 leading-relaxed">
                          {svc.short_description}
                        </p>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#174D3B]">
                        Select & choose date
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Step 2: Interactive Calendar */}
          {step === 2 && selectedService && (
            <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#252B29]">
                      Step 2: Select an appointment date
                    </h2>
                    <p className="text-xs sm:text-sm text-[#252B29]/65 mt-1">
                      Sundays, past dates, and clinic holidays are automatically disabled.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() =>
                        setCalendarMonth((prev) =>
                          prev.month === 0
                            ? { year: prev.year - 1, month: 11 }
                            : { year: prev.year, month: prev.month - 1 }
                        )
                      }
                      className="w-9 h-9 rounded-lg border border-[#252B29]/15 flex items-center justify-center hover:bg-[#EBF2EC] cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-display text-sm font-bold text-[#252B29] min-w-[130px] text-center tabular-nums">
                      {monthTitle}
                    </span>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() =>
                        setCalendarMonth((prev) =>
                          prev.month === 11
                            ? { year: prev.year + 1, month: 0 }
                            : { year: prev.year, month: prev.month + 1 }
                        )
                      }
                      className="w-9 h-9 rounded-lg border border-[#252B29]/15 flex items-center justify-center hover:bg-[#EBF2EC] cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#252B29]/55">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarDays.map((cell, idx) => {
                    if (!cell.dateStr) {
                      return <div key={`empty-${idx}`} className="h-12" />;
                    }
                    const isSelected = selectedDate === cell.dateStr;
                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={cell.disabled}
                        title={cell.reason || `Select ${cell.dateStr}`}
                        onClick={() => handleSelectDate(cell.dateStr!)}
                        className={`h-12 rounded-xl text-sm font-medium tabular-nums flex flex-col items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-[#174D3B] text-white border-[#174D3B]'
                            : cell.disabled
                            ? 'bg-[#F3F3EC]/70 text-[#252B29]/30 border-transparent cursor-not-allowed'
                            : 'bg-[#FAFAF6] text-[#252B29] border-[#252B29]/12 hover:border-[#174D3B] hover:bg-[#EBF2EC] cursor-pointer'
                        }`}
                      >
                        <span>{cell.dayNum}</span>
                        {cell.dateStr === todayIST && !cell.disabled && (
                          <span className="text-[10px] leading-none text-[#174D3B]">Today</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 pt-5 border-t border-[#252B29]/10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#252B29]/75 hover:text-[#174D3B] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Change Service
                  </button>
                </div>
              </div>

              <aside className="lg:col-span-4 rounded-2xl bg-[#F3F3EC] border border-[#252B29]/10 p-6 h-fit">
                <p className="text-xs font-semibold text-[#174D3B]">Booking Summary</p>
                <h3 className="mt-2 font-display text-lg font-bold text-[#252B29]">
                  {selectedService.name}
                </h3>
                <p className="mt-1 text-xs text-[#252B29]/65 tabular-nums">
                  {selectedService.category} · Est. {selectedService.duration_minutes} minutes
                </p>
                <div className="mt-5 pt-4 border-t border-[#252B29]/10 text-xs text-[#252B29]/75 space-y-2">
                  <p className="font-semibold text-[#252B29]">Clinic Operating Windows</p>
                  <p className="tabular-nums">Morning: 10:00 AM – 1:00 PM</p>
                  <p className="tabular-nums">Evening: 5:00 PM – 8:00 PM</p>
                  <p>Sunday: Closed</p>
                </div>
              </aside>
            </section>
          )}

          {/* Step 3: Select Time Slot */}
          {step === 3 && selectedService && (
            <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#252B29]">
                      Step 3: Choose an available time slot
                    </h2>
                    <p className="text-sm text-[#174D3B] font-medium mt-1">
                      {formatReadableDate(selectedDate)} · IST (Asia/Kolkata)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-semibold text-[#174D3B] hover:underline cursor-pointer"
                  >
                    Change Date
                  </button>
                </div>

                {loadingSlots ? (
                  <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <div key={n} className="h-12 rounded-xl bg-[#F3F3EC] animate-pulse" />
                    ))}
                  </div>
                ) : slotError ? (
                  <div className="mt-6 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                    {slotError}
                  </div>
                ) : !availability?.isOpen ? (
                  <div className="mt-6 rounded-xl bg-[#F3F3EC] border border-[#252B29]/10 p-6 text-sm text-[#252B29]/80">
                    <p className="font-semibold text-[#252B29]">
                      {availability?.closedReason || 'No appointments available on this date.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="mt-4 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                    >
                      Choose Another Date
                    </button>
                  </div>
                ) : availability.slots.length === 0 ? (
                  <div className="mt-6 rounded-xl bg-[#F3F3EC] border border-[#252B29]/10 p-6 text-sm text-[#252B29]/80">
                    <p className="font-semibold text-[#252B29]">
                      All appointment slots for this date are currently booked.
                    </p>
                    <p className="mt-1 text-xs text-[#252B29]/70">
                      Please choose another day or call us at {settings?.phone || '+91 95913 71199'}{' '}
                      for assistance.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="mt-4 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                    >
                      Pick Another Date
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 space-y-8">
                    <div>
                      <h3 className="font-display text-sm font-bold text-[#252B29] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#174D3B]" aria-hidden="true" />
                        Morning Session (10:00 AM – 1:00 PM)
                      </h3>
                      {morningSlots.length === 0 ? (
                        <p className="mt-2 text-xs text-[#252B29]/60">
                          No morning slots remaining for this date.
                        </p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {morningSlots.map((slot) => {
                            const active = selectedSlot?.startTime === slot.startTime;
                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setStep(4);
                                }}
                                className={`rounded-xl border px-3.5 py-3 text-sm font-semibold tabular-nums transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#174D3B] text-white border-[#174D3B]'
                                    : 'bg-[#FAFAF6] text-[#252B29] border-[#252B29]/15 hover:border-[#174D3B] hover:bg-[#EBF2EC]'
                                }`}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-display text-sm font-bold text-[#252B29] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#174D3B]" aria-hidden="true" />
                        Evening Session (5:00 PM – 8:00 PM)
                      </h3>
                      {eveningSlots.length === 0 ? (
                        <p className="mt-2 text-xs text-[#252B29]/60">
                          No evening slots remaining for this date.
                        </p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {eveningSlots.map((slot) => {
                            const active = selectedSlot?.startTime === slot.startTime;
                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                onClick={() => {
                                  setSelectedSlot(slot);
                                  setStep(4);
                                }}
                                className={`rounded-xl border px-3.5 py-3 text-sm font-semibold tabular-nums transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#174D3B] text-white border-[#174D3B]'
                                    : 'bg-[#FAFAF6] text-[#252B29] border-[#252B29]/15 hover:border-[#174D3B] hover:bg-[#EBF2EC]'
                                }`}
                              >
                                {slot.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-5 border-t border-[#252B29]/10">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#252B29]/75 hover:text-[#174D3B] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Calendar
                  </button>
                </div>
              </div>

              <aside className="lg:col-span-4 rounded-2xl bg-[#F3F3EC] border border-[#252B29]/10 p-6 h-fit space-y-4">
                <p className="text-xs font-semibold text-[#174D3B]">Booking Summary</p>
                <div>
                  <p className="text-xs text-[#252B29]/60">Selected Service</p>
                  <p className="font-display text-base font-bold text-[#252B29] mt-0.5">
                    {selectedService.name}
                  </p>
                  <p className="text-xs text-[#252B29]/65 tabular-nums">
                    Est. {selectedService.duration_minutes} mins
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#252B29]/60">Selected Date</p>
                  <p className="font-semibold text-sm text-[#252B29] mt-0.5">
                    {formatReadableDate(selectedDate)}
                  </p>
                </div>
              </aside>
            </section>
          )}

          {/* Step 4: Patient Information */}
          {step === 4 && selectedService && selectedSlot && (
            <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleConfirmBooking}
                className="lg:col-span-8 rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8 space-y-5"
              >
                <div>
                  <h2 className="font-display text-xl font-bold text-[#252B29]">
                    Step 4: Enter your contact details
                  </h2>
                  <p className="text-sm text-[#252B29]/68 mt-1">
                    We only collect essential contact details needed to confirm your visit.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="patient-name"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Full Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="patient-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="patient-phone"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Mobile Number <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="patient-phone"
                      type="tel"
                      required
                      placeholder="+91 98XXX XXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="patient-email"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Email Address (Optional)
                    </label>
                    <input
                      id="patient-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="patient-notes"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Additional Message (Optional)
                    </label>
                    <textarea
                      id="patient-notes"
                      rows={3}
                      maxLength={500}
                      placeholder="Brief note about scheduling preference or area of discomfort (avoid sharing sensitive medical documents here)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>
                </div>

                {submitError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="pt-4 border-t border-[#252B29]/10 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#252B29]/75 hover:text-[#174D3B] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Change Time Slot
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174D3B] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#10382B] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Reserving Slot...' : 'Confirm Appointment'}
                  </button>
                </div>
              </form>

              <aside className="lg:col-span-4 rounded-2xl bg-[#F3F3EC] border border-[#252B29]/10 p-6 h-fit space-y-4">
                <p className="text-xs font-semibold text-[#174D3B]">Selected Appointment</p>
                <div>
                  <p className="text-xs text-[#252B29]/60">Service</p>
                  <p className="font-display text-base font-bold text-[#252B29] mt-0.5">
                    {selectedService.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#252B29]/60">Date</p>
                  <p className="font-semibold text-sm text-[#252B29] mt-0.5">
                    {formatReadableDate(selectedDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#252B29]/60">Time Window</p>
                  <p className="font-semibold text-sm text-[#174D3B] mt-0.5 tabular-nums">
                    {selectedSlot.label} – {selectedSlot.endLabel}
                  </p>
                </div>
                <div className="pt-3 border-t border-[#252B29]/10 text-xs text-[#252B29]/70">
                  <p className="font-semibold text-[#252B29]">Clinic Address</p>
                  <p className="mt-1 leading-relaxed">{settings?.address}</p>
                </div>
              </aside>
            </section>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && confirmation && (
            <section className="mt-8 max-w-3xl">
              <div className="rounded-2xl bg-white border border-[#174D3B]/25 p-6 md:p-10">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      Status: {(BOOKING_STATUS_META[confirmation.status] || BOOKING_STATUS_META.pending).label}
                    </div>
                    <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#252B29]">
                      Your booking request has been received
                    </h2>
                    <p className="mt-2 text-sm text-[#252B29]/72">
                      Your slot is reserved and waiting for confirmation from the clinic. Save your
                      reference number to track live confirmation status anytime.
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-xl bg-[#F3F3EC] border border-[#252B29]/10 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#252B29]/60">Booking Reference Number</p>
                    <p className="font-display text-xl font-bold text-[#174D3B] tabular-nums mt-0.5">
                      {confirmation.referenceCode}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(confirmation.referenceCode);
                        setCopiedRef(true);
                        setTimeout(() => setCopiedRef(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#252B29]/15 px-3.5 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#EBF2EC] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      {copiedRef ? 'Copied' : 'Copy Reference'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLookupRef(confirmation.referenceCode);
                        setLookupPhone(confirmation.patientPhone);
                        setMode('manage');
                        void runLookup(confirmation.referenceCode, confirmation.patientPhone);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#174D3B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10382B] cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5" aria-hidden="true" />
                      Track Booking Status
                    </button>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm border-y border-[#252B29]/10 py-6">
                  <div>
                    <dt className="text-xs text-[#252B29]/60">Patient Name</dt>
                    <dd className="mt-1 font-semibold text-[#252B29]">
                      {confirmation.patientName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#252B29]/60">Selected Service</dt>
                    <dd className="mt-1 font-semibold text-[#252B29]">
                      {confirmation.serviceName} ({confirmation.serviceDuration} min)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#252B29]/60">Appointment Date</dt>
                    <dd className="mt-1 font-semibold text-[#252B29] flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#174D3B]" aria-hidden="true" />
                      {formatReadableDate(confirmation.appointmentDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#252B29]/60">Appointment Time</dt>
                    <dd className="mt-1 font-semibold text-[#174D3B] tabular-nums flex items-center gap-1.5">
                      <Clock className="w-4 h-4" aria-hidden="true" />
                      {confirmation.startTimeLabel} – {confirmation.endTimeLabel} (IST)
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[#252B29]/60">Clinic Address</dt>
                    <dd className="mt-1 text-[#252B29]/85 flex items-start gap-1.5 leading-relaxed">
                      <MapPin className="w-4 h-4 text-[#174D3B] mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{confirmation.clinicAddress}</span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-5 py-3 text-sm font-semibold text-white hover:bg-[#10382B] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-[#A9C5AE]" aria-hidden="true" />
                    Share Details via WhatsApp
                  </a>
                  <a
                    href={mailtoConfirmUrl}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#252B29]/15 bg-[#FAFAF6] px-5 py-3 text-sm font-semibold text-[#252B29] hover:bg-[#EBF2EC] transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[#174D3B]" aria-hidden="true" />
                    Email Confirmation Summary
                  </a>
                  <a
                    href={getDirectionsUrl(settings)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#252B29]/15 bg-white px-5 py-3 text-sm font-semibold text-[#174D3B] hover:bg-[#EBF2EC] transition-colors"
                  >
                    Get Directions
                  </a>
                </div>

                <div className="mt-8 pt-5 border-t border-[#252B29]/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#252B29]/65">
                  <button
                    type="button"
                    onClick={resetBookingFlow}
                    className="font-semibold text-[#174D3B] hover:underline cursor-pointer"
                  >
                    Book Another Appointment
                  </button>
                  <Link to="/" className="hover:underline">
                    Return to Homepage
                  </Link>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
