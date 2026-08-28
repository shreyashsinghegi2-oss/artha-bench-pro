import React from 'react';
import { LockKeyhole } from 'lucide-react';
import { ArthaMindLogo } from './ArthaMindLogo';

const ContextCard = ({ className, title, detail, accent = 'emerald' }: { className: string; title: string; detail: string; accent?: 'emerald' | 'blue' | 'gold' | 'violet' }) => (
  <div className={`artha-map-node ${className} rounded-xl border border-white/10 bg-[#0A1422]/95 p-3 shadow-[0_16px_45px_rgba(0,0,0,.26)]`}>
    <div className={`text-[9px] font-black uppercase tracking-[0.12em] ${accent === 'gold' ? 'text-amber-300' : accent === 'violet' ? 'text-violet-300' : accent === 'blue' ? 'text-sky-300' : 'text-emerald-300'}`}>{title}</div>
    <div className="mt-1 text-[9px] leading-4 text-slate-500">{detail}</div>
    <svg viewBox="0 0 86 22" className="mt-2 h-5 w-full" aria-hidden="true">
      <path d="M2 17 C12 12, 18 16, 27 9 S42 14, 50 7 S66 10, 84 3" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="2" className="artha-sparkline" />
    </svg>
  </div>
);

export const ArthaMindHeroVisual: React.FC = () => (
  <div className="relative mx-auto aspect-square w-full max-w-[520px]" aria-label="ArthaMind Intelligence Map">
    <div className="absolute inset-[12%] rounded-full border border-emerald-300/10 bg-emerald-300/[0.025]" />
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 520" aria-hidden="true">
      <g fill="none" stroke="#4E6677" strokeOpacity=".38" strokeWidth="1.5">
        <path className="artha-path-pulse" d="M118 120 C190 155 205 196 260 256" />
        <path className="artha-path-pulse delay-a" d="M405 118 C332 157 310 194 260 256" />
        <path className="artha-path-pulse delay-b" d="M93 312 C168 299 196 281 260 256" />
        <path className="artha-path-pulse delay-c" d="M417 314 C346 298 320 279 260 256" />
        <path className="artha-path-pulse delay-d" d="M258 104 C258 158 258 199 260 256" />
        <path className="artha-personal-link" strokeDasharray="6 7" d="M143 418 C192 367 216 324 260 256" />
        <path stroke="#5EEAD4" strokeOpacity=".36" d="M260 256 C319 266 357 286 404 370" />
      </g>
      <circle className="artha-signal-particle p1" cx="0" cy="0" r="3" fill="#5EEAD4">
        <animateMotion dur="7s" repeatCount="indefinite" path="M118 120 C190 155 205 196 260 256" />
      </circle>
      <circle className="artha-signal-particle p2" cx="0" cy="0" r="3" fill="#38BDF8">
        <animateMotion dur="8s" begin="2.5s" repeatCount="indefinite" path="M405 118 C332 157 310 194 260 256" />
      </circle>
      <circle className="artha-signal-particle p3" cx="0" cy="0" r="3" fill="#5EEAD4">
        <animateMotion dur="6.5s" begin="1.5s" repeatCount="indefinite" path="M260 256 C319 266 357 286 404 370" />
      </circle>
      <circle className="artha-personal-particle" cx="0" cy="0" r="3" fill="#5EEAD4">
        <animateMotion dur="7s" begin="4s" repeatCount="indefinite" path="M143 418 C192 367 216 324 260 256" />
      </circle>
    </svg>

    <ContextCard className="absolute left-[2%] top-[8%] w-[31%]" title="India Markets" detail="NIFTY 50 • SENSEX • RELIANCE • TCS\nPublic market context" />
    <ContextCard className="absolute right-[2%] top-[8%] w-[31%]" title="US Markets" detail="S&P 500 • NASDAQ • AAPL • NVDA\nPublic market context" accent="blue" />
    <ContextCard className="absolute left-[0%] top-[52%] w-[29%]" title="Gold / XAU" detail="Commodity signal\nIllustrative context" accent="gold" />
    <ContextCard className="absolute right-[0%] top-[52%] w-[29%]" title="Crypto" detail="BTC • ETH\nIllustrative context" accent="violet" />
    <ContextCard className="absolute left-[34%] top-[0%] w-[31%]" title="Economy" detail="CPI • RBI Rate • Fed Rate" accent="blue" />

    <div className="artha-core-node absolute left-1/2 top-1/2 w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-300/20 bg-[#07101C]/95 p-3 text-center shadow-[0_22px_70px_rgba(0,0,0,.38)]">
      <ArthaMindLogo className="mx-auto h-20 w-20" />
      <div className="mt-1 text-sm font-black">ArthaMind AI</div>
      <div className="mt-1 text-[9px] leading-4 text-slate-500">Inspectable financial reasoning</div>
    </div>

    <div className="artha-personal-node absolute bottom-[2%] left-[7%] w-[35%] rounded-xl border border-dashed border-white/15 bg-[#0A1422]/90 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Optional personal context</span>
        <LockKeyhole className="h-3.5 w-3.5 text-slate-500" />
      </div>
      <div className="mt-1 text-[9px] text-slate-600">Income • Expenses • Budget • Goals</div>
      <div className="artha-optin-chip mt-2 inline-flex rounded-full border border-white/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-slate-500">Opt-in</div>
    </div>

    <div className="absolute bottom-[6%] right-[2%] w-[33%] rounded-xl border border-sky-300/15 bg-[#0A1422]/95 p-3">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-sky-300">Artha Bench Pro</div>
      <div className="mt-1 text-[9px] text-slate-500">Evaluate • Learn • Manage</div>
    </div>

    <div className="artha-evidence-card absolute right-[24%] top-[61%] w-[34%] rounded-xl border border-white/10 bg-[#07101C]/95 p-3 shadow-[0_12px_36px_rgba(0,0,0,.3)]">
      {['Sources checked', 'Assumptions visible', 'Verification needed'].map((row, index) => (
        <div key={row} className={`artha-evidence-row row-${index + 1} flex items-center gap-2 py-1 text-[8px] text-slate-400`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/70" /> {row}
        </div>
      ))}
    </div>

    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] uppercase tracking-[0.15em] text-slate-700">Illustrative market signals • no investment advice</div>
  </div>
);
