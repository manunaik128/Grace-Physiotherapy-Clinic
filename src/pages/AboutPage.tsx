import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { ClinicImage } from '../components/ClinicImage';

export function AboutPage() {
  const { data } = useClinic();
  const settings = data?.settings;
  const team = data?.team || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-16">
      {/* Header & Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7">
          <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
            About Grace Physiotherapy Clinic
          </p>
          <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#252B29] text-balance">
            Patient-centred physiotherapy in the heart of JP Nagar 5th Phase
          </h1>
          <p className="mt-5 text-base text-[#252B29]/78 leading-relaxed">
            {settings?.about_overview ||
              'Grace Physiotherapy Clinic serves residents across JP Nagar 5th Phase, Nanjundeswara Layout, and South Bengaluru with attentive, one-to-one physiotherapy assessments and structured rehabilitation programs.'}
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              to="/book"
              className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-6 py-3 text-sm font-semibold text-white hover:bg-[#10382B] transition-colors whitespace-nowrap"
            >
              Book an Assessment
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-xl border border-[#174D3B]/25 bg-white px-6 py-3 text-sm font-semibold text-[#174D3B] hover:bg-[#EBF2EC] transition-colors whitespace-nowrap"
            >
              Explore Our Services
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-2xl overflow-hidden border border-[#252B29]/10 aspect-[4/3] bg-[#EBF2EC]">
            <ClinicImage
              src="/src/assets/images/gallery_consultation_room_1795584347342.jpg"
              alt="Illustrative physiotherapy consultation and movement assessment room"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Mission, Vision, Treatment Philosophy */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-7">
          <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">01. Our Mission</p>
          <h2 className="mt-2 font-display text-xl font-bold text-[#252B29]">
            Clear, individualized care
          </h2>
          <p className="mt-3 text-sm text-[#252B29]/75 leading-relaxed">
            {settings?.mission}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-7">
          <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">02. Our Vision</p>
          <h2 className="mt-2 font-display text-xl font-bold text-[#252B29]">
            Trusted neighbourhood practice
          </h2>
          <p className="mt-3 text-sm text-[#252B29]/75 leading-relaxed">
            {settings?.vision}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#252B29]/10 p-6 md:p-7">
          <p className="text-xs font-semibold text-[#C5A46D] tracking-wide">
            03. Treatment Philosophy
          </p>
          <h2 className="mt-2 font-display text-xl font-bold text-[#252B29]">
            Root-cause rehabilitation
          </h2>
          <p className="mt-3 text-sm text-[#252B29]/75 leading-relaxed">
            {settings?.philosophy}
          </p>
        </div>
      </section>

      {/* Patient-Centred Physiotherapy Approach */}
      <section className="rounded-2xl bg-[#F3F3EC] border border-[#252B29]/8 p-8 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
              Rehabilitation Approach
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#252B29]">
              How we structure every recovery plan
            </h2>
            <p className="mt-3 text-sm text-[#252B29]/72 leading-relaxed">
              Every body responds at its own pace. Rather than promising fixed outcomes, we track
              practical comfort, range of motion, and everyday strength milestones together.
            </p>
          </div>
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                title: 'Detailed Movement Screening',
                text: 'Evaluating posture, joint mobility, muscle balance, and symptom triggers before starting therapy.',
              },
              {
                title: 'Balanced Manual & Modality Care',
                text: 'Combining hands-on mobilization with ultrasound, TENS, or laser support only when clinically appropriate.',
              },
              {
                title: 'Guided Exercise Progression',
                text: 'Building strength safely in clinic so you feel confident repeating drills at home.',
              },
              {
                title: 'Everyday Ergonomics',
                text: 'Practical guidance on workstation setup, sleeping positions, and joint protection during daily chores.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-xl border border-[#252B29]/8 p-5"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2
                    className="w-4 h-4 text-[#174D3B] mt-1 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#252B29]">{item.title}</h3>
                    <p className="mt-1.5 text-xs sm:text-sm text-[#252B29]/72 leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Editable Team Profiles */}
      <section>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#174D3B] tracking-wide">Clinical Team</p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-bold text-[#252B29]">
            Meet the care team
          </h2>
          <p className="mt-2 text-sm text-[#252B29]/65">
            Practitioner profiles, verified qualifications, and staff photographs are managed
            directly by Grace Physiotherapy Clinic through the Admin Dashboard.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {team.map((member) => (
            <article
              key={member.id}
              className="rounded-2xl bg-white border border-[#252B29]/10 overflow-hidden grid grid-cols-1 sm:grid-cols-12"
            >
              <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto bg-[#EBF2EC]">
                <ClinicImage
                  src={member.photo_url}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="sm:col-span-7 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#252B29]">{member.name}</h3>
                  <p className="text-xs font-medium text-[#174D3B] mt-1">{member.role_title}</p>
                  <p className="mt-3 text-sm text-[#252B29]/75 leading-relaxed">{member.bio}</p>
                </div>
                {member.focus_areas && (
                  <p className="mt-4 pt-3 border-t border-[#252B29]/8 text-xs text-[#252B29]/60">
                    {member.focus_areas}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
