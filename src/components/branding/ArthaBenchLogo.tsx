import React from 'react';

interface ArthaBenchLogoProps {
  iconOnly?: boolean;
  className?: string;
  compact?: boolean;
}

export const ArthaBenchMark: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => (
  <svg
    viewBox="0 0 48 48"
    className={className}
    role="img"
    aria-label="Artha Bench logo"
  >
    <defs>
      <linearGradient id="artha-bench-logo-gradient" x1="5" y1="43" x2="43" y2="5" gradientUnits="userSpaceOnUse">
        <stop stopColor="var(--brand-primary, #2BC49A)" />
        <stop offset="0.52" stopColor="var(--interactive, #60A5FA)" />
        <stop offset="1" stopColor="#7C6CFF" />
      </linearGradient>
    </defs>
    <path
      d="M24 4.5 40.5 11v11.6c0 10.4-6.3 17.3-16.5 20.9C13.8 39.9 7.5 33 7.5 22.6V11L24 4.5Z"
      fill="color-mix(in srgb, var(--bg-surface, #0D1726) 90%, transparent)"
      stroke="url(#artha-bench-logo-gradient)"
      strokeWidth="2.2"
    />
    <path
      d="m13.3 30.8 7.1-13.6 4.4 8.2 3.2-5.6 6.7 11"
      fill="none"
      stroke="url(#artha-bench-logo-gradient)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="20.4" cy="17.2" r="2.1" fill="var(--brand-primary, #2BC49A)" />
    <circle cx="28" cy="19.8" r="2.1" fill="var(--interactive, #60A5FA)" />
    <circle cx="34.7" cy="30.8" r="2.1" fill="#7C6CFF" />
    <path d="M15 34.7h18" stroke="var(--border-strong, #36506D)" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const ArthaBenchLogo: React.FC<ArthaBenchLogoProps> = ({
  iconOnly = false,
  className = '',
  compact = false,
}) => (
  <div className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
    <div className="flex shrink-0 items-center justify-center rounded-2xl border border-interactive/20 bg-surface shadow-sm">
      <ArthaBenchMark className={compact ? 'h-8 w-8' : 'h-10 w-10'} />
    </div>
    {!iconOnly && (
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-2">
          <span className={`${compact ? 'text-sm' : 'text-base'} font-black tracking-tight text-ink whitespace-nowrap`}>
            Artha Bench
          </span>
          <span className="rounded-full border border-premium-fill/30 bg-premium-soft px-2 py-0.5 text-[8px] font-black tracking-[0.14em] text-premium">
            PRO V2.0
          </span>
        </div>
        {!compact && (
          <p className="mt-1 text-[9px] font-semibold tracking-wide text-secondary">
            Financial Intelligence · Reliability · AI
          </p>
        )}
      </div>
    )}
  </div>
);
