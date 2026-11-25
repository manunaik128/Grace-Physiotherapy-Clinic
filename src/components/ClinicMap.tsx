import { useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { MapPin, Navigation, Phone } from 'lucide-react';
import type { ClinicSettings } from '../types/clinic';

export function getDirectionsUrl(settings?: Pick<ClinicSettings, 'business_name' | 'address'>) {
  const query = settings
    ? `${settings.business_name}, ${settings.address}`
    : 'Grace Physiotherapy Clinic, 2, 15th Main, 17th D Cross Road, 5th Phase, Nanjundeswara Layout, JP Nagar, Bengaluru, Karnataka 560078, India';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function getWhatsAppUrl(whatsappNumber: string, message: string) {
  const digits = whatsappNumber.replace(/\D/g, '') || '919591371199';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

interface ClinicMapMarkerProps {
  settings: ClinicSettings;
}

function ClinicMapMarker({ settings }: ClinicMapMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(true);
  const position = {
    lat: Number(settings.latitude) || 12.9012,
    lng: Number(settings.longitude) || 77.5892,
  };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={settings.business_name}
        onClick={() => setInfoOpen((v) => !v)}
      >
        <Pin background="#174D3B" borderColor="#10382B" glyphColor="#FAFAF6" scale={1.15} />
      </AdvancedMarker>

      {infoOpen && marker && (
        <InfoWindow anchor={marker} maxWidth={260} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-1 text-[#252B29]">
            <p className="font-semibold text-sm text-[#174D3B]">{settings.business_name}</p>
            <p className="text-xs text-[#252B29]/80 mt-1 leading-relaxed">
              2, 15th Main, 17th D Cross Road, 5th Phase, JP Nagar, Bengaluru 560078
            </p>
            <a
              href={getDirectionsUrl(settings)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-[#174D3B] underline"
            >
              Get Directions
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface ClinicMapProps {
  settings: ClinicSettings;
  mapsApiKey?: string;
  heightClass?: string;
}

export function ClinicMap({
  settings,
  mapsApiKey = '',
  heightClass = 'h-[360px] md:h-[420px]',
}: ClinicMapProps) {
  const resolvedKey =
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || mapsApiKey.trim();

  const position = {
    lat: Number(settings.latitude) || 12.9012,
    lng: Number(settings.longitude) || 77.5892,
  };

  if (!resolvedKey) {
    return (
      <div
        className={`relative w-full ${heightClass} rounded-2xl border border-[#252B29]/12 bg-[#EBF2EC] overflow-hidden flex flex-col justify-between p-6 md:p-8`}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(23,77,59,0.22) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-2 bg-white/90 px-3.5 py-2 rounded-xl border border-[#174D3B]/15 text-xs font-semibold text-[#174D3B]">
            <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>JP Nagar 5th Phase · Bengaluru</span>
          </div>
        </div>

        <div className="relative z-10 bg-white rounded-xl p-5 border border-[#252B29]/10 shadow-sm max-w-md">
          <p className="font-semibold text-[#174D3B] text-base">{settings.business_name}</p>
          <p className="text-sm text-[#252B29]/80 mt-1.5 leading-relaxed">{settings.address}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={getDirectionsUrl(settings)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#174D3B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#10382B] transition-colors whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" aria-hidden="true" />
              Get Directions
            </a>
            <a
              href={`tel:${settings.phone.replace(/\s+/g, '')}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#174D3B]/20 bg-[#FAFAF6] px-4 py-2.5 text-sm font-medium text-[#174D3B] hover:bg-[#EBF2EC] transition-colors whitespace-nowrap"
            >
              <Phone className="w-4 h-4" aria-hidden="true" />
              Call Clinic
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-[#252B29]/12 bg-[#EBF2EC]`}>
      <APIProvider apiKey={resolvedKey} language="en" region="IN" libraries={['marker']}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={position}
          defaultZoom={16}
          gestureHandling="cooperative"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          <ClinicMapMarker settings={settings} />
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
