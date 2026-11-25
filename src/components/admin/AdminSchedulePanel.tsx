import React, { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Plus, Save, Trash2 } from 'lucide-react';
import type { BlockedDate, WorkingHour } from '../../types/clinic';

export function AdminSchedulePanel({
  token,
  onChanged,
}: {
  token: string;
  onChanged: () => Promise<void>;
}) {
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [maxConcurrent, setMaxConcurrent] = useState(1);
  const [hoursNote, setHoursNote] = useState('');

  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [newBlockType, setNewBlockType] = useState<'holiday' | 'closure'>('holiday');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    const res = await fetch('/api/admin/schedule', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      setWorkingHours(json.workingHours || []);
      setBlockedDates(json.blockedDates || []);
      if (json.settings) {
        setBufferMinutes(Number(json.settings.slot_buffer_minutes ?? 10));
        setMaxConcurrent(Number(json.settings.max_concurrent_per_slot ?? 1));
        setHoursNote(json.settings.hours_confirmation_note || '');
      }
    }
  }, [token]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const updateDay = (idx: number, patch: Partial<WorkingHour>) => {
    setWorkingHours((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const saveWorkingHours = async () => {
    setStatusMsg(null);
    const res = await fetch('/api/admin/schedule/working-hours', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workingHours }),
    });
    if (res.ok) {
      setStatusMsg('Working hours updated.');
      await onChanged();
    } else {
      const err = await res.json();
      setStatusMsg(err.error || 'Could not update working hours.');
    }
  };

  const saveCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    const res = await fetch('/api/admin/schedule/capacity', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        slot_buffer_minutes: bufferMinutes,
        max_concurrent_per_slot: maxConcurrent,
        hours_confirmation_note: hoursNote,
      }),
    });
    if (res.ok) {
      setStatusMsg('Buffer time and slot capacity saved.');
      await onChanged();
    }
  };

  const addBlockedDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlockDate) return;
    const res = await fetch('/api/admin/schedule/blocked-dates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        blocked_date: newBlockDate,
        reason: newBlockReason || 'Clinic Holiday',
        block_type: newBlockType,
      }),
    });
    if (res.ok) {
      setNewBlockDate('');
      setNewBlockReason('');
      setStatusMsg('Date blocked for bookings.');
      await loadSchedule();
      await onChanged();
    }
  };

  const removeBlockedDate = async (id: number) => {
    const res = await fetch(`/api/admin/schedule/blocked-dates/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await loadSchedule();
      await onChanged();
    }
  };

  return (
    <div className="space-y-8">
      {statusMsg && (
        <div className="rounded-xl bg-[#EBF2EC] border border-[#174D3B]/20 px-4 py-3 text-sm text-[#174D3B]">
          {statusMsg}
        </div>
      )}

      {/* Working Days & Morning/Evening Hours */}
      <section className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#252B29]">
              Weekly Working Days & Sessions (IST)
            </h2>
            <p className="text-xs text-[#252B29]/65">
              Configure open days and morning / evening session windows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void saveWorkingHours()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Working Hours
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#252B29]/10 text-xs text-[#252B29]/65">
                <th className="py-2.5 pr-4">Day</th>
                <th className="py-2.5 px-3">Open</th>
                <th className="py-2.5 px-3">Morning Start</th>
                <th className="py-2.5 px-3">Morning End</th>
                <th className="py-2.5 px-3">Evening Start</th>
                <th className="py-2.5 px-3">Evening End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252B29]/8">
              {workingHours.map((d, idx) => (
                <tr key={d.day_of_week}>
                  <td className="py-3 pr-4 font-semibold text-[#252B29]">{d.day_name}</td>
                  <td className="py-3 px-3">
                    <input
                      type="checkbox"
                      checked={Boolean(d.is_open)}
                      onChange={(e) => updateDay(idx, { is_open: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 accent-[#174D3B]"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="time"
                      disabled={!d.is_open}
                      value={d.morning_start}
                      onChange={(e) => updateDay(idx, { morning_start: e.target.value })}
                      className="rounded-lg border border-[#252B29]/20 px-2.5 py-1.5 text-xs tabular-nums disabled:opacity-40"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="time"
                      disabled={!d.is_open}
                      value={d.morning_end}
                      onChange={(e) => updateDay(idx, { morning_end: e.target.value })}
                      className="rounded-lg border border-[#252B29]/20 px-2.5 py-1.5 text-xs tabular-nums disabled:opacity-40"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="time"
                      disabled={!d.is_open}
                      value={d.evening_start}
                      onChange={(e) => updateDay(idx, { evening_start: e.target.value })}
                      className="rounded-lg border border-[#252B29]/20 px-2.5 py-1.5 text-xs tabular-nums disabled:opacity-40"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="time"
                      disabled={!d.is_open}
                      value={d.evening_end}
                      onChange={(e) => updateDay(idx, { evening_end: e.target.value })}
                      className="rounded-lg border border-[#252B29]/20 px-2.5 py-1.5 text-xs tabular-nums disabled:opacity-40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Buffer & Slot Capacity */}
      <form
        onSubmit={saveCapacity}
        className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-4"
      >
        <h2 className="font-display text-lg font-bold text-[#252B29]">
          Slot Buffer Time & Appointment Capacity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1">
              Buffer Between Appointments (minutes)
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">
              Concurrent Bookings Allowed Per Time Slot
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm tabular-nums"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1">
              Hours Verification Note
            </label>
            <input
              type="text"
              value={hoursNote}
              onChange={(e) => setHoursNote(e.target.value)}
              className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Save Slot Settings
        </button>
      </form>

      {/* Holidays & Blocked Dates */}
      <section className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-bold text-[#252B29]">
            Holidays & Exceptional Closures
          </h2>
          <p className="text-xs text-[#252B29]/65">
            Blocked dates are immediately disabled in the patient booking calendar.
          </p>
        </div>

        <form onSubmit={addBlockedDate} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Date *</label>
            <input
              type="date"
              required
              value={newBlockDate}
              onChange={(e) => setNewBlockDate(e.target.value)}
              className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Type</label>
            <select
              value={newBlockType}
              onChange={(e) => setNewBlockType(e.target.value as 'holiday' | 'closure')}
              className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
            >
              <option value="holiday">Public Holiday</option>
              <option value="closure">Clinic Closure</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Reason</label>
            <input
              type="text"
              placeholder="e.g. Karnataka Rajyotsava"
              value={newBlockReason}
              onChange={(e) => setNewBlockReason(e.target.value)}
              className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white h-[38px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Block Date
          </button>
        </form>

        {blockedDates.length === 0 ? (
          <p className="text-xs text-[#252B29]/60 flex items-center gap-2">
            <CalendarOff className="w-4 h-4" />
            No blocked dates currently configured.
          </p>
        ) : (
          <div className="divide-y divide-[#252B29]/8 border-t border-[#252B29]/10">
            {blockedDates.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <span className="font-semibold text-[#252B29] tabular-nums">
                    {b.blocked_date}
                  </span>
                  <span className="mx-2 text-[#252B29]/30">·</span>
                  <span className="text-[#252B29]/75">{b.reason}</span>
                  <span className="ml-2 text-xs text-[#252B29]/50 capitalize">
                    ({b.block_type})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void removeBlockedDate(b.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
