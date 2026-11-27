import { useId } from 'react';

/** AutoScope brand mark: a scope reticle framing a bottle on a conveyor. */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  const gid = 'as-logo-bg-' + useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7d8b3f" />
          <stop offset="1" stopColor="#353c20" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill={`url(#${gid})`} />
      {/* reticle */}
      <circle cx="24" cy="22" r="13" fill="none" stroke="#f7efdc" strokeWidth="2.2" />
      <path d="M24 5.5v6M24 32.5v4M7.5 22h6M34.5 22h6" stroke="#f7efdc" strokeWidth="2.2" strokeLinecap="round" />
      {/* bottle */}
      <path d="M22.4 14.5h3.2v2.6c0 .6.4 1.1 1 1.6 1 .8 1.6 1.7 1.6 3v6.3H19.8v-6.3c0-1.3.6-2.2 1.6-3 .6-.5 1-1 1-1.6z" fill="#e2c992" />
      {/* conveyor */}
      <rect x="9" y="36.5" width="30" height="3.2" rx="1.6" fill="#d4dab0" />
      <circle cx="13" cy="38.1" r="0.9" fill="#4d5727" />
      <circle cx="24" cy="38.1" r="0.9" fill="#4d5727" />
      <circle cx="35" cy="38.1" r="0.9" fill="#4d5727" />
    </svg>
  );
}

export default function Logo({ size = 40, tagline = true, dark = false, className = '' }: { size?: number; tagline?: boolean; dark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} className="shrink-0 drop-shadow-sm" />
      <span className="leading-none">
        <span className={`block font-display font-semibold tracking-tight ${dark ? 'text-ink-50' : 'text-ink-900'}`} style={{ fontSize: size * 0.58 }}>
          Auto<span className={dark ? 'text-brand-300' : 'text-brand-600'}>Scope</span>
        </span>
        {tagline && (
          <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.18em] ${dark ? 'text-ink-300' : 'text-ink-400'}`}>Vendor-neutral advisor</span>
        )}
      </span>
    </span>
  );
}
