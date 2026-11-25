import { useState } from 'react';
import { Activity } from 'lucide-react';

interface ClinicImageProps {
  src: string;
  alt: string;
  className?: string;
  lazy?: boolean;
}

export function ClinicImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  lazy = true,
}: ClinicImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EBF2EC] to-[#DDE8DF] text-[#174D3B] p-6 text-center ${className}`}
      >
        <Activity className="w-8 h-8 mb-2 opacity-70" aria-hidden="true" />
        <span className="text-xs font-medium tracking-tight max-w-[180px] opacity-80">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={lazy ? 'lazy' : 'eager'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
