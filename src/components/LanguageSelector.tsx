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

declare global {
  interface Window {
    google?: any;
    arthaGoogleTranslateInit?: () => void;
  }
}

const STORAGE_KEY = 'artha-bench-global-language';

function setEnglishCookie() {
  document.cookie = 'googtrans=/en/en;path=/;max-age=31536000';
}

function applyGoogleLanguage(code: string) {
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (!select) return false;

  select.value = code === 'en' ? 'en' : code;
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

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  // Every fresh website visit starts in English. The selected language is intentionally
  // session-only so a refresh/new visit never unexpectedly opens in another language.
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Clear the old persisted language and force the initial page language to English.
    window.localStorage.removeItem(STORAGE_KEY);
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
      if (!window.google?.translate?.TranslateElement || document.querySelector('.artha-google-widget')) {
        hideGoogleChrome();
        return;
      }

      const host = document.createElement('div');
      host.className = 'artha-google-widget';
      host.style.display = 'none';
      host.setAttribute('aria-hidden', 'true');
      document.body.appendChild(host);

      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: SUPPORTED_LANGUAGES.map(([code]) => code)
            .filter((code) => code !== 'en')
            .join(','),
          autoDisplay: false,
        },
        host,
      );

      window.setTimeout(hideGoogleChrome, 50);
      window.setTimeout(hideGoogleChrome, 500);
      window.setTimeout(hideGoogleChrome, 1500);
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
      hideGoogleChrome();
      if (window.google?.translate?.TranslateElement) window.clearInterval(timer);
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
    applyGoogleLanguage(code);
    hideGoogleChrome();
    window.setTimeout(() => {
      applyGoogleLanguage(code);
      hideGoogleChrome();
    }, 400);
    window.setTimeout(() => {
      applyGoogleLanguage(code);
      hideGoogleChrome();
    }, 1200);
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
