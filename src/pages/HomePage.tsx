import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Quote,
} from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { ClinicImage } from '../components/ClinicImage';
import { ClinicMap, getDirectionsUrl } from '../components/ClinicMap';
import { ServiceIcon } from '../components/ServiceIcon';

const WHY_CHOOSE_ITEMS = [
  {
    num: '01.',
    title: 'Personalized Treatment Approach',
    body: 'Every session begins with a thorough movement and posture assessment so your care reflects your specific pain pattern and daily demands.',
  },
  {
    num: '02.',
    title: 'Patient-Focused Care',
    body: 'Unhurried one-to-one clinical attention in a calm JP Nagar setting, paced around your comfort and tolerance.',
  },
  {
    num: '03.',
    title: 'Rehabilitation Guidance',
    body: 'Structured progression from easing acute discomfort to rebuilding joint stability and functional confidence.',
  },
  {
    num: '04.',
    title: 'Exercise Education',
    body: 'Clear, practical home-exercise demonstrations and ergonomic advice so you understand what helps and why.',
  },
  {
    num: '05.',
    title: 'Support Throughout Recovery',
    body: 'Consistent check-ins and adaptable milestones across every visit as your strength and mobility improve.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Book an Appointment',
    detail: 'Choose your service and reserve a morning or evening slot online in under two minutes.',
  },
  {
    step: '02',
    title: 'Initial Assessment',
    detail: 'Discuss your symptoms, medical history, and movement goals with our physiotherapist.',
  },
  {
    step: '03',
    title: 'Personalized Treatment Plan',
    detail: 'Receive a tailored combination of manual therapy, modalities if needed, and targeted drills.',
  },
  {
    step: '04',
    title: 'Guided Rehabilitation',
    detail: 'Practice supervised exercises with real-time posture and alignment feedback.',
  },
  {
    step: '05',
    title: 'Recovery Progress',
    detail: 'Build sustainable strength, safer movement habits, and greater day-to-day comfort.',
  },
];

