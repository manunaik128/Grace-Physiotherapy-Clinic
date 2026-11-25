import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, CheckCircle2, Lock, Shield, User, UserPlus } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';

export function LoginPage() {
  const { patientToken, patientUser, setPatientSession, clearPatientSession, adminToken } =
    useClinic();
  const navigate = useNavigate();

  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');

  // Sign in state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePatientSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/patient/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Sign in failed.');
      setPatientSession(json.token, json.patient);
      navigate('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePatientRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/patient/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: regName,
          phone: regPhone,
          email: regEmail,
          password: regPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Registration failed.');
      setPatientSession(json.token, json.patient);
      navigate('/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
          Grace Physiotherapy Clinic · Account Access
        </p>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#252B29]">
          Sign in to your clinic portal
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#252B29]/72">
          Patients can sign in below to track appointment status and manage visits. Clinic
          administrators sign in on the dedicated Admin Login page.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* User / Patient Login Side */}
        <section className="lg:col-span-7 rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center shrink-0">
              <User className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-[#252B29]">
                Patient Login & Bookings
              </h2>
              <p className="text-xs sm:text-sm text-[#252B29]/68 mt-0.5">
                View your appointments, check whether a slot is waiting or confirmed, and reschedule
                anytime.
              </p>
            </div>
          </div>

          {patientToken && patientUser ? (
            <div className="rounded-xl border border-[#174D3B]/20 bg-[#EBF2EC]/60 p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#174D3B]">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Signed in as {patientUser.name}</span>
              </div>
              <p className="text-xs text-[#252B29]/75 tabular-nums">
                Mobile: {patientUser.phone}
                {patientUser.email ? ` · ${patientUser.email}` : ''}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/portal"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#10382B]"
                >
                  Open My Appointments
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={clearPatientSession}
                  className="rounded-xl border border-[#252B29]/15 bg-white px-4 py-2.5 text-xs font-semibold text-[#252B29] hover:bg-[#F3F3EC] cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="inline-flex p-1 rounded-xl bg-[#F3F3EC] border border-[#252B29]/10">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('signin');
                    setError(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    authTab === 'signin'
                      ? 'bg-[#174D3B] text-white'
                      : 'text-[#252B29]/75 hover:text-[#174D3B]'
                  }`}
                >
                  Patient Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setError(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    authTab === 'register'
                      ? 'bg-[#174D3B] text-white'
                      : 'text-[#252B29]/75 hover:text-[#174D3B]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                  Create Patient Account
                </button>
              </div>

              {authTab === 'signin' ? (
                <form onSubmit={handlePatientSignIn} className="space-y-4">
                  <div>
                    <label
                      htmlFor="patient-identifier"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Mobile Number or Email *
                    </label>
                    <input
                      id="patient-identifier"
                      type="text"
                      required
                      placeholder="10-digit mobile number or email"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="patient-password"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Password *
                    </label>
                    <input
                      id="patient-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  {error && <p className="text-xs font-medium text-red-700">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#174D3B] py-3 text-sm font-semibold text-white hover:bg-[#10382B] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Signing In...' : 'Sign In as Patient'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePatientRegister} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reg-name"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Full Name *
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      minLength={2}
                      placeholder="Enter your full name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="reg-phone"
                        className="block text-xs font-semibold text-[#252B29] mb-1.5"
                      >
                        Mobile Number *
                      </label>
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        placeholder="10-digit mobile number"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="reg-email"
                        className="block text-xs font-semibold text-[#252B29] mb-1.5"
                      >
                        Email (Optional)
                      </label>
                      <input
                        id="reg-email"
                        type="email"
                        placeholder="you@example.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-semibold text-[#252B29] mb-1.5"
                    >
                      Create Password (minimum 8 characters) *
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      minLength={8}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                    />
                  </div>

                  <p className="text-[11px] text-[#252B29]/65">
                    Any previous appointments booked with this mobile number will automatically link
                    to your account.
                  </p>

                  {error && <p className="text-xs font-medium text-red-700">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#174D3B] py-3 text-sm font-semibold text-white hover:bg-[#10382B] disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    {submitting ? 'Creating Account...' : 'Create Patient Account'}
                  </button>
                </form>
              )}

              <div className="pt-4 border-t border-[#252B29]/10 flex items-center justify-between text-xs text-[#252B29]/70">
                <span>Booked as a guest with a reference code?</span>
                <Link
                  to="/book"
                  className="inline-flex items-center gap-1 font-semibold text-[#174D3B] hover:underline"
                >
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  Track by Reference
                </Link>
              </div>
            </>
          )}
        </section>

        {/* Dedicated Clinic Admin Login Side */}
        <aside className="lg:col-span-5 rounded-2xl bg-[#174D3B] text-[#FAFAF6] p-6 md:p-8 space-y-5">
          <div className="w-11 h-11 rounded-xl bg-white/10 text-[#C5A46D] flex items-center justify-center">
            <Shield className="w-5 h-5" aria-hidden="true" />
          </div>

          <div>
            <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">
              Clinic Staff & Administration
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-white">
              Admin Portal Login
            </h2>
            <p className="mt-2 text-sm text-[#FAFAF6]/80 leading-relaxed">
              Administrators and clinic desk staff must sign in on the dedicated Admin Login page to
              access the management console.
            </p>
          </div>

          <ul className="space-y-2 text-xs text-[#FAFAF6]/85">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#A9C5AE] shrink-0" aria-hidden="true" />
              <span>View, confirm, edit, reschedule, or cancel bookings</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#A9C5AE] shrink-0" aria-hidden="true" />
              <span>Update clinic hours, holidays, services & team profiles</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#A9C5AE] shrink-0" aria-hidden="true" />
              <span>Monitor Supabase appointment sync diagnostics</span>
            </li>
          </ul>

          <Link
            to="/admin"
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#FAFAF6] px-5 py-3 text-sm font-semibold text-[#174D3B] hover:bg-white transition-colors"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            {adminToken ? 'Open Admin Dashboard' : 'Go to Admin Login Page'}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
