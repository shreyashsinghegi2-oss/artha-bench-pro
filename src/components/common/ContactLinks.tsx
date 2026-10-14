import React from 'react';
import './contactLinks.css';

export const CONTACT = {
  email: 'arthamindai@gmail.com',
  phoneDisplay: '+91 91795 57033',
  phoneTel: '+919179557033',
  whatsapp: 'https://wa.me/919179557033',
  linkedin: encodeURI('https://www.linkedin.com/in/shreyash-singh-श्रेयश्-सिंह-67a5a5385'),
};

export const mailto = (subject?: string) => `mailto:${CONTACT.email}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;

const GmailLogo = () => (
  <svg viewBox="52 42 88 66" width="28" height="21" aria-hidden="true"><path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" /><path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" /><path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" /><path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" /><path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" /></svg>
);

const PhoneLogo = () => (
  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><defs><linearGradient id="ct-ph" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5BF675" /><stop offset="1" stopColor="#0CBD2A" /></linearGradient></defs><rect width="32" height="32" rx="7.5" fill="url(#ct-ph)" /><path fill="#fff" transform="translate(5.2 5.2) scale(.9)" d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
);

const LinkedInLogo = () => (
  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect width="24" height="24" rx="4" fill="#0A66C2" /><path fill="#fff" d="M7.1 9.6H4.6V19h2.5V9.6zM5.85 8.5a1.45 1.45 0 1 0 0-2.9 1.45 1.45 0 0 0 0 2.9zM19.4 13.8c0-2.6-.56-4.4-3.6-4.4-1.46 0-2.44.8-2.84 1.56h-.04V9.6h-2.4V19h2.5v-4.65c0-1.23.23-2.42 1.75-2.42 1.5 0 1.52 1.4 1.52 2.5V19h2.5l.01-5.2z" /></svg>
);

const WhatsAppLogo = () => (
  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#25D366" /><path fill="#fff" transform="translate(5 5) scale(.9167)" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
);

/** Email, phone, WhatsApp and LinkedIn, each with its own logo and visible text that can be copied. */
export const ContactLinks: React.FC<{ className?: string; tone?: 'light' | 'dark' }> = ({ className = '', tone = 'light' }) => (
  <ul className={`ct-links ct-${tone} ${className}`.trim()} aria-label="Contact ArthaMind">
    <li><a href={mailto('Hello from the ArthaMind website')}><span className="ct-ico"><GmailLogo /></span><span><small>Email</small>{CONTACT.email}</span></a></li>
    <li><a href={`tel:${CONTACT.phoneTel}`}><span className="ct-ico"><PhoneLogo /></span><span><small>Call</small>{CONTACT.phoneDisplay}</span></a></li>
    <li><a href={CONTACT.whatsapp} target="_blank" rel="noopener noreferrer"><span className="ct-ico"><WhatsAppLogo /></span><span><small>WhatsApp</small>{CONTACT.phoneDisplay}</span></a></li>
    <li><a href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer"><span className="ct-ico"><LinkedInLogo /></span><span><small>LinkedIn</small>Shreyash Singh</span></a></li>
  </ul>
);
