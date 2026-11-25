import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Check, Clock } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';
import { ClinicImage } from '../components/ClinicImage';
import { ServiceIcon } from '../components/ServiceIcon';

export function ServicesPage() {
  const { data, loading } = useClinic();
  const services = data?.services || [];
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(services.map((s) => s.category)));
    return ['All', ...unique];
  }, [services]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return services;
    return services.filter((s) => s.category === selectedCategory);
  }, [services, selectedCategory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold text-[#174D3B] tracking-wide">
          Services Catalogue · Grace Physiotherapy Clinic
        </p>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#252B29] text-balance">
          Physiotherapy & rehabilitation services
        </h1>
        <p className="mt-4 text-base text-[#252B29]/75 leading-relaxed">
          Explore our musculoskeletal, post-surgical, mobility, and electrotherapy programs. Every
          care plan is customized after an initial clinical assessment; session durations are
          estimates and may adjust to your clinical need.
        </p>
      </div>

      {/* Category Filter Tabs (Interactive button controls) */}
      <div className="mt-8 flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-[#F3F3EC] border border-[#252B29]/8 w-fit">
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#174D3B] text-white shadow-sm'
                  : 'text-[#252B29]/75 hover:text-[#174D3B] hover:bg-white/60'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mt-10 space-y-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-72 rounded-2xl bg-white border border-[#252B29]/8 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 space-y-8">
          {filtered.map((service) => (
            <article
              key={service.id}
              id={service.slug}
              className="rounded-2xl bg-white border border-[#252B29]/10 overflow-hidden grid grid-cols-1 lg:grid-cols-12"
            >
              <div className="lg:col-span-4 aspect-[4/3] lg:aspect-auto bg-[#EBF2EC]">
                <ClinicImage
                  src={service.image_url}
                  alt={service.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="lg:col-span-8 p-6 md:p-8 flex flex-col justify-between">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-[#252B29]/65">
                      <ServiceIcon name={service.icon_name} className="w-4 h-4 text-[#174D3B]" />
                      <span>{service.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        Est. {service.duration_minutes} mins
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-3 font-display text-2xl font-bold text-[#252B29]">
                    {service.name}
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-[#252B29]/78 leading-relaxed">
                    {service.description}
                  </p>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 pt-5 border-t border-[#252B29]/8">
                    <div>
                      <h3 className="font-display text-xs font-bold text-[#174D3B] tracking-wide">
                        Benefits & Purpose
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {service.benefits.map((b, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-[#252B29]/78"
                          >
                            <Check
                              className="w-4 h-4 text-[#174D3B] mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-display text-xs font-bold text-[#174D3B] tracking-wide">
                        Suitable Patient Concerns
                      </h3>
                      <ul className="mt-2.5 space-y-2">
                        {service.suitable_for.map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-[#252B29]/78"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#C5A46D] mt-2 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-7 pt-5 border-t border-[#252B29]/8 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs text-[#252B29]/60">
                    Individual progress varies based on clinical assessment and adherence.
                  </p>
                  <Link
                    to={`/book?service=${encodeURIComponent(service.slug)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#10382B] transition-colors whitespace-nowrap"
                  >
                    <CalendarCheck className="w-4 h-4" aria-hidden="true" />
                    Book Appointment
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
