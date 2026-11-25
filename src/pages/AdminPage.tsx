import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Database, FileText, Lock, LogOut, Shield, Stethoscope } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { AdminAppointmentsPanel } from '../components/admin/AdminAppointmentsPanel';
import { AdminServicesPanel } from '../components/admin/AdminServicesPanel';
import { AdminSchedulePanel } from '../components/admin/AdminSchedulePanel';
import { AdminContentPanel } from '../components/admin/AdminContentPanel';
import { AdminSupabasePanel } from '../components/admin/AdminSupabasePanel';

type AdminTab = 'appointments' | 'services' | 'schedule' | 'content' | 'supabase';

export function AdminPage() {
  const { data, adminToken, adminUser, setAdminSession, clearAdminSession, refreshClinicData } =
    useClinic();

  const [authLoading, setAuthLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [envPasscodeMode, setEnvPasscodeMode] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('appointments');

  // Auth form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/admin/auth/status', {
          headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
        if (res.ok && active) {
          const json = await res.json();
          setSetupRequired(Boolean(json.setupRequired));
          setEnvPasscodeMode(Boolean(json.envPasscodeMode));
          if (adminToken && !json.authenticated) {
            clearAdminSession();
          }
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    };
    void checkStatus();
    return () => {
      active = false;
    };
  }, [adminToken, clearAdminSession]);

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Setup failed.');
      setAdminSession(json.token, json.admin);
      setSetupRequired(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to claim admin access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sign in failed.');
      setAdminSession(json.token, json.admin);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center text-sm text-[#252B29]/65">
        Verifying clinic administration session...
      </div>
    );
  }

  if (!adminToken) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 md:py-20">
        <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8 space-y-5">
          <div className="w-11 h-11 rounded-xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>

          <div>
            <p className="text-xs font-semibold text-[#174D3B]">
              Grace Physiotherapy Clinic · Admin Portal
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-[#252B29]">
              {setupRequired ? 'Claim Clinic Admin Access' : 'Administrator Sign In'}
            </h1>
            <p className="mt-1.5 text-sm text-[#252B29]/70">
              {setupRequired
                ? 'Set up the primary clinic administrator login. Once claimed, this setup locks automatically.'
                : envPasscodeMode
                ? 'Enter the configured clinic admin passcode to manage appointments and website content.'
                : 'Sign in with your authorized clinic administrator credentials.'}
            </p>
          </div>

          {setupRequired ? (
            <form onSubmit={handleBootstrap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Administrator Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Clinic Administrator"
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Admin Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gracephysiotherapy.in"
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Password (minimum 8 characters) *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm"
                />
              </div>
              {authError && <p className="text-xs text-red-700">{authError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#174D3B] py-3 text-sm font-semibold text-white hover:bg-[#10382B] cursor-pointer"
              >
                {submitting ? 'Creating Admin...' : 'Claim Super Admin Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {!envPasscodeMode && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@gracephysiotherapy.in"
                    className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  {envPasscodeMode ? 'Admin Passcode *' : 'Password *'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-3.5 py-2.5 text-sm"
                />
              </div>
              {authError && <p className="text-xs text-red-700">{authError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#174D3B] py-3 text-sm font-semibold text-white hover:bg-[#10382B] cursor-pointer"
              >
                {submitting ? 'Signing In...' : 'Sign In to Dashboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Admin Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#252B29]/10">
        <div>
          <p className="text-xs text-[#252B29]/60">
            Grace Physiotherapy Clinic / Operations Console
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#252B29]">
            Clinic Management Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs">
            <p className="font-semibold text-[#252B29]">{adminUser?.name}</p>
            <p className="text-[#174D3B] flex items-center justify-end gap-1">
              <Shield className="w-3 h-3" />
              {adminUser?.role === 'super_admin' ? 'Super Admin' : 'Clinic Staff'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearAdminSession}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#252B29]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Workspace Grid: Left Sidebar + Main Viewport */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-3 rounded-2xl bg-white border border-[#252B29]/10 p-2 space-y-1">
          {[
            { id: 'appointments', label: 'Appointments', icon: Calendar },
            { id: 'services', label: 'Services', icon: Stethoscope },
            { id: 'schedule', label: 'Schedule & Holidays', icon: Clock },
            { id: 'content', label: 'Clinic Content & Team', icon: FileText },
            { id: 'supabase', label: 'Supabase Sync', icon: Database },
          ].map((nav) => {
            const Icon = nav.icon;
            const active = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#174D3B] text-white'
                    : 'text-[#252B29]/80 hover:bg-[#F3F3EC]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{nav.label}</span>
              </button>
            );
          })}
        </aside>

        <div className="lg:col-span-9 min-w-0">
          {activeTab === 'appointments' && (
            <AdminAppointmentsPanel token={adminToken} services={data?.services || []} />
          )}
          {activeTab === 'services' && (
            <AdminServicesPanel token={adminToken} onChanged={refreshClinicData} />
          )}
          {activeTab === 'schedule' && (
            <AdminSchedulePanel token={adminToken} onChanged={refreshClinicData} />
          )}
          {activeTab === 'content' && (
            <AdminContentPanel
              token={adminToken}
              currentAdmin={adminUser}
              initialSettings={data?.settings}
              onChanged={refreshClinicData}
            />
          )}
          {activeTab === 'supabase' && <AdminSupabasePanel token={adminToken} />}
        </div>
      </div>
    </div>
  );
}
