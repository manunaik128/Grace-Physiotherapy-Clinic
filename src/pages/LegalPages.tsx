import { Link } from 'react-router-dom';
import { useClinic } from '../context/ClinicContext';

export function PrivacyPolicyPage() {
  const { data } = useClinic();
  const clinicName = data?.settings?.business_name || 'Grace Physiotherapy Clinic';
  const address =
    data?.settings?.address ||
    '2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-6">
      <h1 className="font-display text-3xl font-bold text-[#252B29]">Privacy Policy</h1>
      <p className="text-sm text-[#252B29]/75 leading-relaxed">
        {clinicName} respects patient privacy and collects only the contact information needed to
        schedule and coordinate physiotherapy appointments.
      </p>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">1. Information Collected</h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          When booking online or submitting an enquiry, we collect your name, mobile number,
          optional email address, selected service, and optional scheduling note. We ask patients not
          to submit detailed diagnostic files or sensitive medical records through public web forms.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">2. How Data Is Used</h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          Booking records are used solely by authorized clinic staff to manage appointment slots,
          confirm visits, and coordinate rescheduling or cancellations. Patient appointment lists
          are never published or shared publicly.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">
          3. Location & Map Services
        </h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          Our website integrates Google Maps features to display clinic directions in JP Nagar,
          Bengaluru. Use of embedded map features is subject to Google Maps End User Additional Terms
          of Service and the Google Privacy Policy.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">4. Contact</h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          For data updates or removal requests, please contact {clinicName} at {address} or call{' '}
          {data?.settings?.phone || '+91 95913 71199'}.
        </p>
      </section>
      <div className="pt-4">
        <Link to="/" className="text-sm font-semibold text-[#174D3B] hover:underline">
          ← Back to Homepage
        </Link>
      </div>
    </div>
  );
}

export function TermsPage() {
  const { data } = useClinic();
  const clinicName = data?.settings?.business_name || 'Grace Physiotherapy Clinic';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-6">
      <h1 className="font-display text-3xl font-bold text-[#252B29]">Terms & Conditions</h1>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">
          1. Clinical Information Disclaimer
        </h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          Content on the {clinicName} website is provided for general informational purposes and does
          not replace an in-person clinical evaluation. Individual physiotherapy outcomes depend on
          clinical assessment and adherence to care guidance.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">
          2. Appointment Scheduling & Cancellations
        </h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          Appointments follow Asia/Kolkata (IST) clinic timings. If you need to cancel or
          reschedule, please use the Manage Booking tool with your reference code or notify the
          clinic promptly so the slot can be offered to another patient.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="font-display text-lg font-bold text-[#174D3B]">
          3. Clinic Hours & Holidays
        </h2>
        <p className="text-sm text-[#252B29]/78 leading-relaxed">
          Operating hours and holiday closures may be adjusted by clinic administration. Confirmed
          booking slots reflect active clinic availability at the time of reservation.
        </p>
      </section>
      <div className="pt-4">
        <Link to="/" className="text-sm font-semibold text-[#174D3B] hover:underline">
          ← Back to Homepage
        </Link>
      </div>
    </div>
  );
}
