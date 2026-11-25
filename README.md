# Grace Physiotherapy Clinic — Website & Appointment Booking System

Complete full-stack physiotherapy clinic website and appointment scheduling system for **Grace Physiotherapy Clinic** (JP Nagar 5th Phase, Bengaluru, Karnataka, India).

## Features

- **Public Website**: Homepage, About Us (with editable team profiles), Services Catalogue (11 seeded physiotherapy categories), Multi-Step Online Booking, Contact & Interactive Google Map, Privacy Policy, and Terms & Conditions.
- **Real-Time IST (`Asia/Kolkata`) Booking Engine**:
  - Interactive calendar disabling past dates, Sundays, and admin-blocked holidays/closures.
  - Configurable morning (10:00 AM – 1:00 PM) and evening (5:00 PM – 8:00 PM) windows.
  - SQLite `BEGIN IMMEDIATE` transactional booking preventing double bookings and overlapping slots.
  - Privacy-safe self-service lookup (`Reference Code + Mobile Number`) for patient rescheduling or cancellation.
- **Protected Admin Dashboard (`/admin`)**:
  - First-run admin setup claim or environment passcode (`ADMIN_PASSCODE`) login with `scrypt` password hashing and HMAC-signed Bearer tokens.
  - Overview KPIs, appointment search/filtering, confirmation, completion, rescheduling, cancellation, and audit history.
  - Services CRUD, working hours & capacity/buffer configuration, holiday blocking, clinic info, testimonials, gallery, team profiles, and contact inquiry management.
- **WhatsApp Click-to-Chat**: Floating enquiry button and post-booking confirmation sharing for `+91 95913 71199`.

## Environment Variables

Copy `.env.example` to `.env` if running locally outside AI Studio:

- `APP_URL`: Public URL used for `sitemap.xml` and `robots.txt`.
- `VITE_GOOGLE_MAPS_API_KEY`: Browser API key for Maps JavaScript API (restrict to HTTP referrers).
- `ADMIN_PASSCODE`: Optional server-side passcode for `/admin`. If unset, claim the initial Super Admin account inline at `/admin`.
- `SUPABASE_URL`: Your Supabase project URL (`https://<project-ref>.supabase.co`).
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable client key for server-side booking sync via `book_clinic_appointment` RPC.
- `SUPABASE_SERVICE_ROLE_KEY`: Optional server-side secret key if you also want admin status updates and reschedules synced back to Supabase.

> **Supabase First-Time Table Setup**: Run `supabase/migrations/001_grace_physio_schema.sql` once in your Supabase SQL Editor (also available to copy inside `/admin` -> **Supabase Sync**).

## Local Setup & Running

```bash
npm install
npm run dev
```

The server listens on port `3000`, mounts Vite dev middleware, and stores persistent clinic data in `data/grace_physio.db` (SQLite via Node 22 `node:sqlite`).

## Production Build & Deployment

```bash
npm run build
NODE_ENV=production npm start
```

Before publishing live, sign into `/admin` and verify the final operating hours, staff profiles, and clinic photographs with clinic management.

## Verification Checklist

1. **Booking Flow**: Visit `/book`, select a service, pick a Monday–Saturday date, choose a Morning/Evening slot, submit details, and note the `GPC-...` reference.
2. **Double-Booking Prevention**: Attempt to book the same date and slot again; confirm the booked slot is removed from availability and concurrent requests return `409 Conflict`.
3. **Admin Dashboard**: Visit `/admin`, claim initial admin access (or enter `ADMIN_PASSCODE`), filter appointments, confirm/reschedule/complete bookings, and block a holiday date.
4. **SEO & Map**: Check `/sitemap.xml`, `/robots.txt`, and the interactive clinic map on `/` and `/contact`.
