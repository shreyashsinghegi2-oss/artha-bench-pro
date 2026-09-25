import React, { useEffect, useRef } from 'react';
import { Calculator, CheckCircle2, Database, EyeOff, KeyRound, LockKeyhole, ServerCog, ShieldCheck, Smartphone, Trash2, XCircle } from 'lucide-react';
import './landingSecurity.css';

/** Each stage is something the product actually does; wording is kept to what is true. */
const STAGES = [
  { icon: Smartphone, title: 'On your phone', text: 'Your portfolio and money profile stay in your own browser. Tax, SIP, EMI, XIRR and health scores are worked out right there with tested maths formulas.' },
  { icon: LockKeyhole, title: 'Locked in transit', text: 'Anything that leaves your device travels over encrypted HTTPS, the same protection banks use for their websites.' },
  { icon: Database, title: 'Your private vault', text: 'Records you save to an account are stored encrypted by our database provider, and database rules let only your signed-in account read them.' },
  { icon: EyeOff, title: 'AI sees only what you ask', text: 'The AI gets the question you type. Sharing your personal records with it is off by default, category by category, until you switch it on.' },
];

const NEVER = [
  'Ask for bank passwords, card PINs or OTPs',
  'Place trades or move your money',
  'Sell your data or show you ads based on it',
];
const ALWAYS = [
  'Show the formula and working behind every number',
  'Let you export or delete your data from Account',
  'Keep public tools usable without an account',
];

export const LandingSecurity: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { el?.classList.add('ls-on'); return; }
    const io = new IntersectionObserver(([e]) => { el.classList.toggle('ls-on', e.isIntersecting); }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <section ref={ref} id="security" className="cl-section ls" aria-labelledby="ls-title">
  <div className="cl-wrap">
    <div className="cl-eyebrow">Data security</div>
    <h2 id="ls-title">Your money data stays yours.</h2>
    <p className="cl-sub">Here is exactly where your numbers go, and what protects them at every step. The AI explains; the maths does the work.</p>

    <div className="ls-flow" role="list">
      {STAGES.map((s, i) => { const Icon = s.icon; return <React.Fragment key={s.title}>
        <article className="ls-stage" role="listitem" style={{ '--i': i } as React.CSSProperties}>
          <span className="ls-icon"><Icon size={22}/></span>
          <b>{s.title}</b>
          <p>{s.text}</p>
        </article>
        {i < STAGES.length - 1 && <span className="ls-link" aria-hidden="true"><i className="ls-packet"><LockKeyhole size={11}/></i></span>}
      </React.Fragment>; })}
    </div>

    <div className="ls-maths" aria-hidden="true">
      <span><Calculator size={16}/> Your numbers</span><em>→</em><span className="ls-calc">EMI = P·r·(1+r)<sup>n</sup> ÷ ((1+r)<sup>n</sup> − 1)</span><em>→</em><span><ShieldCheck size={16}/> Checked result</span><em>→</em><span><ServerCog size={16}/> AI explains it in your language</span>
    </div>

    <div className="ls-lists">
      <div className="ls-list never"><h3><XCircle size={18}/> ArthaMind never</h3><ul>{NEVER.map((t) => <li key={t}>{t}</li>)}</ul></div>
      <div className="ls-list always"><h3><CheckCircle2 size={18}/> ArthaMind always</h3><ul>{ALWAYS.map((t) => <li key={t}>{t}</li>)}</ul></div>
      <div className="ls-list you"><h3><KeyRound size={18}/> You stay in control</h3><ul>
        <li>Clear your device data anytime from Portfolio or Settings</li>
        <li><Trash2 size={13}/> Delete saved records or request account deletion in Account</li>
        <li>Turn AI access to each category on or off</li>
      </ul></div>
    </div>
    <p className="ls-fine">No online service can promise zero risk. We keep the data we hold to the minimum, protect it with encryption and access rules, and never ask for the details that could move your money.</p>
  </div>
</section>;
};
