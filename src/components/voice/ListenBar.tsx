import React, { useEffect, useRef, useState } from 'react';
import { Download, Languages, Loader2, Square, Volume2 } from 'lucide-react';
import { SPEEDS, setVoiceSpeed, voiceSpeed, cloudSpeech, downloadBlob, playBlob, stopAudio, translateFor, VOICE_LANGUAGES, voiceLanguageFor } from '../../services/voice';
import { currentPageLanguage } from '../LanguageSelector';
import './listenBar.css';

const KEY = 'arthamind-listen-language';
function initialCode(): string {
  try { const saved = window.localStorage.getItem(KEY); if (saved && VOICE_LANGUAGES.some((l) => l.code === saved)) return saved; } catch { /* storage blocked */ }
  return voiceLanguageFor(currentPageLanguage())?.code ?? 'hi-IN';
}

/**
 * Under any AI answer: choose a language, hear the answer spoken in it (translated first when
 * needed), read the translation, and download it as a voice note (MP3).
 */
export const ListenBar: React.FC<{ text: string; compact?: boolean }> = ({ text, compact }) => {
  const [code, setCode] = useState(initialCode);
  const [phase, setPhase] = useState<'idle' | 'working' | 'playing'>('idle');
  const [speed, setSpeed] = useState(voiceSpeed);
  const [error, setError] = useState('');
  const [translated, setTranslated] = useState<{ code: string; text: string } | null>(null);
  const [showText, setShowText] = useState(false);
  const cache = useRef(new Map<string, Blob>());
  const stopRef = useRef<() => void>(() => undefined);
  const lang = VOICE_LANGUAGES.find((l) => l.code === code) ?? VOICE_LANGUAGES[0];

  useEffect(() => { try { window.localStorage.setItem(KEY, code); } catch { /* ignore */ } }, [code]);
  useEffect(() => () => stopRef.current(), []);
  useEffect(() => { cache.current.clear(); setTranslated(null); }, [text]);

  const textFor = async (c: string) => {
    if (c === 'en-IN') return text;
    if (translated?.code === c) return translated.text;
    const t = await translateFor(text, c);
    setTranslated({ code: c, text: t });
    return t;
  };
  const audioFor = async (c: string) => {
    const hit = cache.current.get(c);
    if (hit) return hit;
    const blob = await cloudSpeech(await textFor(c), c);
    cache.current.set(c, blob);
    return blob;
  };

  const listen = async () => {
    if (phase === 'playing') { stopRef.current(); setPhase('idle'); return; }
    setError(''); setPhase('working');
    try {
      const blob = await audioFor(code);
      setPhase('playing');
      stopRef.current = playBlob(blob, () => setPhase('idle'), speed);
    } catch (e) { setError(e instanceof Error ? e.message : 'Voice is unavailable right now.'); setPhase('idle'); }
  };
  const download = async () => {
    setError('');
    try { const blob = await audioFor(code); downloadBlob(blob, `ArthaMind-answer-${lang.name}.mp3`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare the voice note.'); }
  };
  const toggleText = async () => {
    if (showText) { setShowText(false); return; }
    setError('');
    try { await textFor(code); setShowText(true); } catch (e) { setError(e instanceof Error ? e.message : 'Translation is unavailable.'); }
  };

  if (!text.trim()) return null;
  return <div className={`lb ${compact ? 'compact' : ''}`}>
    <div className="lb-row">
      <button type="button" className={`lb-play ${phase}`} onClick={() => void listen()} disabled={phase === 'working'} aria-label={phase === 'playing' ? 'Stop' : `Listen in ${lang.name}`}>
        {phase === 'working' ? <Loader2 size={14} className="lb-spin"/> : phase === 'playing' ? <Square size={13}/> : <Volume2 size={14}/>}
        {phase === 'playing' ? 'Stop' : phase === 'working' ? 'Preparing…' : 'Listen'}
      </button>
      <select className="notranslate" value={code} onChange={(e) => { stopAudio(); setPhase('idle'); setShowText(false); setCode(e.target.value); }} aria-label="Language to listen in">
        {VOICE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
      </select>
      <select className="lb-speed" value={speed} onChange={(e) => { const v = Number(e.target.value); setSpeed(v); setVoiceSpeed(v); }} aria-label="Listening speed" title="Listening speed">
        {SPEEDS.map(([v, l]) => <option key={v} value={v}>{v}× {l}</option>)}
      </select>
      {code !== 'en-IN' && <button type="button" className="lb-link" onClick={() => void toggleText()}><Languages size={13}/> {showText ? 'Hide' : 'Read'} in {lang.name}</button>}
      <button type="button" className="lb-link" onClick={() => void download()}><Download size={13}/> Voice note</button>
    </div>
    {showText && translated?.code === code && <p className="lb-text notranslate" lang={code}>{translated.text}</p>}
    {error && <p className="lb-err" role="alert">{error}</p>}
  </div>;
};
