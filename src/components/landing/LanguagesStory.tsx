import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import './languagesStory.css';

/** Line drawings of a landmark for each language, in a 200 x 160 box. Strokes use currentColor. */
const ART: Record<string, React.ReactNode> = {
  hindi: <><path d="M20 150h160" /><path d="M58 150V64h84v86h-18v-50a24 24 0 0 0-48 0v50z" /><path d="M52 64h96V50H52z" /><path d="M64 50v-8h72v8" /><path d="M88 42a12 12 0 0 1 24 0" /><path d="M66 78h10M124 78h10M66 92h10M124 92h10" /></>,
  bengali: <><path d="M10 112h180" /><path d="M46 150V36M58 150V36M142 150V36M154 150V36" /><path d="M46 36h12M142 36h12" /><path d="M58 40Q100 98 142 40" /><path d="M10 70Q30 96 46 104M190 70Q170 96 154 104" /><path d="M66 56l10 56M86 72l4 40M114 72l-4 40M134 56l-10 56" /><path d="M10 132q10-6 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0" /></>,
  marathi: <><path d="M20 150h160" /><path d="M40 150V62h120v88" /><path d="M84 150v-44a16 16 0 0 1 32 0v44" /><path d="M50 108a8 8 0 0 1 16 0v42M134 108a8 8 0 0 1 16 0v42" /><path d="M40 62h120M46 52h108v10" /><path d="M44 52q6-18 12 0M144 52q6-18 12 0M88 52q12-24 24 0" /><path d="M10 156q8-4 16 0t16 0 16 0" /></>,
  telugu: <><path d="M20 150h160" /><path d="M50 150V56M66 150V56M134 150V56M150 150V56" /><path d="M50 56q8-22 16 0M134 56q8-22 16 0" /><path d="M58 34v-8M142 34v-8" /><path d="M66 82h68" /><path d="M66 150v-36a34 34 0 0 1 68 0v36" /><path d="M78 82v-14h44v14" /><path d="M50 76h16M134 76h16M50 104h16M134 104h16" /></>,
  tamil: <><path d="M20 150h160" /><path d="M44 150l8-26h96l8 26" /><path d="M54 124l7-24h78l7 24" /><path d="M62 100l7-22h62l7 22" /><path d="M70 78l6-20h48l6 20" /><path d="M78 58l5-16h34l5 16" /><path d="M84 42q16-14 32 0" /><path d="M92 150v-18h16v18" /><path d="M100 28v-8" /></>,
  gujarati: <><path d="M20 150h160" /><path d="M48 150v-34h104v34" /><path d="M60 116q0-40 40-76 40 36 40 76" /><path d="M76 116q0-24 24-48 24 24 24 48" /><path d="M100 40V24" /><path d="M96 24h10l-4 6" /><path d="M64 132h72M90 150v-18h20v18" /></>,
  urdu: <><path d="M20 150h160" /><path d="M56 150V90h88v60" /><path d="M64 90q0-46 36-56 36 10 36 56" /><path d="M100 34V20" /><path d="M86 150v-30a14 14 0 0 1 28 0v30" /><path d="M34 150V58M46 150V58M154 150V58M166 150V58" /><path d="M34 58q6-14 12 0M154 58q6-14 12 0" /><path d="M34 90h12M154 90h12" /></>,
  kannada: <><path d="M14 150h172" /><path d="M24 150V96h152v54" /><path d="M24 96h152M30 88h140v8" /><path d="M38 150v-46M54 150v-46M70 150v-46M130 150v-46M146 150v-46M162 150v-46" /><path d="M80 88V66h40v22" /><path d="M82 66q18-34 36 0" /><path d="M100 32V22" /><path d="M86 150v-30h28v30" /></>,
  malayalam: <><path d="M6 140q10-6 20 0t20 0 20 0 20 0 20 0 20 0 20 0 20 0 20 0" /><path d="M48 124h104l-10 14H58z" /><path d="M56 124q4-30 44-34 40 4 44 34" /><path d="M72 124v-20M100 124V92M128 124v-20" /><path d="M24 130Q30 80 40 44" /><path d="M40 44q-22 0-30 14M40 44q-6-18-26-18M40 44q18-8 32 6M40 44q10-16 30-12" /><path d="M172 130q-4-40-14-70" /><path d="M158 60q14-6 26 6M158 60q-4-16-22-16M158 60q-18 0-24 14" /></>,
  punjabi: <><path d="M6 132h188" /><path d="M58 132V84h84v48" /><path d="M70 84q0-32 30-42 30 10 30 42" /><path d="M100 42V28" /><path d="M58 84h84M66 132v-30M134 132v-30" /><path d="M88 132v-22a12 12 0 0 1 24 0v22" /><path d="M58 84q-6-12 0-20M142 84q6-12 0-20" /><path d="M70 144h60M80 152h40" opacity=".55" /></>,
  odia: <><circle cx="100" cy="84" r="58" /><circle cx="100" cy="84" r="46" /><circle cx="100" cy="84" r="10" /><path d="M100 26v116M42 84h116M59 43l82 82M141 43l-82 82" /><path d="M100 38v-4M146 84h4" /><path d="M20 150h160" /></>,
  assamese: <><path d="M10 150h180" /><path d="M10 120q40-46 90-30t90-10" /><path d="M10 150q50-34 100-24t80-6" /><path d="M24 132q20-6 40 0M74 120q20-6 40 0M124 116q20-6 40 0M40 142q20-6 40 0M100 136q20-6 40 0" /><circle cx="150" cy="44" r="16" /><path d="M150 16v6M178 44h-6M170 24l-4 4" /></>,
  hinglish: <><path d="M10 150h180" /><path d="M24 150V92h22v58M52 150V66h26v84M84 150V80h18v70M108 150V54h28v96M142 150V86h20v64M166 150V100h18v50" /><path d="M58 76h14M58 90h14M58 104h14M114 66h16M114 80h16M114 94h16" /><path d="M118 14h64a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-44l-12 10v-10h-8a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" /><path d="M128 28h44M128 38h28" /></>,
};

