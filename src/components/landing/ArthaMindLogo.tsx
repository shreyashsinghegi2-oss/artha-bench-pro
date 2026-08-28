import React from 'react';

type Props = { className?: string; compact?: boolean };

export const ArthaMindLogo: React.FC<Props> = ({ className = '', compact = false }) => (
  <svg
    viewBox="0 0 120 120"
    role="img"
    aria-label="ArthaMind AI symbol"
    className={className}
  >
    <defs>
      <linearGradient id="artha-core" x1="24" y1="18" x2="96" y2="102" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5EEAD4" />
        <stop offset="1" stopColor="#38BDF8" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="48" fill="#08111D" stroke="#1E3A46" strokeWidth="2" />
    <path d="M35 86 58 31h8l21 55" fill="none" stroke="url(#artha-core)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M45 66h32" stroke="#D8FFF7" strokeWidth="6" strokeLinecap="round" />
    <path d="M83 40v11M83 44h8v20M91 53h8v16" stroke="#5EEAD4" strokeWidth="3" strokeLinecap="round" />
    <circle cx="31" cy="45" r="4" fill="#5EEAD4" />
    <circle cx="95" cy="82" r="4" fill="#38BDF8" />
    <circle cx="24" cy="79" r="3" fill="#94A3B8" />
    <path d="M35 48 31 45M82 79l13 3M39 83l-15-4" stroke="#5E7385" strokeWidth="2" strokeLinecap="round" />
    {!compact && <circle cx="60" cy="60" r="54" fill="none" stroke="#5EEAD4" strokeOpacity=".12" strokeWidth="2" strokeDasharray="4 8" />}
  </svg>
);
