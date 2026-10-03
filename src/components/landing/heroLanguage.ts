import { useEffect, useState } from 'react';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector';

/** "Hello" in each supported language, keyed by the codes in SUPPORTED_LANGUAGES. */
const GREETINGS: Record<string, string> = {
  en: 'Hello', hi: 'नमस्ते', mr: 'नमस्कार', gu: 'નમસ્તે', bn: 'নমস্কার', ta: 'வணக்கம்', te: 'నమస్కారం', kn: 'ನಮಸ್ಕಾರ', ml: 'നമസ്കാരം', pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ',
  ur: 'السلام علیکم', or: 'ନମସ୍କାର', as: 'নমস্কাৰ', es: 'Hola', fr: 'Bonjour', de: 'Hallo', ar: 'مرحبا', pt: 'Olá', it: 'Ciao', ja: 'こんにちは',
};

/** Cycles through the supported languages; shared by the phone and the hero badge. */
export function useLanguageCycle(running: boolean, ms = 900) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % SUPPORTED_LANGUAGES.length), ms);
    return () => window.clearInterval(id);
  }, [running, ms]);
  const [code, name] = SUPPORTED_LANGUAGES[i];
  return { index: i, total: SUPPORTED_LANGUAGES.length, code, name, greeting: GREETINGS[code] ?? 'Hello' };
}