/** The 13 Indian languages the AI CFO answers in, with an everyday finance question in each. */
const LANGUAGES = [
  { key: 'hindi', script: 'हिन्दी', name: 'Hindi', bg: '#fbe6d4', ink: '#9a3d12', ask: 'मेरी EMI ज़्यादा है?' },
  { key: 'bengali', script: 'বাংলা', name: 'Bengali', bg: '#f6ecc8', ink: '#2f7a3b', ask: 'কত টাকা SIP করব?' },
  { key: 'marathi', script: 'मराठी', name: 'Marathi', bg: '#e3ecf7', ink: '#1f4d8f', ask: 'कर कसा वाचवू?' },
  { key: 'telugu', script: 'తెలుగు', name: 'Telugu', bg: '#efdcef', ink: '#7a2f7d', ask: 'లోన్ ముందే కట్టాలా?' },
  { key: 'tamil', script: 'தமிழ்', name: 'Tamil', bg: '#fde3d8', ink: '#b2401e', ask: 'ஓய்வுக்கு எவ்வளவு?' },
  { key: 'gujarati', script: 'ગુજરાતી', name: 'Gujarati', bg: '#f5d9cc', ink: '#8b3a1d', ask: 'ટેક્સ કેટલો બચે?' },
  { key: 'urdu', script: 'اردو', name: 'Urdu', bg: '#dceee6', ink: '#1d6b52', ask: 'بچت کیسے کروں؟' },
  { key: 'kannada', script: 'ಕನ್ನಡ', name: 'Kannada', bg: '#d6ebf2', ink: '#1b5f7c', ask: 'ಉಳಿತಾಯ ಎಷ್ಟು?' },
  { key: 'malayalam', script: 'മലയാളം', name: 'Malayalam', bg: '#ddf1ea', ink: '#14634c', ask: 'എമർജൻസി ഫണ്ട് എത്ര?' },
  { key: 'punjabi', script: 'ਪੰਜਾਬੀ', name: 'Punjabi', bg: '#fbeccb', ink: '#9a6a0f', ask: 'ਘਰ ਦਾ ਲੋਨ ਕਿਵੇਂ?' },
  { key: 'odia', script: 'ଓଡ଼ିଆ', name: 'Odia', bg: '#f0e1d2', ink: '#7c4a1e', ask: 'ଟିକସ କେତେ?' },
  { key: 'assamese', script: 'অসমীয়া', name: 'Assamese', bg: '#e1efd8', ink: '#3d6b1f', ask: 'সঞ্চয় কিমান?' },
  { key: 'hinglish', script: 'Hinglish', name: 'Roman Hindi + English', bg: '#1a1f1d', ink: '#7be0a0', ask: 'SIP kitna karun?' },
] as const;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

