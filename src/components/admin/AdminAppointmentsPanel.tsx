import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Download,
  Eye,
  History,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type {
  AdminAppointment,
  AdminOverviewMetrics,
  AppointmentHistoryItem,
  AppointmentStatus,
  AvailabilityResponse,
  Service,
  TimeSlot,
} from '../../types/clinic';

function formatTime12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function getISTToday(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000);
  return ist.toISOString().slice(0, 10);
}

const STATUS_BADGE: Record<AppointmentStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'text-amber-800 bg-amber-50 border-amber-200' },
  confirmed: { label: 'Confirmed', cls: 'text-[#174D3B] bg-[#EBF2EC] border-[#174D3B]/25' },
  completed: { label: 'Completed', cls: 'text-slate-700 bg-slate-100 border-slate-200' },
  cancelled: { label: 'Cancelled', cls: 'text-red-800 bg-red-50 border-red-200' },
};

export function AdminAppointmentsPanel({
  token,
  services,
}: {
  token: string;
  services: Service[];
}) {
  const [overview, setOverview] = useState<AdminOverviewMetrics | null>(null);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // View Details + History Modal
  const [viewTarget, setViewTarget] = useState<AdminAppointment | null>(null);
  const [historyRows, setHistoryRows] = useState<AppointmentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Edit Appointment Modal
  const [editTarget, setEditTarget] = useState<AdminAppointment | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editServiceId, setEditServiceId] = useState<number>(0);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editStatus, setEditStatus] = useState<AppointmentStatus>('pending');
  const [editNotes, setEditNotes] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [editSlots, setEditSlots] = useState<TimeSlot[]>([]);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Cancel Confirmation Modal
  const [cancelTarget, setCancelTarget] = useState<AdminAppointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);

  // New / Walk-in Booking Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newServiceId, setNewServiceId] = useState<number>(0);
  const [newDate, setNewDate] = useState(getISTToday());
  const [newTime, setNewTime] = useState('');
  const [newStatus, setNewStatus] = useState<'pending' | 'confirmed'>('confirmed');
  const [newNotes, setNewNotes] = useState('');
  const [newSlots, setNewSlots] = useState<TimeSlot[]>([]);
  const [newSlotsMsg, setNewSlotsMsg] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (filterDate) params.set('date', filterDate);
      if (filterServiceId) params.set('serviceId', filterServiceId);
      if (filterStatus) params.set('status', filterStatus);

      const [ovRes, apptsRes] = await Promise.all([
        fetch('/api/admin/overview', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/appointments?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!ovRes.ok || !apptsRes.ok) {
        throw new Error('Failed to load appointments.');
      }

      setOverview((await ovRes.json()) as AdminOverviewMetrics);
      setAppointments((await apptsRes.json()) as AdminAppointment[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [token, search, filterDate, filterServiceId, filterStatus]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadAvailability = async (
    dateStr: string,
    serviceId: number,
    onResult: (slots: TimeSlot[], closedReason: string | null) => void
  ) => {
    if (!dateStr || !serviceId) {
      onResult([], null);
      return;
    }
    try {
      const res = await fetch(
        `/api/availability?date=${encodeURIComponent(dateStr)}&serviceId=${serviceId}`
      );
      const json = (await res.json()) as AvailabilityResponse;
      onResult(json.slots || [], json.isOpen ? null : json.closedReason);
    } catch {
      onResult([], 'Unable to fetch available slots.');
    }
  };

  const openViewDetails = async (appt: AdminAppointment) => {
    setViewTarget(appt);
    setHistoryRows([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/appointments/${appt.id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHistoryRows((await res.json()) as AppointmentHistoryItem[]);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const updateStatus = async (id: number, status: AppointmentStatus, reason?: string) => {
    const res = await fetch(`/api/admin/appointments/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, reason }),
    });
    if (res.ok) {
      setActionBanner(`Appointment status updated to ${status}.`);
      await loadData();
      if (viewTarget && viewTarget.id === id) {
        setViewTarget((prev) => (prev ? { ...prev, status } : null));
      }
    }
  };

  const openEditModal = (appt: AdminAppointment) => {
    setEditTarget(appt);
    setEditName(appt.patient_name);
    setEditPhone(appt.patient_phone);
    setEditEmail(appt.patient_email || '');
    setEditServiceId(appt.service_id);
    setEditDate(appt.appointment_date);
    setEditTime(appt.start_time);
    setEditStatus(appt.status);
    setEditNotes(appt.notes || '');
    setEditAdminNotes(appt.admin_notes || '');
    setEditErr(null);
    void loadAvailability(appt.appointment_date, appt.service_id, (slots) => {
      setEditSlots(slots);
    });
  };

  const submitEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditErr(null);
    try {
      const res = await fetch(`/api/admin/appointments/${editTarget.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_name: editName,
          patient_phone: editPhone,
          patient_email: editEmail,
          service_id: editServiceId,
          appointment_date: editDate,
          start_time: editTime,
          status: editStatus,
          notes: editNotes,
          admin_notes: editAdminNotes,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditErr(json.error || 'Could not save appointment changes.');
        return;
      }
      setActionBanner(`Saved changes for ${editTarget.reference_code}.`);
      setEditTarget(null);
      setViewTarget(null);
      await loadData();
    } finally {
      setEditSaving(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setCancelSaving(true);
    try {
      await updateStatus(cancelTarget.id, 'cancelled', cancelReason);
      setCancelTarget(null);
      setCancelReason('');
      setViewTarget(null);
    } finally {
      setCancelSaving(false);
    }
  };

  const openCreateModal = () => {
    const defaultSvcId = services[0]?.id || 0;
    const today = getISTToday();
    setCreateOpen(true);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewServiceId(defaultSvcId);
    setNewDate(today);
    setNewTime('');
    setNewStatus('confirmed');
    setNewNotes('');
    setCreateErr(null);
    void loadAvailability(today, defaultSvcId, (slots, closedReason) => {
      setNewSlots(slots);
      setNewSlotsMsg(closedReason);
      if (slots[0]) setNewTime(slots[0].startTime);
    });
  };

  const submitCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSaving(true);
    setCreateErr(null);
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId: newServiceId,
          appointmentDate: newDate,
          startTime: newTime,
          fullName: newName,
          phone: newPhone,
          email: newEmail,
          notes: newNotes,
          status: newStatus,
        }),
      });
      const json = (await res.json()) as { referenceCode?: string; error?: string };
      if (!res.ok) {
        setCreateErr(json.error || 'Unable to create booking.');
        return;
      }
      setCreateOpen(false);
      setActionBanner(`Created appointment ${json.referenceCode || ''}.`);
      await loadData();
    } finally {
      setCreateSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = [
      'Reference',
      'Patient Name',
      'Phone',
      'Email',
      'Service',
      'Date',
      'Start Time',
      'End Time',
      'Status',
      'Patient Notes',
      'Admin Notes',
      'Supabase Synced',
    ];
    const escapeCell = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = appointments.map((a) =>
      [
        a.reference_code,
        a.patient_name,
        a.patient_phone,
        a.patient_email,
        a.service_name,
        a.appointment_date,
        formatTime12(a.start_time),
        formatTime12(a.end_time),
        a.status,
        a.notes,
        a.admin_notes,
        a.supabase_synced === 1 ? 'Yes' : 'No',
      ]
        .map(escapeCell)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grace-physio-bookings-${getISTToday()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const editTimeOptions = (() => {
    const list = [...editSlots];
    if (editTime && !list.some((s) => s.startTime === editTime)) {
      list.unshift({
        startTime: editTime,
        endTime: editTarget?.end_time || editTime,
        label: `${formatTime12(editTime)} (Current)`,
        endLabel: formatTime12(editTarget?.end_time || editTime),
        session: Number(editTime.split(':')[0]) < 15 ? 'morning' : 'evening',
        remainingCapacity: 1,
      });
    }
    return list;
  })();

  return (
    <div className="space-y-6">
      {/* KPI Metrics Row */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Bookings', value: overview.total, filter: '' },
            { label: `Today (${overview.todayDateIST})`, value: overview.today, filter: 'today' },
            { label: 'Pending Review', value: overview.pending, filter: 'pending' },
            { label: 'Completed', value: overview.completed, filter: 'completed' },
            { label: 'Cancelled', value: overview.cancelled, filter: 'cancelled' },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => {
                if (kpi.filter === 'today') {
                  setFilterDate(overview.todayDateIST);
                  setFilterStatus('');
                } else {
                  setFilterDate('');
                  setFilterStatus(kpi.filter);
                }
              }}
              className="text-left rounded-xl bg-white border border-[#252B29]/10 px-4 py-4 hover:border-[#174D3B]/40 transition-colors cursor-pointer"
            >
              <p className="text-xs text-[#252B29]/60 truncate">{kpi.label}</p>
              <p className="mt-1.5 font-display text-2xl font-bold text-[#174D3B] tabular-nums">
                {kpi.value}
              </p>
            </button>
          ))}
        </div>
      )}

      {actionBanner && (
        <div className="flex items-center justify-between rounded-xl border border-[#174D3B]/20 bg-[#EBF2EC] px-4 py-2.5 text-xs font-medium text-[#174D3B]">
          <span>{actionBanner}</span>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="p-0.5 hover:opacity-70 cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search, Filter & Action Toolbar */}
      <div className="rounded-xl bg-white border border-[#252B29]/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              className="w-4 h-4 text-[#252B29]/45 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient name, phone, or GPC reference..."
              className="w-full rounded-lg border border-[#252B29]/15 bg-[#FAFAF6] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#252B29]/15 bg-white px-3 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={appointments.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#252B29]/15 bg-white px-3 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#174D3B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10382B] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Booking
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <input
            type="date"
            aria-label="Filter by appointment date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-lg border border-[#252B29]/15 bg-[#FAFAF6] px-3 py-1.5 text-xs"
          />

          <select
            aria-label="Filter by service"
            value={filterServiceId}
            onChange={(e) => setFilterServiceId(e.target.value)}
            className="rounded-lg border border-[#252B29]/15 bg-[#FAFAF6] px-3 py-1.5 text-xs max-w-[210px]"
          >
            <option value="">All Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-[#252B29]/15 bg-[#FAFAF6] px-3 py-1.5 text-xs"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {(search || filterDate || filterServiceId || filterStatus) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterDate('');
                setFilterServiceId('');
                setFilterStatus('');
              }}
              className="text-xs font-semibold text-[#174D3B] hover:underline px-2 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Appointments Table */}
      <div className="rounded-xl bg-white border border-[#252B29]/10 overflow-hidden">
        {error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#F3F3EC] rounded animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-[#252B29]">
              No appointments match the current filters.
            </p>
            <p className="text-xs text-[#252B29]/60">
              Patient bookings submitted online or created via “New Booking” will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#252B29]/10 bg-[#FAFAF6] text-xs font-semibold text-[#252B29]/65">
                  <th className="py-3 px-4 whitespace-nowrap">Reference</th>
                  <th className="py-3 px-4 whitespace-nowrap">Patient</th>
                  <th className="py-3 px-4 whitespace-nowrap">Service</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date & Time (IST)</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#252B29]/8">
                {appointments.map((appt) => {
                  const badge = STATUS_BADGE[appt.status] || STATUS_BADGE.pending;
                  return (
                    <tr key={appt.id} className="hover:bg-[#FAFAF6]/80">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#174D3B] whitespace-nowrap tabular-nums">
                        <button
                          type="button"
                          onClick={() => void openViewDetails(appt)}
                          className="hover:underline text-left cursor-pointer"
                        >
                          {appt.reference_code}
                        </button>
                        {typeof appt.supabase_synced === 'number' && (
                          <p
                            title={appt.supabase_sync_error || 'Synced to Supabase'}
                            className={`mt-0.5 font-sans text-[11px] font-medium ${
                              appt.supabase_synced === 1 ? 'text-[#174D3B]/75' : 'text-amber-700'
                            }`}
                          >
                            {appt.supabase_synced === 1 ? 'Supabase Synced' : 'Pending Sync'}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-[#252B29]">{appt.patient_name}</p>
                        <p className="text-xs text-[#252B29]/65 tabular-nums">
                          {appt.patient_phone}
                          {appt.patient_email ? ` · ${appt.patient_email}` : ''}
                        </p>
                        {appt.notes && (
                          <p className="text-xs text-[#252B29]/60 mt-1 max-w-xs truncate">
                            Patient: {appt.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#252B29]/85">{appt.service_name}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                        <p className="font-medium text-[#252B29]">{appt.appointment_date}</p>
                        <p className="text-xs text-[#252B29]/65">
                          {formatTime12(appt.start_time)} – {formatTime12(appt.end_time)}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {appt.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void updateStatus(appt.id, 'confirmed')}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#174D3B] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#10382B] cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Confirm
                            </button>
                          )}
                          <button
                            type="button"
                            title="View full booking details & history"
                            onClick={() => void openViewDetails(appt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#252B29]/15 bg-white px-2.5 py-1.5 text-xs font-medium text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            type="button"
                            title="Edit patient, service, date, time, or notes"
                            onClick={() => openEditModal(appt)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#252B29]/15 bg-white px-2.5 py-1.5 text-xs font-medium text-[#174D3B] hover:bg-[#EBF2EC] cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTarget(appt);
                                setCancelReason('');
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Booking Details & Audit History Modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#252B29]/10 max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold text-[#174D3B]">
                  {viewTarget.reference_code}
                </p>
                <h3 className="font-display text-xl font-bold text-[#252B29] mt-0.5">
                  {viewTarget.patient_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewTarget(null)}
                className="p-1 text-[#252B29]/60 hover:text-[#252B29] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[#FAFAF6] border border-[#252B29]/10 p-4 text-xs">
              <div>
                <p className="text-[#252B29]/55">Physiotherapy Service</p>
                <p className="font-semibold text-[#252B29] mt-0.5">{viewTarget.service_name}</p>
              </div>
              <div>
                <p className="text-[#252B29]/55">Date & Time (IST)</p>
                <p className="font-semibold text-[#252B29] mt-0.5 tabular-nums">
                  {viewTarget.appointment_date} · {formatTime12(viewTarget.start_time)} –{' '}
                  {formatTime12(viewTarget.end_time)}
                </p>
              </div>
              <div>
                <p className="text-[#252B29]/55">Mobile & Contact</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${viewTarget.patient_phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1 font-semibold text-[#174D3B] hover:underline tabular-nums"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {viewTarget.patient_phone}
                  </a>
                  <a
                    href={`https://wa.me/${viewTarget.patient_phone.replace(/\D/g, '').replace(/^0+/, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(
                      `Hello ${viewTarget.patient_name}, this is Grace Physiotherapy Clinic regarding your appointment ${viewTarget.reference_code} on ${viewTarget.appointment_date} at ${formatTime12(viewTarget.start_time)}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-[#EBF2EC] px-2 py-0.5 font-semibold text-[#174D3B] hover:bg-[#DCE9DE]"
                  >
                    <MessageCircle className="w-3 h-3" />
                    WhatsApp
                  </a>
                </div>
              </div>
              <div>
                <p className="text-[#252B29]/55">Email & Status</p>
                <p className="font-medium text-[#252B29] mt-0.5">
                  {viewTarget.patient_email || 'No email provided'}
                </p>
                <span
                  className={`inline-block mt-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    (STATUS_BADGE[viewTarget.status] || STATUS_BADGE.pending).cls
                  }`}
                >
                  {(STATUS_BADGE[viewTarget.status] || STATUS_BADGE.pending).label}
                </span>
              </div>
            </div>

            {(viewTarget.notes || viewTarget.admin_notes) && (
              <div className="space-y-2 text-xs">
                {viewTarget.notes && (
                  <div className="rounded-xl border border-[#252B29]/10 p-3">
                    <p className="font-semibold text-[#252B29]/65">Patient Notes</p>
                    <p className="mt-1 text-[#252B29]">{viewTarget.notes}</p>
                  </div>
                )}
                {viewTarget.admin_notes && (
                  <div className="rounded-xl border border-[#174D3B]/15 bg-[#EBF2EC]/45 p-3">
                    <p className="font-semibold text-[#174D3B]">Clinic Admin Notes</p>
                    <p className="mt-1 text-[#252B29]">{viewTarget.admin_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => openEditModal(viewTarget)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#174D3B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#10382B] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Booking
              </button>
              {viewTarget.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => void updateStatus(viewTarget.id, 'confirmed')}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#174D3B]/25 bg-[#EBF2EC] px-3 py-2 text-xs font-semibold text-[#174D3B] cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Confirm
                </button>
              )}
              {(viewTarget.status === 'pending' || viewTarget.status === 'confirmed') && (
                <button
                  type="button"
                  onClick={() => void updateStatus(viewTarget.id, 'completed')}
                  className="rounded-lg border border-[#252B29]/15 bg-white px-3 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
                >
                  Mark Completed
                </button>
              )}
              {viewTarget.status !== 'cancelled' && viewTarget.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => {
                    setCancelTarget(viewTarget);
                    setCancelReason('');
                  }}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
                >
                  Cancel Appointment
                </button>
              )}
            </div>

            {/* History Timeline */}
            <div className="border-t border-[#252B29]/10 pt-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-[#252B29]/65 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#174D3B]" />
                Booking Activity Log
              </h4>
              {historyLoading ? (
                <div className="h-10 bg-[#F3F3EC] rounded animate-pulse" />
              ) : historyRows.length === 0 ? (
                <p className="text-xs text-[#252B29]/60">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2.5 max-h-48 overflow-y-auto divide-y divide-[#252B29]/8">
                  {historyRows.map((h) => (
                    <div key={h.id} className="pt-2.5 first:pt-0 text-xs">
                      <div className="flex items-center justify-between text-[#252B29]/55 tabular-nums">
                        <span className="font-semibold text-[#174D3B] uppercase">{h.action}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {h.created_at}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[#252B29]/85">{h.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Appointment Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={submitEditModal}
            className="bg-white rounded-2xl border border-[#252B29]/10 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-semibold text-[#174D3B]">
                  {editTarget.reference_code}
                </p>
                <h3 className="font-display text-lg font-bold text-[#252B29]">
                  Edit Appointment Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-1 text-[#252B29]/60 hover:text-[#252B29] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Patient Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Appointment Status *</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AppointmentStatus)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Physiotherapy Service *</label>
              <select
                value={editServiceId}
                onChange={(e) => {
                  const svcId = Number(e.target.value);
                  setEditServiceId(svcId);
                  void loadAvailability(editDate, svcId, (slots) => setEditSlots(slots));
                }}
                className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} mins)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Date *</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#174D3B] shrink-0" />
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditDate(val);
                      void loadAvailability(val, editServiceId, (slots) => setEditSlots(slots));
                    }}
                    className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Time Slot (IST) *</label>
                <select
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm tabular-nums"
                >
                  {editTimeOptions.map((slot) => (
                    <option key={slot.startTime} value={slot.startTime}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Patient Notes</label>
              <textarea
                rows={2}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Internal Clinic Admin Notes</label>
              <textarea
                rows={2}
                value={editAdminNotes}
                onChange={(e) => setEditAdminNotes(e.target.value)}
                placeholder="Notes visible only to clinic staff..."
                className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
              />
            </div>

            {editErr && <p className="text-xs text-red-700 font-medium">{editErr}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-[#252B29]/15 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-lg bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] disabled:opacity-50 cursor-pointer"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cancel Appointment Confirmation Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#252B29]/10 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#252B29]">
                Cancel Appointment?
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="p-1 text-[#252B29]/60 hover:text-[#252B29] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-[#252B29]/75 leading-relaxed">
              Are you sure you want to cancel{' '}
              <strong className="font-mono text-[#174D3B]">{cancelTarget.reference_code}</strong> for{' '}
              <strong>{cancelTarget.patient_name}</strong> ({cancelTarget.appointment_date} at{' '}
              {formatTime12(cancelTarget.start_time)})? This will free up the slot for other patients.
            </p>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Cancellation Reason (optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Patient requested cancellation by phone"
                className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-[#252B29]/15 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={cancelSaving}
                onClick={() => void submitCancel()}
                className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50 cursor-pointer"
              >
                {cancelSaving ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Walk-in Booking Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={submitCreateBooking}
            className="bg-white rounded-2xl border border-[#252B29]/10 max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#252B29]">
                Add Walk-In or Phone Booking
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1 text-[#252B29]/60 hover:text-[#252B29] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="95913 71199"
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Initial Status *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as 'pending' | 'confirmed')}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Physiotherapy Service *</label>
              <select
                value={newServiceId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setNewServiceId(id);
                  setNewTime('');
                  void loadAvailability(newDate, id, (slots, closedReason) => {
                    setNewSlots(slots);
                    setNewSlotsMsg(closedReason);
                    if (slots[0]) setNewTime(slots[0].startTime);
                  });
                }}
                className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes} mins)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Date *</label>
                <input
                  type="date"
                  required
                  min={getISTToday()}
                  value={newDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewDate(val);
                    setNewTime('');
                    void loadAvailability(val, newServiceId, (slots, closedReason) => {
                      setNewSlots(slots);
                      setNewSlotsMsg(closedReason);
                      if (slots[0]) setNewTime(slots[0].startTime);
                    });
                  }}
                  className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Available Slot *</label>
                {newSlots.length === 0 ? (
                  <p className="text-xs text-amber-800 py-2">
                    {newSlotsMsg || 'No open slots on this date.'}
                  </p>
                ) : (
                  <select
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm tabular-nums"
                  >
                    {newSlots.map((slot) => (
                      <option key={slot.startTime} value={slot.startTime}>
                        {slot.label} ({slot.session})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Notes / Concern</label>
              <textarea
                rows={2}
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full rounded-lg border border-[#252B29]/20 bg-[#FAFAF6] px-3 py-2 text-sm"
              />
            </div>

            {createErr && <p className="text-xs text-red-700 font-medium">{createErr}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-lg border border-[#252B29]/15 px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createSaving || !newTime}
                className="rounded-lg bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] disabled:opacity-50 cursor-pointer"
              >
                {createSaving ? 'Creating...' : 'Create Appointment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
