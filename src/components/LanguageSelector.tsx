import React, { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  ['en', 'English'],
  ['hi', 'हिन्दी'],
  ['mr', 'मराठी'],
  ['gu', 'ગુજરાતી'],
  ['bn', 'বাংলা'],
  ['ta', 'தமிழ்'],
  ['te', 'తెలుగు'],
  ['kn', 'ಕನ್ನಡ'],
  ['ml', 'മലയാളം'],
  ['pa', 'ਪੰਜਾਬੀ'],
  ['ur', 'اردو'],
  ['or', 'ଓଡ଼ିଆ'],
  ['as', 'অসমীয়া'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['ar', 'العربية'],
  ['pt', 'Português'],
  ['it', 'Italiano'],
  ['ja', '日本語'],
] as const;

type GoogleTranslateElementConstructor = new (
  options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
  element: HTMLElement,
) => unknown;

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: GoogleTranslateElementConstructor;
      };
    };
    arthaGoogleTranslateInit?: () => void;
  }
}

function setEnglishCookie() {
  document.cookie = 'googtrans=/en/en;path=/;max-age=31536000';
}

function setGoogleLanguageCookie(code: string) {
  document.cookie = `googtrans=/en/${code};path=/;max-age=31536000`;
}

function applyGoogleLanguage(code: string) {
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!select) return false;

  select.value = code;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function hideGoogleChrome() {
  document.querySelectorAll('.goog-te-banner-frame, .goog-te-balloon-frame').forEach((node) => {
    (node as HTMLElement).style.display = 'none';
  });
  document.querySelectorAll('.skiptranslate').forEach((node) => {
    const element = node as HTMLElement;
    if (element.querySelector('.goog-te-gadget') || element.classList.contains('goog-te-banner-frame')) {
      element.style.display = 'none';
    }
  });
  document.body.style.top = '0px';
  document.body.style.marginTop = '0px';
}

function ensureGoogleTranslateWidget() {
  const TranslateElement = window.google?.translate?.TranslateElement;
  if (!TranslateElement) return false;

  let host = document.querySelector<HTMLElement>('.artha-google-widget');
  if (!host) {
    host = document.createElement('div');
    host.className = 'artha-google-widget';
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '-10000px';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.overflow = 'hidden';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
  }

  if (!host.dataset.initialized) {
    new TranslateElement(
      {
        pageLanguage: 'en',
        includedLanguages: SUPPORTED_LANGUAGES.map(([code]) => code)
          .filter((code) => code !== 'en')
          .join(','),
        autoDisplay: false,
      },
      host,
    );
    host.dataset.initialized = 'true';
  }

  return true;
}

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  // Landing language is intentionally ephemeral: every fresh load starts in English.
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.removeItem('artha-bench-global-language');
    setEnglishCookie();
    document.documentElement.lang = 'en';

    const style = document.createElement('style');
    style.id = 'artha-google-translate-cleanup';
    style.textContent = `
      .goog-te-banner-frame,
      .goog-te-balloon-frame,
      .goog-tooltip,
      .goog-tooltip:hover,
      .goog-text-highlight,
      .skiptranslate > iframe { display: none !important; }
      body { top: 0 !important; margin-top: 0 !important; }
      html { top: 0 !important; }
    `;
    document.head.appendChild(style);

    const init = () => {
      ensureGoogleTranslateWidget();
      hideGoogleChrome();
    };

    window.arthaGoogleTranslateInit = init;

    if (!document.getElementById('artha-google-translate')) {
      const script = document.createElement('script');
      script.id = 'artha-google-translate';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=arthaGoogleTranslateInit';
      script.async = true;
      document.head.appendChild(script);
    }

    const observer = new MutationObserver(() => hideGoogleChrome());
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const timer = window.setInterval(() => {
      init();
      if (document.querySelector<HTMLSelectElement>('.goog-te-combo')) {
        window.clearInterval(timer);
      }
    }, 300);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      style.remove();
    };
  }, []);

  const change = (code: string) => {
    setLanguage(code);
    document.documentElement.lang = code;
    setGoogleLanguageCookie(code);
    ensureGoogleTranslateWidget();

    // Google Translate can load its hidden select asynchronously. Retry briefly so
    // choosing a language always applies even when the user selects immediately.
    const attempts = [0, 200, 500, 900, 1500, 2200];
    attempts.forEach((delay) => {
      window.setTimeout(() => {
        ensureGoogleTranslateWidget();
        applyGoogleLanguage(code);
        hideGoogleChrome();
      }, delay);
    });
  };

  const currentName = SUPPORTED_LANGUAGES.find(([code]) => code === language)?.[1] || 'English';

  return (
    <div className="relative flex items-center" title={`Language: ${currentName}`}>
      <Languages
        className="pointer-events-none absolute left-2.5 h-4 w-4 text-secondary"
        aria-hidden="true"
      />
      <label className="sr-only" htmlFor="artha-global-language">
        Select language
      </label>
      <select
        id="artha-global-language"
        value={language}
        onChange={(event) => change(event.target.value)}
        className={`appearance-none rounded-xl border border-line bg-surface pl-8 pr-7 text-xs font-bold text-ink outline-none transition hover:border-interactive/50 focus:border-interactive focus:ring-2 focus:ring-interactive/20 ${
          compact ? 'h-9 w-[120px]' : 'h-10 w-[150px]'
        }`}
      >
        {SUPPORTED_LANGUAGES.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};
