import React from 'react';

/**
 * Official ArthaMind AI mark, redrawn as a vector from the brand artwork: a bold "A", three rising
 * bars inside it and a green up-trend arrow that cuts across the left leg.
 *
 * - tone "ink"   : black mark for light backgrounds (the arrow gap matches `cut`, default white)
 * - tone "light" : white mark for dark backgrounds
 * - tone "app"   : the app icon (white mark on a black rounded square)
 */
export type MarkTone = 'ink' | 'light' | 'app';

export const BRAND = { ink: '#0b0f14', green: '#1f8f4e', greenLight: '#34c46f' } as const;

export const ArthaMindLogoMark: React.FC<{ size?: number; tone?: MarkTone; cut?: string; className?: string; title?: string }> = ({ size = 32, tone = 'ink', cut, className = '', title }) => {
  const app = tone === 'app';
  const ink = tone === 'ink' ? BRAND.ink : '#ffffff';
  const gap = cut ?? (tone === 'ink' ? '#ffffff' : BRAND.ink);
  const green = tone === 'ink' ? BRAND.green : BRAND.greenLight;
  const arrow = 'M13 79 L35 61 L45 68 L67 47.5';
  return <svg className={`am-logo ${className}`.trim()} width={size} height={size} viewBox="0 0 100 100" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
    {app && <rect width="100" height="100" rx="22" fill={BRAND.ink}/>}
    <g transform={app ? 'translate(14 12) scale(.72)' : undefined}>
      <path d="M50 4 L96 93 H76 L50 40 L24 93 H4 Z" fill={ink}/>
      <rect x="37" y="82" width="6" height="11" fill={ink}/>
      <rect x="46.5" y="74" width="6" height="19" fill={ink}/>
      <rect x="56" y="66" width="6" height="27" fill={ink}/>
      <path d={arrow} fill="none" stroke={gap} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M76 37.5 L72.8 53 L60.5 42 Z" fill={gap} stroke={gap} strokeWidth="5" strokeLinejoin="round"/>
      <path d={arrow} fill="none" stroke={green} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M76 37.5 L72.8 53 L60.5 42 Z" fill={green}/>
    </g>
  </svg>;
};

/** Mark + "ArthaMind AI" wordmark, with an optional "by Artha Bench Pro" line. */
export const ArthaMindWordmark: React.FC<{ size?: number; tone?: 'ink' | 'light'; showParent?: boolean; className?: string; markTone?: MarkTone }> = ({ size = 32, tone = 'ink', showParent = true, className = '', markTone }) => {
  const ink = tone === 'ink' ? BRAND.ink : '#ffffff';
  return <span className={`am-wordmark ${className}`.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.32) }}>
    <ArthaMindLogoMark size={size} tone={markTone ?? tone} />
    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
      <span style={{ fontWeight: 800, fontSize: Math.round(size * 0.52), letterSpacing: '-0.01em', color: ink, whiteSpace: 'nowrap' }}>
        ArthaMind <span style={{ color: tone === 'ink' ? BRAND.green : BRAND.greenLight, fontSize: '0.78em', fontWeight: 800 }}>AI</span>
      </span>
      {showParent && <span className="am-wordmark-parent" style={{ fontSize: Math.max(10, Math.round(size * 0.32)), fontWeight: 500, color: tone === 'ink' ? '#6b7078' : 'rgba(255,255,255,.7)', whiteSpace: 'nowrap' }}>by Artha Bench Pro</span>}
    </span>
  </span>;
};
