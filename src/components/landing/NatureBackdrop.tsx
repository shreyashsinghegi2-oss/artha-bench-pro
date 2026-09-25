import React, { useEffect, useRef } from 'react';
import './natureBackdrop.css';

const RIDGE_FAR = 'M0 560 L120 470 L210 520 L330 420 L450 510 L560 440 L690 530 L820 430 L930 500 L1060 410 L1190 500 L1300 450 L1440 520 L1440 900 L0 900 Z';
const RIDGE_MID = 'M0 640 L90 580 L200 620 L320 540 L430 610 L540 560 L660 630 L780 560 L900 620 L1010 570 L1140 640 L1250 590 L1350 620 L1440 580 L1440 900 L0 900 Z';
const HILLS = 'M0 740 Q180 680 360 720 T720 710 T1080 730 T1440 700 L1440 900 L0 900 Z';

/** One landscape layer: its own element, so moving it never repaints the rest of the scene. */
const Layer: React.FC<{ className: string; children: React.ReactNode }> = ({ className, children }) =>
  <div className={`nb-layer ${className}`}><svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">{children}</svg></div>;

const Cloud: React.FC<{ className: string; w: number }> = ({ className, w }) =>
  <div className={`nb-cloud ${className}`} style={{ width: w }}><svg viewBox="0 0 300 70"><g fill="#fff"><ellipse cx="150" cy="44" rx="140" ry="24"/><ellipse cx="200" cy="30" rx="80" ry="28"/><ellipse cx="96" cy="34" rx="62" ry="22"/></g></svg></div>;

/**
 * A living landscape behind the hero: dawn sky, a glowing sun, drifting clouds, three mountain
 * ridges, rolling mist and birds. Every moving part is a separate layer animated with transforms
 * only, so the graphics chip moves it without redrawing; no images are downloaded. It pauses
 * off-screen and stays still for people who prefer reduced motion.
 */
export const NatureBackdrop: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle('nb-paused', !e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="nb" aria-hidden="true">
    <div className="nb-sky"/>
    <div className="nb-sun"><i/></div>
    <Cloud className="nb-c1" w={300}/><Cloud className="nb-c2" w={380}/><Cloud className="nb-c3" w={240}/>
    <div className="nb-birds"><svg viewBox="-30 -36 100 44"><g fill="none" stroke="#3b4a52" strokeWidth="2.2" strokeLinecap="round"><path d="M0 0 q8 -7 16 0 q8 -7 16 0"/><path d="M40 -18 q6 -5 12 0 q6 -5 12 0" opacity=".8"/><path d="M-26 -30 q5 -4 10 0 q5 -4 10 0" opacity=".7"/></g></svg></div>
    <Layer className="nb-far"><defs><linearGradient id="nb-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9cfd6"/><stop offset="1" stopColor="#dfe8e6"/></linearGradient></defs><path fill="url(#nb-far)" d={RIDGE_FAR}/></Layer>
    <div className="nb-mist nb-m1"/>
    <Layer className="nb-mid"><defs><linearGradient id="nb-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fa8a3"/><stop offset="1" stopColor="#a9c6bd"/></linearGradient></defs><path fill="url(#nb-mid)" d={RIDGE_MID}/></Layer>
    <div className="nb-mist nb-m2"/>
    <Layer className="nb-near"><defs><linearGradient id="nb-near" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f7d6e"/><stop offset="1" stopColor="#2c5f53"/></linearGradient></defs><path fill="url(#nb-near)" d={HILLS}/>
      <g fill="#244f45">{[60, 110, 150, 1250, 1300, 1345, 1390].map((x, i) => <path key={x} d={`M${x} ${735 - (i % 2) * 8} l14 -${34 + (i % 3) * 6} l14 ${34 + (i % 3) * 6} z`}/>)}</g></Layer>
    <div className="nb-fade"/>
  </div>;
};