export function HomePage() {
  const { data, loading } = useClinic();

  const settings = data?.settings;
  const services = data?.services || [];
  const testimonials = data?.testimonials || [];
  const gallery = data?.gallery || [];
  const featuredServices = services.slice(0, 6);

  return (
    <div>
      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 md:pt-12 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center py-2 md:py-6">
            <p className="text-xs sm:text-sm font-medium text-[#174D3B] tracking-wide">
              Grace Physiotherapy Clinic · JP Nagar 5th Phase, Bengaluru
            </p>
            <h1
              className="mt-4 font-display font-bold tracking-tight text-[#252B29] text-balance leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.75rem)' }}
            >
              Move Better. Feel Better. Live Better.
            </h1>
            <p className="mt-5 text-base md:text-lg text-[#252B29]/75 leading-relaxed max-w-xl">
              Personalized physiotherapy and guided rehabilitation in JP Nagar. We combine careful
              movement assessment, hands-on clinical care, and structured exercise education to
              help you return to comfortable daily living.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/book"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#174D3B] px-6 py-3.5 text-sm md:text-base font-semibold text-white hover:bg-[#10382B] transition-colors whitespace-nowrap"
              >
                <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                Book an Appointment
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#174D3B]/25 bg-white px-6 py-3.5 text-sm md:text-base font-semibold text-[#174D3B] hover:bg-[#EBF2EC] transition-colors whitespace-nowrap"
              >
                Explore Our Services
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-2xl overflow-hidden border border-[#252B29]/10 shadow-sm h-72 sm:h-96 lg:h-full min-h-[340px] bg-[#EBF2EC]">
              <ClinicImage
                src="/src/assets/images/hero_physio_session_1795584344580.jpg"
                alt="Physiotherapist guiding an adult patient through gentle shoulder rehabilitation at a sunlit clinic room"
                className="w-full h-full object-cover"
                lazy={false}
              />
            </div>
          </div>
        </div>

        {/* Full-Width Trust & Operating Hours Strip below Hero Split */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-y border-[#252B29]/10 py-6">
          <div>
            <p className="text-xs font-medium text-[#252B29]/60">Morning Session</p>
            <p className="mt-1 font-display text-base font-semibold text-[#174D3B] tabular-nums">
              10:00 AM – 1:00 PM
            </p>
            <p className="text-xs text-[#252B29]/65 mt-0.5">Monday to Saturday</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#252B29]/60">Evening Session</p>
            <p className="mt-1 font-display text-base font-semibold text-[#174D3B] tabular-nums">
              5:00 PM – 8:00 PM
            </p>
            <p className="text-xs text-[#252B29]/65 mt-0.5">Sunday Closed</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#252B29]/60">Clinic Location</p>
            <p className="mt-1 font-display text-base font-semibold text-[#252B29]">
              JP Nagar 5th Phase
            </p>
            <p className="text-xs text-[#252B29]/65 mt-0.5">Nanjundeswara Layout, Bengaluru</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#252B29]/60">Direct Appointments</p>
            <a
              href={`tel:${(settings?.phone || '+91 95913 71199').replace(/\s+/g, '')}`}
              className="mt-1 inline-block font-display text-base font-semibold text-[#174D3B] hover:underline tabular-nums"
            >
              {settings?.phone || '+91 95913 71199'}
            </a>
            <p className="text-xs text-[#252B29]/65 mt-0.5">Instant online slot confirmation</p>
          </div>
        </div>
      </section>

      {/* 2. Clinic Introduction */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-2xl overflow-hidden border border-[#252B29]/10 aspect-[4/3] bg-[#EBF2EC]">
              <ClinicImage
                src="/src/assets/images/about_clinic_interior_1795584345353.jpg"
                alt="Illustrative calm physiotherapy reception and patient waiting lounge"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">
              Welcome to Grace Physiotherapy Clinic
            </p>
            <h2 className="mt-3 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#252B29] text-balance">
              Thoughtful rehabilitation built around your daily movement goals
            </h2>
            <p className="mt-5 text-base text-[#252B29]/75 leading-relaxed">
              {settings?.about_overview ||
                'Grace Physiotherapy Clinic serves JP Nagar 5th Phase and South Bengaluru with attentive, one-to-one physiotherapy assessments and structured rehabilitation programs. Every care plan begins with listening carefully to how pain or stiffness affects your daily routine before designing a paced, evidence-informed path forward.'}
            </p>
            <p className="mt-4 text-base text-[#252B29]/75 leading-relaxed">
              {settings?.philosophy ||
                'Combining hands-on manual therapy, electrotherapy modalities when clinically appropriate, and progressive home exercise guidance, we partner with patients throughout recovery.'}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-6">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#174D3B] hover:underline underline-offset-4"
              >
                Read About Our Clinic & Philosophy
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Services Overview */}
      <section id="services" className="bg-[#F3F3EC] border-y border-[#252B29]/8 py-16 md:py-22">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
                Clinical Services
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#252B29] text-balance">
                Focused physiotherapy & rehabilitation programs
              </h2>
              <p className="mt-3 text-base text-[#252B29]/70">
                Select a treatment category to reserve your session or explore the full 11-service
                clinical catalogue.
              </p>
            </div>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-xl border border-[#174D3B]/25 bg-white px-5 py-2.5 text-sm font-semibold text-[#174D3B] hover:bg-[#EBF2EC] transition-colors whitespace-nowrap self-start md:self-auto"
            >
              View All {services.length || 11} Services
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {loading ? (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="h-64 rounded-2xl bg-white/70 border border-[#252B29]/8 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredServices.map((service) => (
                <article
                  key={service.id}
                  className="bg-white rounded-2xl border border-[#252B29]/10 p-6 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="w-11 h-11 rounded-xl bg-[#EBF2EC] text-[#174D3B] flex items-center justify-center shrink-0">
                        <ServiceIcon name={service.icon_name} className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-[#252B29]/60 tabular-nums">
                        {service.category} · {service.duration_minutes} min
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-lg font-bold text-[#252B29]">
                      {service.name}
                    </h3>
                    <p className="mt-2 text-sm text-[#252B29]/72 leading-relaxed">
                      {service.short_description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#252B29]/8 flex items-center justify-between gap-3">
                    <Link
                      to={`/services#${service.slug}`}
                      className="text-xs font-semibold text-[#252B29]/70 hover:text-[#174D3B]"
                    >
                      Treatment details
                    </Link>
                    <Link
                      to={`/book?service=${encodeURIComponent(service.slug)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#174D3B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#10382B] transition-colors whitespace-nowrap"
                    >
                      Book Session
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Why Choose Us */}
      <section id="approach" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-22">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">
              Why Choose Grace Physiotherapy
            </p>
            <h2 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#252B29] text-balance">
              Steady, ethical physiotherapy without rushed appointments
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#252B29]/72 leading-relaxed">
              We focus on clear explanations, safe progression, and measurable everyday function—never
              overpromising instant cures.
            </p>
          </div>

          <div className="lg:col-span-8 divide-y divide-[#252B29]/10 border-t border-b border-[#252B29]/10">
            {WHY_CHOOSE_ITEMS.map((item) => (
              <div
                key={item.num}
                className="py-5 sm:py-6 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-baseline"
              >
                <div className="sm:col-span-5 flex items-baseline gap-3">
                  <span className="font-display text-sm font-bold text-[#C5A46D] tabular-nums">
                    {item.num}
                  </span>
                  <h3 className="font-display text-base sm:text-lg font-semibold text-[#252B29]">
                    {item.title}
                  </h3>
                </div>
                <p className="sm:col-span-7 text-sm text-[#252B29]/75 leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. How It Works */}
      <section className="bg-[#174D3B] text-[#FAFAF6] py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">
              Your Care Journey
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white text-balance">
              How physiotherapy care works at our clinic
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white/8 border border-white/12 p-5 flex flex-col justify-between"
              >
                <div>
                  <span className="font-display text-2xl font-bold text-[#C5A46D] tabular-nums">
                    {item.step}
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#FAFAF6]/78 leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-22">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
            Patient Experiences
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#252B29] text-balance">
            Voices from our JP Nagar neighbourhood
          </h2>
          <p className="mt-2 text-sm text-[#252B29]/65">
            Patient feedback managed and verified directly by clinic administration.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item) => (
            <figure
              key={item.id}
              className="rounded-2xl bg-white border border-[#252B29]/10 p-6 flex flex-col justify-between"
            >
              <div>
                <Quote className="w-6 h-6 text-[#C5A46D]" aria-hidden="true" />
                <blockquote className="mt-4 text-sm sm:text-base text-[#252B29]/82 leading-relaxed">
                  “{item.quote}”
                </blockquote>
              </div>
              <figcaption className="mt-6 pt-4 border-t border-[#252B29]/8">
                <p className="font-display text-sm font-bold text-[#174D3B]">
                  {item.patient_name}
                </p>
                <p className="text-xs text-[#252B29]/60 mt-0.5">
                  {item.condition_tag} · {item.visit_context}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* 7. Clinic & Equipment Gallery */}
      <section id="gallery" className="bg-[#F3F3EC] border-y border-[#252B29]/8 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
                Clinic Environment
              </p>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#252B29]">
                Calm treatment rooms & rehabilitation spaces
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-[#252B29]/65">
                Illustrative physiotherapy and rehabilitation imagery — clinic staff can upload or
                update authentic clinic photographs anytime from the Admin Dashboard.
              </p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {gallery.map((img) => (
              <figure
                key={img.id}
                className="rounded-2xl bg-white border border-[#252B29]/10 overflow-hidden"
              >
                <div className="aspect-[4/3] bg-[#EBF2EC]">
                  <ClinicImage
                    src={img.image_url}
                    alt={img.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <figcaption className="p-5">
                  <p className="text-xs text-[#252B29]/55">
                    {img.category}
                    {img.is_illustrative ? ' · Illustrative photo' : ''}
                  </p>
                  <h3 className="mt-1 font-display text-base font-semibold text-[#252B29]">
                    {img.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#252B29]/70 leading-relaxed">{img.caption}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Appointment CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="rounded-2xl bg-[#174D3B] text-white p-8 md:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">
              Online Scheduling · Asia/Kolkata (IST)
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              Ready to schedule your physiotherapy assessment in JP Nagar?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/80 leading-relaxed">
              View live morning (10 AM – 1 PM) and evening (5 PM – 8 PM) availability and receive an
              instant booking reference number.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              to="/book"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C5A46D] px-6 py-3.5 text-sm md:text-base font-semibold text-[#10382B] hover:bg-[#d3b684] transition-colors whitespace-nowrap"
            >
              Book Appointment Now
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* 9. Location & Interactive Google Map */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
                Visit Our Clinic
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-[#252B29]">
                {settings?.business_name || 'Grace Physiotherapy Clinic'}
              </h2>
              <div className="mt-6 space-y-5 text-sm text-[#252B29]/80">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#174D3B] shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="leading-relaxed">
                    {settings?.address ||
                      '2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India'}
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#174D3B] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="tabular-nums space-y-1">
                    <p className="font-semibold text-[#252B29]">Monday – Saturday</p>
                    <p>Morning: 10:00 AM – 1:00 PM</p>
                    <p>Evening: 5:00 PM – 8:00 PM</p>
                    <p className="text-[#252B29]/60">Sunday: Closed</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-[#174D3B] shrink-0" aria-hidden="true" />
                  <a
                    href={`tel:${(settings?.phone || '+91 95913 71199').replace(/\s+/g, '')}`}
                    className="font-semibold text-[#174D3B] hover:underline tabular-nums"
                  >
                    {settings?.phone || '+91 95913 71199'}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#252B29]/10 flex flex-wrap gap-3">
              <a
                href={getDirectionsUrl(settings)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-5 py-3 text-sm font-semibold text-white hover:bg-[#10382B] transition-colors whitespace-nowrap"
              >
                <Navigation className="w-4 h-4" aria-hidden="true" />
                Get Directions
              </a>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-[#252B29]/15 bg-[#FAFAF6] px-5 py-3 text-sm font-semibold text-[#252B29] hover:bg-[#EBF2EC] transition-colors whitespace-nowrap"
              >
                Contact Details
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7">
            {settings && (
              <ClinicMap
                settings={settings}
                mapsApiKey={data?.mapsApiKey}
                heightClass="h-[360px] lg:h-full min-h-[380px]"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
