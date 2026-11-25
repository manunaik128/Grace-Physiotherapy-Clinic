import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
} from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { ClinicMap, getDirectionsUrl, getWhatsAppUrl } from '../components/ClinicMap';

export function ContactPage() {
  const { data } = useClinic();
  const settings = data?.settings;
  const workingHours = data?.workingHours || [];

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Appointment Enquiry');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const phoneNum = settings?.phone || '+91 95913 71199';
  const whatsappUrl = getWhatsAppUrl(
    settings?.whatsapp_number || '919591371199',
    'Hello Grace Physiotherapy Clinic, I have an enquiry regarding physiotherapy care.'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, email, subject, message }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not send message.');
      setSuccessMsg(json.message);
      setFullName('');
      setPhone('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-14">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
          Contact & Directions · JP Nagar 5th Phase, Bengaluru
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#252B29]">
          Get in touch with Grace Physiotherapy Clinic
        </h1>
        <p className="mt-4 text-base text-[#252B29]/75 leading-relaxed">
          Reach us by phone, WhatsApp, or the enquiry form below. For direct session scheduling,
          use our online booking calendar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Clinic Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-3.5">
              <MapPin className="w-5 h-5 text-[#174D3B] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-sm font-bold text-[#252B29]">Clinic Address</h2>
                <p className="mt-1 text-sm text-[#252B29]/80 leading-relaxed">
                  {settings?.address ||
                    '2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <Phone className="w-5 h-5 text-[#174D3B] mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-display text-sm font-bold text-[#252B29]">Phone & WhatsApp</h2>
                <a
                  href={`tel:${phoneNum.replace(/\s+/g, '')}`}
                  className="mt-1 inline-block text-sm font-semibold text-[#174D3B] hover:underline tabular-nums"
                >
                  {phoneNum}
                </a>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-[#A9C5AE]" aria-hidden="true" />
                    Message on WhatsApp
                  </a>
                  <a
                    href={getDirectionsUrl(settings)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#252B29]/15 bg-[#FAFAF6] px-4 py-2 text-xs font-semibold text-[#252B29] hover:bg-[#EBF2EC] transition-colors"
                  >
                    <Navigation className="w-4 h-4 text-[#174D3B]" aria-hidden="true" />
                    Get Directions
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3.5 pt-4 border-t border-[#252B29]/10">
              <Clock className="w-5 h-5 text-[#174D3B] mt-0.5 shrink-0" aria-hidden="true" />
              <div className="w-full">
                <h2 className="font-display text-sm font-bold text-[#252B29]">Working Hours</h2>
                <div className="mt-2 space-y-1.5 text-xs sm:text-sm tabular-nums">
                  {workingHours.map((wh) => (
                    <div key={wh.day_of_week} className="flex items-center justify-between gap-4">
                      <span className="text-[#252B29]/75">{wh.day_name}</span>
                      <span
                        className={
                          wh.is_open ? 'font-medium text-[#252B29]' : 'text-[#252B29]/50'
                        }
                      >
                        {wh.is_open
                          ? `${wh.morning_start}–${wh.morning_end} · ${wh.evening_start}–${wh.evening_end}`
                          : 'Closed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Contact Form */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8">
          <h2 className="font-display text-xl font-bold text-[#252B29]">Send a message</h2>
          <p className="mt-1 text-sm text-[#252B29]/68">
            Ask about clinic accessibility, session timings, or home-care follow-ups.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-semibold text-[#252B29] mb-1.5"
                >
                  Full Name *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                />
              </div>
              <div>
                <label
                  htmlFor="contact-phone"
                  className="block text-xs font-semibold text-[#252B29] mb-1.5"
                >
                  Mobile Number *
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98XXX XXXXX"
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-xs font-semibold text-[#252B29] mb-1.5"
                >
                  Email (Optional)
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                />
              </div>
              <div>
                <label
                  htmlFor="contact-subject"
                  className="block text-xs font-semibold text-[#252B29] mb-1.5"
                >
                  Topic
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
                >
                  <option value="Appointment Enquiry">Appointment Enquiry</option>
                  <option value="Service Question">Service Question</option>
                  <option value="Post-Surgical Rehab Enquiry">Post-Surgical Rehab Enquiry</option>
                  <option value="Feedback">Feedback</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="contact-msg"
                className="block text-xs font-semibold text-[#252B29] mb-1.5"
              >
                Message *
              </label>
              <textarea
                id="contact-msg"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can our clinic desk help you?"
                className="w-full rounded-xl border border-[#252B29]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#174D3B]"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-[#EBF2EC] border border-[#174D3B]/20 px-4 py-3 text-sm text-[#174D3B] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-6 py-3 text-sm font-semibold text-white hover:bg-[#10382B] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {submitting ? 'Sending...' : 'Submit Enquiry'}
            </button>
          </form>
        </div>
      </div>

      {/* Full Width Map */}
      {settings && (
        <div>
          <ClinicMap
            settings={settings}
            mapsApiKey={data?.mapsApiKey}
            heightClass="h-[380px] md:h-[440px]"
          />
        </div>
      )}
    </div>
  );
}
