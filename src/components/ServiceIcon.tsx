import {
  Activity,
  ClipboardCheck,
  Dumbbell,
  Footprints,
  HeartHandshake,
  Move,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Waves,
  Zap,
} from 'lucide-react';

export function ServiceIcon({
  name,
  className = 'w-5 h-5',
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case 'HeartHandshake':
      return <HeartHandshake className={className} aria-hidden="true" />;
    case 'Move':
      return <Move className={className} aria-hidden="true" />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'Sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'ClipboardCheck':
      return <ClipboardCheck className={className} aria-hidden="true" />;
    case 'Footprints':
      return <Footprints className={className} aria-hidden="true" />;
    case 'Waves':
      return <Waves className={className} aria-hidden="true" />;
    case 'Zap':
      return <Zap className={className} aria-hidden="true" />;
    case 'SunMedium':
      return <SunMedium className={className} aria-hidden="true" />;
    case 'Dumbbell':
      return <Dumbbell className={className} aria-hidden="true" />;
    case 'Activity':
    default:
      return <Activity className={className} aria-hidden="true" />;
  }
}
