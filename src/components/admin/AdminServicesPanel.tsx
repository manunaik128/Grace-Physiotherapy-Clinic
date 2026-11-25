import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Service } from '../../types/clinic';

const EMPTY_FORM = {
  name: '',
  category: 'Spine & Posture',
  short_description: '',
  description: '',
  benefitsText: '',
  suitableForText: '',
  duration_minutes: 35,
  image_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
  icon_name: 'Activity',
  is_active: 1,
  sort_order: 12,
};

export function AdminServicesPanel({
  token,
  onChanged,
}: {
  token: string;
  onChanged: () => Promise<void>;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    const res = await fetch('/api/admin/services', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setServices((await res.json()) as Service[]);
    }
  }, [token]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const startNew = () => {
    setForm(EMPTY_FORM);
    setEditingId('new');
    setMsg(null);
  };

  const startEdit = (svc: Service) => {
    setForm({
      name: svc.name,
      category: svc.category,
      short_description: svc.short_description,
      description: svc.description,
      benefitsText: svc.benefits.join('\n'),
      suitableForText: svc.suitable_for.join('\n'),
      duration_minutes: svc.duration_minutes,
      image_url: svc.image_url,
      icon_name: svc.icon_name,
      is_active: svc.is_active,
      sort_order: svc.sort_order,
    });
    setEditingId(svc.id);
    setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const payload = {
      name: form.name,
      category: form.category,
      short_description: form.short_description,
      description: form.description,
      benefits: form.benefitsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      suitable_for: form.suitableForText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      duration_minutes: Number(form.duration_minutes),
      image_url: form.image_url,
      icon_name: form.icon_name,
      is_active: form.is_active,
      sort_order: Number(form.sort_order),
    };

    const url =
      editingId === 'new' ? '/api/admin/services' : `/api/admin/services/${editingId}`;
    const method = editingId === 'new' ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      setMsg(err.error || 'Failed to save service.');
      return;
    }

    setEditingId(null);
    await loadServices();
    await onChanged();
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const json = await res.json();
      if (json.message) setMsg(json.message);
      await loadServices();
      await onChanged();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#252B29]">
            Physiotherapy Services ({services.length})
          </h2>
          <p className="text-xs text-[#252B29]/65">
            Add, edit, set session durations, or toggle service availability for online booking.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      {msg && (
        <div className="rounded-xl bg-[#EBF2EC] border border-[#174D3B]/20 px-4 py-2.5 text-xs text-[#174D3B]">
          {msg}
        </div>
      )}

      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-white border border-[#174D3B]/25 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[#252B29]">
              {editingId === 'new' ? 'New Physiotherapy Service' : 'Edit Service'}
            </h3>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="p-1 text-[#252B29]/60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Service Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Category *</label>
              <input
                type="text"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Duration (minutes) *</label>
              <input
                type="number"
                min={15}
                max={180}
                required
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Image Path / URL *</label>
              <input
                type="text"
                required
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Booking Availability</label>
              <select
                value={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              >
                <option value={1}>Active (Bookable Online)</option>
                <option value={0}>Hidden / Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold mb-1">Short Summary *</label>
              <input
                type="text"
                required
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold mb-1">Full Description</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3 md:col-span-1">
              <label className="block text-xs font-semibold mb-1">
                Benefits (one per line)
              </label>
              <textarea
                rows={3}
                value={form.benefitsText}
                onChange={(e) => setForm({ ...form, benefitsText: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-xs"
              />
            </div>
            <div className="sm:col-span-3 md:col-span-2">
              <label className="block text-xs font-semibold mb-1">
                Suitable Concerns (one per line)
              </label>
              <textarea
                rows={3}
                value={form.suitableForText}
                onChange={(e) => setForm({ ...form, suitableForText: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-[#252B29]/15 px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#174D3B] px-5 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Service'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-white border border-[#252B29]/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#252B29]/10 bg-[#FAFAF6] text-xs font-semibold text-[#252B29]/65">
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#252B29]/8">
              {services.map((svc) => (
                <tr key={svc.id}>
                  <td className="py-3 px-4 font-semibold text-[#252B29]">{svc.name}</td>
                  <td className="py-3 px-4 text-[#252B29]/70">{svc.category}</td>
                  <td className="py-3 px-4 tabular-nums">{svc.duration_minutes} min</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-semibold ${
                        svc.is_active ? 'text-[#174D3B]' : 'text-[#252B29]/50'
                      }`}
                    >
                      {svc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => startEdit(svc)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#252B29]/15 px-2.5 py-1 text-xs font-medium hover:bg-[#EBF2EC] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(svc.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