type Props = { ctaLabel: string; onCta: () => void; autoPrompt?: boolean };

/**
 * "Finance simplified, in your language": a row of language cards that slides sideways as the visitor
 * scrolls, curving like the inside of a drum. Reaching the end opens sign-up once per visit.
 */
export const LanguagesStory: React.FC<Props> = ({ ctaLabel, onCta, autoPrompt }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const latest = useRef({ onCta, autoPrompt });
  latest.current = { onCta, autoPrompt };

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;
    let frame = 0;
    let prompted = false;
    const paint = () => {
      frame = 0;
      const vw = window.innerWidth;
      const rect = section.getBoundingClientRect();
      const range = section.offsetHeight - window.innerHeight;
      const p = range > 0 ? clamp(-rect.top / range) : 0;
      if (!reduced) {
        const width = track.scrollWidth;
        const t = clamp((p - 0.04) / 0.86);
        const x = vw * 0.12 + (vw * 0.88 - width - vw * 0.12) * t;
        const tilt = vw < 720 ? -14 : -24;
        track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
        for (const card of Array.from(track.children) as HTMLElement[]) {
          const centre = x + card.offsetLeft + card.offsetWidth / 2;
          const d = clamp((centre - vw / 2) / (vw / 2), -1.5, 1.5);
          card.style.transform = `rotateY(${(d * tilt).toFixed(2)}deg) scale(${(1 + Math.abs(d) * 0.1).toFixed(3)})`;
        }
      }
      if (p > 0.97 && !prompted && latest.current.autoPrompt) {
        prompted = true;
        let seen = false;
        try { seen = sessionStorage.getItem('am-signup-prompted') === '1'; sessionStorage.setItem('am-signup-prompted', '1'); } catch { /* storage blocked */ }
        if (!seen) latest.current.onCta();
      }
    };
    const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    return () => { window.removeEventListener('scroll', request); window.removeEventListener('resize', request); if (frame) cancelAnimationFrame(frame); };
  }, [reduced]);

  return (
    <section id="languages" ref={sectionRef} className={`ls-section ${reduced ? 'is-static' : ''}`} aria-labelledby="ls-title">
      <div className="ls-stage">
        <div className="ls-head">
          <h2 id="ls-title">Finance simplified, in your language</h2>
          <p>Ask by voice or text in 13 Indian languages, including Hinglish. Answers come back in the same language.</p>
          <button type="button" className="ls-cta" onClick={onCta}>{ctaLabel} <ArrowRight size={16} /></button>
        </div>
        <div className="ls-viewport">
          <div ref={trackRef} className="ls-track">
            {LANGUAGES.map((lang) => (
              <figure key={lang.key} className="ls-card" style={{ '--bg': lang.bg, '--ink': lang.ink } as React.CSSProperties}>
                <figcaption><b lang={lang.key === 'hinglish' ? 'en' : undefined}>{lang.script}</b><small>{lang.name}</small></figcaption>
                <svg viewBox="0 0 200 160" aria-hidden="true">{ART[lang.key]}</svg>
                <span className="ls-ask" dir="auto">{lang.ask}</span>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
