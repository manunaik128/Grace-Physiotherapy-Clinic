import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, MessageCircle, X, Phone, MapPin, Clock, ArrowUpRight, Lock } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { getDirectionsUrl, getWhatsAppUrl } from './ClinicMap';

export function Layout({
  children,
  quotaExceeded,
}: {
  children: React.ReactNode;
  quotaExceeded: boolean;
}) {
  const { data, adminToken } = useClinic();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const settings = data?.settings;
  const phone = settings?.phone || '+91 95913 71199';
  const whatsappNumber = settings?.whatsapp_number || '919591371199';
  const whatsappHref = getWhatsAppUrl(
    whatsappNumber,
    'Hello Grace Physiotherapy Clinic, I would like to enquire about booking a physiotherapy appointment.'
  );

  const isBookPage = location.pathname.startsWith('/book');
  const isAdminPage = location.pathname.startsWith('/admin');

  const handleAnchorNav = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF6] text-[#252B29]">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navigation Bar — Strict 3-Zone Contract */}
      <header className="sticky top-0 z-40 bg-[#FAFAF6]/95 backdrop-blur-md border-b border-[#252B29]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="font-display text-lg md:text-xl font-bold tracking-tight text-[#174D3B] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#174D3B]"
          >
            Grace Physiotherapy
          </Link>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#252B29]/75"
          >
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#174D3B] underline-offset-4 hover:underline ${
                  isActive ? 'text-[#174D3B] font-semibold underline' : ''
                }`
              }
            >
              About
            </NavLink>
            <NavLink
              to="/services"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#174D3B] underline-offset-4 hover:underline ${
                  isActive ? 'text-[#174D3B] font-semibold underline' : ''
                }`
              }
            >
              Services
            </NavLink>
            <button
              type="button"
              onClick={() => handleAnchorNav('approach')}
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#174D3B] underline-offset-4 hover:underline cursor-pointer"
            >
              Our Approach
            </button>
            <button
              type="button"
              onClick={() => handleAnchorNav('gallery')}
              className="whitespace-nowrap shrink-0 transition-colors hover:text-[#174D3B] underline-offset-4 hover:underline cursor-pointer"
            >
              Gallery
            </button>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `whitespace-nowrap shrink-0 transition-colors hover:text-[#174D3B] underline-offset-4 hover:underline ${
                  isActive ? 'text-[#174D3B] font-semibold underline' : ''
                }`
              }
            >
              Contact
            </NavLink>
          </nav>

          {/* Zone 3: Admin Login, Primary Book Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/admin"
              className={`hidden md:inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174D3B] ${
                isAdminPage
                  ? 'border-[#174D3B] bg-[#EBF2EC] text-[#174D3B]'
                  : 'border-[#252B29]/15 bg-white text-[#252B29] hover:border-[#174D3B]/40 hover:bg-[#EBF2EC]/60 hover:text-[#174D3B]'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-[#174D3B]" aria-hidden="true" />
              <span>{adminToken ? 'Admin' : 'Admin Login'}</span>
            </Link>

            <Link
              to="/book"
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-[#174D3B] px-4 md:px-5 py-2.5 text-xs md:text-sm font-semibold text-white hover:bg-[#10382B] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174D3B]"
            >
              Book Appointment
            </Link>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#252B29]/15 text-[#252B29] hover:bg-[#EBF2EC] transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#252B29]/10 bg-[#FAFAF6] px-4 py-4 space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#252B29] hover:bg-[#EBF2EC]"
            >
              Home
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#252B29] hover:bg-[#EBF2EC]"
            >
              About Us
            </Link>
            <Link
              to="/services"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#252B29] hover:bg-[#EBF2EC]"
            >
              Services
            </Link>
            <button
              type="button"
              onClick={() => handleAnchorNav('approach')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#252B29] hover:bg-[#EBF2EC]"
            >
              Our Approach
            </button>
            <button
              type="button"
              onClick={() => handleAnchorNav('gallery')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#252B29] hover:bg-[#EBF2EC]"
            >
              Gallery
            </button>
            <Link
              to="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#252B29] hover:bg-[#EBF2EC]"
            >
              Contact
            </Link>
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#174D3B] hover:bg-[#EBF2EC]"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              {adminToken ? 'Admin Dashboard' : 'Admin Login'}
            </Link>
            <Link
              to="/book"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 block w-full text-center rounded-xl bg-[#174D3B] px-4 py-3 text-sm font-semibold text-white hover:bg-[#10382B]"
            >
              Book Appointment
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      {!isAdminPage && (
        <footer className="bg-[#174D3B] text-[#FAFAF6] mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-white/15">
              {/* Column 1: Clinic Info */}
              <div>
                <h2 className="font-display text-xl font-bold text-white tracking-tight">
                  {settings?.business_name || 'Grace Physiotherapy Clinic'}
                </h2>
                <p className="mt-3 text-sm text-[#FAFAF6]/80 leading-relaxed">
                  {settings?.tagline ||
                    'Personalized physiotherapy and rehabilitation care in JP Nagar 5th Phase, Bengaluru.'}
                </p>
                <div className="mt-5 flex items-start gap-2.5 text-sm text-[#FAFAF6]/85">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#C5A46D]" aria-hidden="true" />
                  <span className="leading-relaxed">
                    {settings?.address ||
                      '2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India'}
                  </span>
                </div>
              </div>

              {/* Column 2: Quick Links */}
              <div>
                <h3 className="font-display text-sm font-semibold text-[#C5A46D] tracking-wide">
                  Quick Links
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#FAFAF6]/85">
                  <li>
                    <Link to="/" className="hover:text-white hover:underline underline-offset-4">
                      Home
                    </Link>
                  </li>
                  <li>
                    <Link to="/about" className="hover:text-white hover:underline underline-offset-4">
                      About the Clinic
                    </Link>
                  </li>
                  <li>
                    <Link to="/services" className="hover:text-white hover:underline underline-offset-4">
                      All Physiotherapy Services
                    </Link>
                  </li>
                  <li>
                    <Link to="/book" className="hover:text-white hover:underline underline-offset-4">
                      Book an Appointment
                    </Link>
                  </li>
                  <li>
                    <Link to="/contact" className="hover:text-white hover:underline underline-offset-4">
                      Contact & Directions
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Column 3: Core Services */}
              <div>
                <h3 className="font-display text-sm font-semibold text-[#C5A46D] tracking-wide">
                  Rehabilitation Areas
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm text-[#FAFAF6]/85">
                  {(data?.services || []).slice(0, 6).map((svc) => (
                    <li key={svc.id}>
                      <Link
                        to={`/book?service=${encodeURIComponent(svc.slug)}`}
                        className="hover:text-white hover:underline underline-offset-4"
                      >
                        {svc.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 4: Hours & Contact */}
              <div>
                <h3 className="font-display text-sm font-semibold text-[#C5A46D] tracking-wide">
                  Clinic Hours & Contact
                </h3>
                <div className="mt-4 space-y-3 text-sm text-[#FAFAF6]/85">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0 text-[#C5A46D]" aria-hidden="true" />
                    <div className="tabular-nums space-y-1">
                      <p className="font-medium text-white">Monday – Saturday</p>
                      <p>Morning: 10:00 AM – 1:00 PM</p>
                      <p>Evening: 5:00 PM – 8:00 PM</p>
                      <p className="text-[#FAFAF6]/65">Sunday: Closed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 shrink-0 text-[#C5A46D]" aria-hidden="true" />
                    <a
                      href={`tel:${phone.replace(/\s+/g, '')}`}
                      className="hover:text-white tabular-nums"
                    >
                      {phone}
                    </a>
                  </div>
                  <div className="pt-1 flex flex-wrap gap-3">
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A9C5AE] hover:text-white underline underline-offset-4"
                    >
                      WhatsApp Enquiry
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                    <a
                      href={getDirectionsUrl(settings)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A9C5AE] hover:text-white underline underline-offset-4"
                    >
                      Google Maps
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#FAFAF6]/70">
              <p>
                © {new Date().getFullYear()} {settings?.business_name || 'Grace Physiotherapy Clinic'}.
                JP Nagar 5th Phase, Bengaluru.
              </p>
              <div className="flex flex-wrap items-center gap-5">
                <Link to="/privacy" className="hover:text-white underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
                <Link to="/terms" className="hover:text-white underline-offset-4 hover:underline">
                  Terms & Conditions
                </Link>
                <Link to="/admin" className="hover:text-white underline-offset-4 hover:underline">
                  Clinic Admin
                </Link>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Floating WhatsApp Click-to-Chat Button (all public pages) */}
      {!isAdminPage && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Enquire via WhatsApp"
          className={`fixed right-4 md:right-6 z-40 inline-flex items-center gap-2 rounded-full bg-[#174D3B] text-white px-4 py-3 shadow-lg border border-white/20 hover:bg-[#10382B] transition-transform hover:scale-[1.02] ${
            !isBookPage ? 'bottom-16 sm:bottom-6' : 'bottom-6'
          }`}
        >
          <MessageCircle className="w-5 h-5 text-[#A9C5AE]" aria-hidden="true" />
          <span className="hidden md:inline text-sm font-medium whitespace-nowrap">
            WhatsApp Clinic
          </span>
        </a>
      )}

      {/* Compact Mobile Sticky Book CTA (<= 15% mobile viewport cap together with header) */}
      {!isBookPage && !isAdminPage && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-[#FAFAF6]/95 backdrop-blur-md border-t border-[#252B29]/12 px-4 py-2 flex items-center justify-between gap-3 h-12">
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#174D3B] whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            {phone}
          </a>
          <Link
            to="/book"
            className="inline-flex items-center justify-center rounded-lg bg-[#174D3B] px-4 py-1.5 text-xs font-semibold text-white whitespace-nowrap"
          >
            Book Appointment
          </Link>
        </div>
      )}
    </div>
  );
}
