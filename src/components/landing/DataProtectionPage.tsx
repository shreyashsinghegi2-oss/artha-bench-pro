import React from 'react';
import { ArrowLeft, Download, FileText, LifeBuoy, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { ArthaMindMark } from './ArthaMindMark';
import { LandingSecurity } from './LandingSecurity';
import './connectedLanding.css';
import './landingMotion.css';
import './dataProtection.css';

const RIGHTS = [
  { icon: UserCheck, title: 'Know what we hold', text: 'See every record saved to your account from the Account page.' },
  { icon: Download, title: 'Take it with you', text: 'Export your saved workspace data as a file whenever you want.' },
  { icon: Trash2, title: 'Delete it', text: 'Delete saved records, or request deletion of your whole account, from Account.' },
  { icon: ShieldCheck, title: 'Withdraw consent', text: 'Turn ArthaMind access to each data category off at any time. It is off until you switch it on.' },
];

/** Standalone data-protection page: where data goes, what protects it, and the controls a person keeps. */
const DataProtectionPage: React.FC<{ onHome: () => void; onSignIn: () => void; signedIn: boolean }> = ({ onHome, onSignIn, signedIn }) => (
  <div className="connected-landing dp-page">
    <header className="cl-header is-scrolled">
      <div className="cl-wrap cl-nav">
        <a href="/" className="cl-brand" onClick={(e) => { e.preventDefault(); onHome(); }} aria-label="ArthaMind home">
          <ArthaMindMark size={34} />
          <span className="am-brand-text"><b>ArthaMind</b><small>by Artha Bench Pro</small></span>
        </a>
        <div className="cl-right">
          <button type="button" className="cl-signin" onClick={onHome}><ArrowLeft size={15} aria-hidden="true" /> Home</button>
          {!signedIn && <button type="button" className="cl-signin" onClick={onSignIn}>Sign in</button>}
        </div>
      </div>
    </header>
    <main>
      <section className="cl-section dp-hero">
        <div className="cl-wrap">
          <div className="cl-eyebrow">Data protection</div>
          <h1>How ArthaMind protects your personal data.</h1>
          <p className="cl-sub">Plain answers to three questions: where your numbers go, what protects them, and what you can do about it at any time. We follow the principles of India’s Digital Personal Data Protection Act, 2023: collect only what is needed, use it only for the purpose you gave it, and let you see, correct and erase it.</p>
        </div>
      </section>
      <LandingSecurity />
      <section className="cl-section dp-rights" aria-labelledby="dp-rights-title">
        <div className="cl-wrap">
          <div className="cl-eyebrow">Your rights</div>
          <h2 id="dp-rights-title">Controls you keep, without asking anyone.</h2>
          <ul className="dp-grid">
            {RIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title}><Icon size={20} aria-hidden="true" /><b>{title}</b><p>{text}</p></li>
            ))}
          </ul>
          <div className="dp-links">
            <a href="/privacy.html"><FileText size={16} aria-hidden="true" /> Privacy policy</a>
            <a href="/terms.html"><FileText size={16} aria-hidden="true" /> Terms of use</a>
            <a href="/support"><LifeBuoy size={16} aria-hidden="true" /> Raise a privacy question</a>
          </div>
        </div>
      </section>
    </main>
    <footer className="cl-footer"><div className="cl-wrap"><b>ArthaMind</b><span>Not investment, tax, legal or lending advice. See our <a href="/terms.html">Terms &amp; conditions</a>.</span></div></footer>
  </div>
);

export default DataProtectionPage;
