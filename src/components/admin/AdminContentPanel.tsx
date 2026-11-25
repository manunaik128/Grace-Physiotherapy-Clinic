import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import type {
  AdminProfile,
  ClinicSettings,
  ContactInquiry,
  GalleryImage,
  TeamMember,
  Testimonial,
} from '../../types/clinic';

export function AdminContentPanel({
  token,
  currentAdmin,
  initialSettings,
  onChanged,
}: {
  token: string;
  currentAdmin: AdminProfile | null;
  initialSettings: ClinicSettings | undefined;
  onChanged: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<
    'clinic' | 'testimonials' | 'gallery' | 'team' | 'inquiries' | 'staff'
  >('clinic');

  const [settingsForm, setSettingsForm] = useState<Partial<ClinicSettings>>(initialSettings || {});
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [staff, setStaff] = useState<AdminProfile[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Add forms
  const [newTesti, setNewTesti] = useState({
    patient_name: '',
    condition_tag: '',
    quote: '',
    visit_context: '',
  });
  const [newImg, setNewImg] = useState({
    title: '',
    caption: '',
    category: 'Clinic Spaces',
    image_url: '',
    is_illustrative: false,
  });
  const [newMember, setNewMember] = useState({
    name: '',
    role_title: '',
    bio: '',
    focus_areas: '',
    photo_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
  });
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'super_admin' | 'staff',
  });

  useEffect(() => {
    if (initialSettings) setSettingsForm(initialSettings);
  }, [initialSettings]);

  const loadAll = useCallback(async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [tRes, gRes, tmRes, iRes, sRes] = await Promise.all([
      fetch('/api/admin/testimonials', { headers }),
      fetch('/api/admin/gallery', { headers }),
      fetch('/api/admin/team', { headers }),
      fetch('/api/admin/inquiries', { headers }),
      fetch('/api/admin/staff', { headers }),
    ]);
    if (tRes.ok) setTestimonials(await tRes.json());
    if (gRes.ok) setGallery(await gRes.json());
    if (tmRes.ok) setTeam(await tmRes.json());
    if (iRes.ok) setInquiries(await iRes.json());
    if (sRes.ok) setStaff(await sRes.json());
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settingsForm),
    });
    if (res.ok) {
      setMsg('Clinic settings & website copy updated.');
      await onChanged();
    }
  };

  const addTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/testimonials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newTesti),
    });
    if (res.ok) {
      setNewTesti({ patient_name: '', condition_tag: '', quote: '', visit_context: '' });
      await loadAll();
      await onChanged();
    }
  };

  const toggleTestimonial = async (t: Testimonial) => {
    await fetch(`/api/admin/testimonials/${t.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...t, is_published: t.is_published ? 0 : 1 }),
    });
    await loadAll();
    await onChanged();
  };

  const deleteTestimonial = async (id: number) => {
    await fetch(`/api/admin/testimonials/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
    await onChanged();
  };

  const addGalleryImg = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newImg),
    });
    if (res.ok) {
      setNewImg({
        title: '',
        caption: '',
        category: 'Clinic Spaces',
        image_url: '',
        is_illustrative: false,
      });
      await loadAll();
      await onChanged();
    }
  };

  const deleteGalleryImg = async (id: number) => {
    await fetch(`/api/admin/gallery/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
    await onChanged();
  };

  const addTeamMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/team', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newMember),
    });
    if (res.ok) {
      setNewMember({
        name: '',
        role_title: '',
        bio: '',
        focus_areas: '',
        photo_url: '/src/assets/images/service_spine_manual_1795584347255.jpg',
      });
      await loadAll();
      await onChanged();
    }
  };

  const deleteTeamMember = async (id: number) => {
    await fetch(`/api/admin/team/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
    await onChanged();
  };

  const addStaffAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(newStaff),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error || 'Could not add staff admin.');
      return;
    }
    setNewStaff({ name: '', email: '', password: '', role: 'staff' });
    setMsg('Staff account created.');
    await loadAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white border border-[#252B29]/10 w-fit">
        {[
          { id: 'clinic', label: 'Clinic Info & Copy' },
          { id: 'testimonials', label: 'Testimonials' },
          { id: 'gallery', label: 'Gallery Photos' },
          { id: 'team', label: 'Team Profiles' },
          { id: 'inquiries', label: `Inquiries (${inquiries.length})` },
          { id: 'staff', label: 'Admin Access' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#174D3B] text-white'
                : 'text-[#252B29]/75 hover:bg-[#F3F3EC]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className="rounded-xl bg-[#EBF2EC] border border-[#174D3B]/20 px-4 py-3 text-sm text-[#174D3B]">
          {msg}
        </div>
      )}

      {/* Clinic Info & Copy */}
      {subTab === 'clinic' && (
        <form
          onSubmit={saveSettings}
          className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-[#252B29]">
            Clinic Details, Location & Website Content
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Business Name</label>
              <input
                type="text"
                value={settingsForm.business_name || ''}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, business_name: e.target.value })
                }
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={settingsForm.phone || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                WhatsApp Number (digits with country code)
              </label>
              <input
                type="text"
                value={settingsForm.whatsapp_number || ''}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })
                }
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Clinic Email</label>
              <input
                type="email"
                value={settingsForm.email || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Clinic Address</label>
              <input
                type="text"
                value={settingsForm.address || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Tagline</label>
              <input
                type="text"
                value={settingsForm.tagline || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">About Clinic Overview</label>
              <textarea
                rows={3}
                value={settingsForm.about_overview || ''}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, about_overview: e.target.value })
                }
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Mission</label>
              <textarea
                rows={3}
                value={settingsForm.mission || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, mission: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Vision</label>
              <textarea
                rows={3}
                value={settingsForm.vision || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, vision: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Treatment Philosophy</label>
              <textarea
                rows={3}
                value={settingsForm.philosophy || ''}
                onChange={(e) => setSettingsForm({ ...settingsForm, philosophy: e.target.value })}
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Map Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={settingsForm.latitude ?? 12.9012}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, latitude: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Map Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={settingsForm.longitude ?? 77.5892}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, longitude: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-5 py-2.5 text-xs font-semibold text-white cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Clinic Content
          </button>
        </form>
      )}

      {/* Testimonials */}
      {subTab === 'testimonials' && (
        <div className="space-y-6">
          <form
            onSubmit={addTestimonial}
            className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-[#252B29]">
              Add Verified Patient Testimonial
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Patient name"
                value={newTesti.patient_name}
                onChange={(e) => setNewTesti({ ...newTesti, patient_name: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Condition / Program"
                value={newTesti.condition_tag}
                onChange={(e) => setNewTesti({ ...newTesti, condition_tag: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Visit context (e.g. JP Nagar Resident)"
                value={newTesti.visit_context}
                onChange={(e) => setNewTesti({ ...newTesti, visit_context: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                required
                placeholder="Patient quote..."
                value={newTesti.quote}
                onChange={(e) => setNewTesti({ ...newTesti, quote: e.target.value })}
                className="sm:col-span-3 rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Publish Testimonial
            </button>
          </form>

          <div className="rounded-2xl bg-white border border-[#252B29]/10 divide-y divide-[#252B29]/8">
            {testimonials.map((t) => (
              <div key={t.id} className="p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm text-[#252B29]">
                    {t.patient_name} ·{' '}
                    <span className="font-normal text-[#252B29]/65">{t.condition_tag}</span>
                  </p>
                  <p className="mt-1 text-sm text-[#252B29]/80">“{t.quote}”</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleTestimonial(t)}
                    className="rounded-lg border border-[#252B29]/15 px-3 py-1 text-xs font-medium cursor-pointer"
                  >
                    {t.is_published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteTestimonial(t.id)}
                    className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery */}
      {subTab === 'gallery' && (
        <div className="space-y-6">
          <form
            onSubmit={addGalleryImg}
            className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-[#252B29]">
              Add Clinic Photograph
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Photo title"
                value={newImg.title}
                onChange={(e) => setNewImg({ ...newImg, title: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Category (e.g. Treatment Rooms)"
                value={newImg.category}
                onChange={(e) => setNewImg({ ...newImg, category: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Image URL or /src/assets/images/..."
                value={newImg.image_url}
                onChange={(e) => setNewImg({ ...newImg, image_url: e.target.value })}
                className="sm:col-span-2 rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Short caption"
                value={newImg.caption}
                onChange={(e) => setNewImg({ ...newImg, caption: e.target.value })}
                className="sm:col-span-2 rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-xs text-[#252B29]/75">
                <input
                  type="checkbox"
                  checked={newImg.is_illustrative}
                  onChange={(e) => setNewImg({ ...newImg, is_illustrative: e.target.checked })}
                />
                Mark as illustrative stock image
              </label>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Photo
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gallery.map((g) => (
              <div
                key={g.id}
                className="rounded-xl bg-white border border-[#252B29]/10 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <img
                    src={g.image_url}
                    alt={g.title}
                    className="w-full h-36 object-cover rounded-lg bg-[#EBF2EC]"
                  />
                  <p className="mt-2 font-semibold text-sm text-[#252B29]">{g.title}</p>
                  <p className="text-xs text-[#252B29]/65">{g.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteGalleryImg(g.id)}
                  className="self-start text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                >
                  Remove Photo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Profiles */}
      {subTab === 'team' && (
        <div className="space-y-6">
          <form
            onSubmit={addTeamMember}
            className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-4"
          >
            <h2 className="font-display text-base font-bold text-[#252B29]">Add Team Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Practitioner full name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                required
                placeholder="Role & verified credentials"
                value={newMember.role_title}
                onChange={(e) => setNewMember({ ...newMember, role_title: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Focus areas (e.g. Spine · Knee Rehab)"
                value={newMember.focus_areas}
                onChange={(e) => setNewMember({ ...newMember, focus_areas: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Photo URL"
                value={newMember.photo_url}
                onChange={(e) => setNewMember({ ...newMember, photo_url: e.target.value })}
                className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                placeholder="Short bio..."
                value={newMember.bio}
                onChange={(e) => setNewMember({ ...newMember, bio: e.target.value })}
                className="sm:col-span-2 rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Team Member
            </button>
          </form>

          <div className="rounded-2xl bg-white border border-[#252B29]/10 divide-y divide-[#252B29]/8">
            {team.map((m) => (
              <div key={m.id} className="p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm text-[#252B29]">{m.name}</p>
                  <p className="text-xs text-[#174D3B]">{m.role_title}</p>
                  <p className="mt-1 text-xs text-[#252B29]/75">{m.bio}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteTeamMember(m.id)}
                  className="text-xs font-semibold text-red-700 hover:underline shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inquiries */}
      {subTab === 'inquiries' && (
        <div className="rounded-2xl bg-white border border-[#252B29]/10 divide-y divide-[#252B29]/8">
          {inquiries.length === 0 ? (
            <p className="p-8 text-sm text-center text-[#252B29]/60">
              No contact form enquiries submitted yet.
            </p>
          ) : (
            inquiries.map((inq) => (
              <div key={inq.id} className="p-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm text-[#252B29]">
                    {inq.full_name} · <span className="tabular-nums">{inq.phone}</span>
                  </p>
                  <p className="text-xs text-[#174D3B] mt-0.5">
                    {inq.subject} · {inq.created_at}
                  </p>
                  <p className="mt-2 text-sm text-[#252B29]/80">{inq.message}</p>
                </div>
                <select
                  value={inq.status}
                  onChange={async (e) => {
                    await fetch(`/api/admin/inquiries/${inq.id}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ status: e.target.value }),
                    });
                    await loadAll();
                  }}
                  className="rounded-lg border border-[#252B29]/20 px-2.5 py-1.5 text-xs"
                >
                  <option value="new">New</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            ))
          )}
        </div>
      )}

      {/* Staff RBAC */}
      {subTab === 'staff' && (
        <div className="space-y-6">
          {currentAdmin?.role === 'super_admin' && (
            <form
              onSubmit={addStaffAdmin}
              className="rounded-2xl bg-white border border-[#252B29]/10 p-6 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-[#252B29]">
                Add Clinic Staff Account
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
                />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Password (8+ chars)"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
                />
                <select
                  value={newStaff.role}
                  onChange={(e) =>
                    setNewStaff({
                      ...newStaff,
                      role: e.target.value as 'super_admin' | 'staff',
                    })
                  }
                  className="rounded-lg border border-[#252B29]/20 px-3 py-2 text-sm"
                >
                  <option value="staff">Staff</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Staff Login
              </button>
            </form>
          )}

          <div className="rounded-2xl bg-white border border-[#252B29]/10 divide-y divide-[#252B29]/8">
            {staff.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-[#252B29]">{s.name}</p>
                  <p className="text-xs text-[#252B29]/65">{s.email}</p>
                </div>
                <span className="text-xs font-semibold text-[#174D3B] uppercase">{s.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
