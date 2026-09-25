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

/** English names, shown next to each native name so the menu stays readable in any language. */
const ENGLISH_NAME: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', ur: 'Urdu', or: 'Odia', as: 'Assamese', es: 'Spanish', fr: 'French', de: 'German', ar: 'Arabic', pt: 'Portuguese', it: 'Italian', ja: 'Japanese' };

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

/** Remove the googtrans cookie on every scope Google may have written it to (path, host, parent domain). */
function clearGoogleCookies() {
  const expired = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = ['', host, `.${host}`];
  if (parts.length > 2) domains.push(`.${parts.slice(-2).join('.')}`);
  for (const domain of domains) {
    document.cookie = `googtrans=;${expired};path=/${domain ? `;domain=${domain}` : ''}`;
  }
}

function setGoogleLanguageCookie(code: string) {
  clearGoogleCookies();
  document.cookie = `googtrans=/en/${code};path=/;max-age=31536000`;
}

const isPageTranslated = () => {
  const html = document.documentElement;
  return html.classList.contains('translated-ltr') || html.classList.contains('translated-rtl');
};

/** Ask Google Translate to show the original English page, without reloading. */
function restoreOriginal() {
  // The hidden Google banner is a same-origin iframe with a "Show original" button.
  for (const frame of Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe.goog-te-banner-frame, iframe.skiptranslate, iframe[id$=".container"]'))) {
    try {
      const button = frame.contentDocument?.querySelector<HTMLElement>('[id$=".restore"], button[id*="restore"]');
      if (button) { button.click(); return true; }
    } catch { /* cross-origin frame: try the next approach */ }
  }
  // Fallback: choosing the empty option in Google's own selector also restores the original.
  const select = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (select) {
    select.value = '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

// One language for the whole page, shared by every selector (header, menu, landing), so a selector
// that remounts shows the language the page is really in and "English" is always a real change.
let pageLanguage = 'en';
let booted = false;
const listeners = new Set<(code: string) => void>();
const setPageLanguage = (code: string) => { pageLanguage = code; listeners.forEach((fn) => fn(code)); };
/** The language the page is shown in now (e.g. 'hi'), and a way to follow changes. */
export const currentPageLanguage = () => pageLanguage;
export const onPageLanguage = (fn: (code: string) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

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
  // Every fresh load starts in English; after that all selectors share the page's language.
  const [language, setLanguage] = useState(pageLanguage);

  useEffect(() => {
    listeners.add(setLanguage);
    setLanguage(pageLanguage);
    return () => { listeners.delete(setLanguage); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || booted) return;
    booted = true;

    // Every fresh load starts in English.
    window.localStorage.removeItem('artha-bench-global-language');
    clearGoogleCookies();
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
    // Style, script and observer live for the whole page: other selectors rely on them.
  }, []);

  const change = (code: string) => {
    setPageLanguage(code);
    document.documentElement.lang = code;

    if (code === 'en') {
      clearGoogleCookies();
      // Restore the original page now; retry while Google finishes, and reload once only if the
      // page is still translated after that (the cookie is already cleared, so it loads in English).
      [0, 250, 700].forEach((delay) => window.setTimeout(() => { if (isPageTranslated()) restoreOriginal(); hideGoogleChrome(); }, delay));
      window.setTimeout(() => { if (isPageTranslated() && pageLanguage === 'en') window.location.reload(); }, 1600);
      return;
    }

    setGoogleLanguageCookie(code);
    ensureGoogleTranslateWidget();

    // Google Translate can load its hidden select asynchronously. Retry briefly so
    // choosing a language always applies even when the user selects immediately.
    const attempts = [0, 200, 500, 900, 1500, 2200];
    attempts.forEach((delay) => {
      window.setTimeout(() => {
        if (pageLanguage !== code) return; // the user has already picked another language
        ensureGoogleTranslateWidget();
        applyGoogleLanguage(code);
        hideGoogleChrome();
      }, delay);
    });
  };

  const currentName = SUPPORTED_LANGUAGES.find(([code]) => code === language)?.[1] || 'English';

  return (
    <div className="relative flex items-center notranslate" translate="no" title={`Language: ${currentName}`}>
      <Languages
        className="pointer-events-none absolute left-2.5 h-4 w-4 text-secondary"
        aria-hidden="true"
      />
      <label className="sr-only" htmlFor="artha-global-language">
        Select language
      </label>
      <select
        translate="no"
        id="artha-global-language"
        value={language}
        onChange={(event) => change(event.target.value)}
        className={`appearance-none rounded-xl border border-line bg-surface pl-8 pr-7 text-xs font-bold text-ink outline-none transition focus:border-interactive focus:ring-2 focus:ring-interactive/20 ${
          compact ? 'h-9 w-[120px]' : 'h-10 w-[150px]'
        }`}
      >
        {SUPPORTED_LANGUAGES.map(([code, name]) => (
          <option key={code} value={code}>
            {code === 'en' ? name : `${name} · ${ENGLISH_NAME[code]}`}
          </option>
        ))}
      </select>
    </div>
  );
};
