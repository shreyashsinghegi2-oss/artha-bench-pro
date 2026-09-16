import React, { useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';

type Language = { code: string; label: string; available: boolean };

const languages: Language[] = [
  { code: 'en', label: 'English', available: true },
  { code: 'hi', label: 'हिन्दी (Hindi)', available: false },
  { code: 'mr', label: 'मराठी (Marathi)', available: false },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)', available: false },
  { code: 'bn', label: 'বাংলা (Bengali)', available: false },
  { code: 'ta', label: 'தமிழ் (Tamil)', available: false },
  { code: 'te', label: 'తెలుగు (Telugu)', available: false },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)', available: false },
  { code: 'ml', label: 'മലയാളം (Malayalam)', available: false },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)', available: false },
  { code: 'ur', label: 'اردو (Urdu)', available: false },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)', available: false },
  { code: 'as', label: 'অসমীয়া (Assamese)', available: false },
  { code: 'es', label: 'Español', available: false },
  { code: 'fr', label: 'Français', available: false },
  { code: 'de', label: 'Deutsch', available: false },
  { code: 'ar', label: 'العربية (Arabic)', available: false },
  { code: 'pt', label: 'Português', available: false },
  { code: 'it', label: 'Italiano', available: false },
  { code: 'ja', label: '日本語 (Japanese)', available: false },
];

export const LandingLanguageSelector: React.FC = () => {
  // Deliberately ephemeral: never read/write localStorage, cookies, URL params,
  // global language state, or the workspace preference.
  const [selected, setSelected] = useState('en');
  const [open, setOpen] = useState(false);
  const current = languages.find((language) => language.code === selected) ?? languages[0];

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Landing page language: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Landing page languages"
          className="absolute right-0 top-[calc(100%+8px)] z-[70] max-h-[min(70vh,420px)] w-64 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          {languages.map((language) => (
            <button
              key={language.code}
              type="button"
              role="option"
              aria-selected={selected === language.code}
              disabled={!language.available}
              title={language.available ? `Use ${language.label}` : 'Approved landing-page translation is not available yet'}
              onClick={() => {
                if (!language.available) return;
                setSelected(language.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700 ${selected === language.code ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'} ${!language.available ? 'cursor-not-allowed opacity-45' : ''}`}
            >
              <span>{language.label}</span>
              {!language.available && <span className="ml-2 text-[9px] font-bold uppercase tracking-[.08em] text-slate-400">Soon</span>}
            </button>
          ))}
          <p className="px-3 pb-1 pt-2 text-[9px] leading-4 text-slate-400">
            English is the landing default. Other languages appear when complete, approved landing translations are available.
          </p>
        </div>
      )}
    </div>
  );
};
