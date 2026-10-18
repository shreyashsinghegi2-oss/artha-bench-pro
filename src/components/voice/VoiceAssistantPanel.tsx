import { ThinkingSteps } from '../ai/ThinkingSteps';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDraggable } from '../../hooks/useDraggable';
import { Download, Loader2, Mic, RotateCcw, Send, Square, Volume2, X } from 'lucide-react';
import { askAiCfo, type CfoTurn } from '../../services/cfoApi';
import { isPlatformQuestion, platformAnswer, PLATFORM_FACTS } from '../../data/platformGuide';
import { useAuth } from '../../auth/AuthContext';
import { SPEEDS, setVoiceSpeed, voiceSpeed, canListen, canSpeak, cloudSpeech, downloadBlob, listenOnce, pickVoice, playBlob, speak, stopAudio, stopSpeaking, VOICE_LANGUAGES, voicesReady, type VoiceLanguage } from '../../services/voice';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Turn { q: string; a: string; offline: boolean }

const SAMPLES = ['What is ArthaMind and how can it help me?', 'How much emergency fund do I need?', 'Should I repay my loan first or start a SIP?', 'Explain mutual funds in simple words', 'Is crypto safe for me?'];
const LANG_KEY = 'arthamind-voice-language';

/** At most two sentences and about 280 characters, so every spoken answer is short. */
export function shortSpoken(text: string, maxChars = 280): string {
  const clean = text.replace(/[*_#`>|]/g, '').replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[.!?।])\s+/).filter(Boolean);
  let out = '';
  for (const sentence of sentences.slice(0, 2)) {
    if (out && (out + ' ' + sentence).length > maxChars) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  if (!out) out = clean;
  return out.length > maxChars ? `${out.slice(0, maxChars - 1).replace(/\s+\S*$/, '')}…` : out;
}

/** What the voice reads: the short answer, plus the first action when there is room. */
function spokenAnswer(reply: Awaited<ReturnType<typeof askAiCfo>>): string {
  const s = reply.structured;
  const main = s?.directAnswer || reply.answer;
  const step = s?.keyTakeaways?.[0];
  return shortSpoken([main, step].filter(Boolean).join(' '));
}

export default function VoiceAssistantPanel(props: { initialLanguage: VoiceLanguage; onClose: () => void }) {
  const auth = useAuth();
  if (!auth.user) {
    return <div className="va-panel va-gate" role="dialog" aria-label="Voice money assistant">
      <header className="va-head">
        <div><b>Voice money assistant</b><small>Ask about money by voice in 13 Indian languages.</small></div>
        <button type="button" className="va-icon" onClick={props.onClose} aria-label="Close voice assistant"><X size={18}/></button>
      </header>
      <p className="va-gate-text">Voice questions are part of your free ArthaMind account. Sign up in a minute, then ask anything by voice and hear a short answer.</p>
      <button type="button" className="va-gate-cta" onClick={() => { props.onClose(); auth.openAuth('signup'); }}>Sign up free</button>
      <button type="button" className="va-gate-link" onClick={() => { props.onClose(); auth.openAuth('login'); }}>I already have an account</button>
    </div>;
  }
  return <VoicePanelSignedIn {...props}/>;
}

function VoicePanelSignedIn({ initialLanguage, onClose }: { initialLanguage: VoiceLanguage; onClose: () => void }) {
  const [lang, setLang] = useState<VoiceLanguage>(() => {
    try { const saved = window.localStorage.getItem(LANG_KEY); return VOICE_LANGUAGES.find((l) => l.code === saved) ?? initialLanguage; } catch { return initialLanguage; }
  });
  const [rate, setRate] = useState<number>(() => voiceSpeed());
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState('');
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [englishVoice, setEnglishVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voicesChecked, setVoicesChecked] = useState(false);
  const stopListening = useRef<() => void>(() => undefined);
  const logRef = useRef<HTMLDivElement>(null);
  const listenOk = canListen(), speakOk = canSpeak();

  useEffect(() => { try { window.localStorage.setItem(LANG_KEY, lang.code); } catch { /* private mode */ } }, [lang]);
  useEffect(() => { setVoiceSpeed(rate); }, [rate]);
  useEffect(() => {
    let live = true;
    void voicesReady().then((all) => { if (!live) return; setVoice(pickVoice(all, lang.code)); setEnglishVoice(pickVoice(all, 'en-IN')); setVoicesChecked(true); });
    return () => { live = false; };
  }, [lang]);
  useEffect(() => () => { stopListening.current(); stopPlayback.current(); stopAudio(); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [turns, phase]);

  const audioCache = useRef(new Map<string, Blob>());
  const stopPlayback = useRef<() => void>(() => undefined);
  const [voiceNote, setVoiceNote] = useState('');

  /** Speech for a turn: server audio in the chosen language (works on every device), else the device voice. */
  const audioFor = useCallback(async (text: string, offline: boolean) => {
    const code = offline ? 'en-IN' : lang.code; // an offline answer is in English
    const key = `${code}|${text}`;
    const hit = audioCache.current.get(key);
    if (hit) return hit;
    const blob = await cloudSpeech(text, code, rate);
    audioCache.current.set(key, blob);
    return blob;
  }, [lang.code, rate]);

  const say = useCallback(async (text: string, offline: boolean) => {
    if (!text) { setPhase('idle'); return; }
    setPhase('speaking'); setVoiceNote('');
    try {
      const blob = await audioFor(text, offline);
      await new Promise<void>((resolve) => { stopPlayback.current = playBlob(blob, resolve, rate); });
    } catch {
      // Server voice unavailable: use a device voice if one exists for this language.
      const v = offline && lang.name !== 'English' ? englishVoice : voice;
      if (speakOk && v) await speak(text, v, rate);
      else setVoiceNote(`Voice could not be played right now. The answer is shown as text.`);
    }
    setPhase((p) => (p === 'speaking' ? 'idle' : p));
  }, [audioFor, englishVoice, lang.name, rate, speakOk, voice]);

  const saveNote = async (text: string, offline: boolean) => {
    try { downloadBlob(await audioFor(text, offline), `ArthaMind-voice-${offline ? 'English' : lang.name}.mp3`); }
    catch { setVoiceNote('The voice note could not be prepared right now.'); }
  };

  // Each question gets an id; an answer that arrives after a newer question was asked is dropped.
  const askId = useRef(0);
  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;
    const id = ++askId.current;
    stopListening.current(); stopPlayback.current(); stopAudio(); stopSpeaking();
    setError(''); setHeard(''); setDraft(''); setPhase('thinking');
    try {
      // Questions about ArthaMind itself: answered from the platform guide (instant in English).
      if (isPlatformQuestion(q) && lang.name === 'English') {
        const text = shortSpoken(platformAnswer(q), 320);
        setTurns((t) => [...t, { q, a: text, offline: false }]);
        await say(text, false);
        return;
      }
      const history: CfoTurn[] = turns.slice(-3).flatMap((t) => [{ role: 'user' as const, content: t.q }, { role: 'assistant' as const, content: t.a }]);
      const prompt = isPlatformQuestion(q) ? `${q}\n\nAnswer about the ArthaMind platform using only these facts: ${PLATFORM_FACTS}` : q;
      const reply = await askAiCfo(prompt, history, lang.name === 'Hindi' ? 'hindi' : 'english', { replyLanguage: lang.name, voice: true });
      if (id !== askId.current) return;
      const text = spokenAnswer(reply);
      setTurns((t) => [...t, { q, a: text, offline: reply.fallback }]);
      await say(text, reply.fallback);
    } catch (e) {
      if (id !== askId.current) return;
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setPhase('idle');
    }
  }, [lang.name, say, turns]);

  const startListening = () => {
    if (phase === 'listening') { stopListening.current(); return; }
    // Tapping the mic while an answer plays stops it and listens for the next question at once.
    askId.current += 1;
    stopPlayback.current(); stopAudio(); stopSpeaking(); setError(''); setHeard(''); setPhase('listening');
    const { done, stop } = listenOnce(lang.code, setHeard);
    stopListening.current = stop;
    done.then((text) => { if (text) void ask(text); else { setPhase('idle'); setError('I did not catch that. Tap the mic and try again.'); } })
      .catch((e: Error) => { setPhase('idle'); setError(e.message); });
  };

  const drag = useDraggable<HTMLDivElement>('am-drag-voice-panel', { enabled: typeof window !== 'undefined' && window.matchMedia('(min-width: 641px)').matches });
  const stopAll = () => { askId.current += 1; stopListening.current(); stopPlayback.current(); stopAudio(); stopSpeaking(); setPhase('idle'); };
  const last = turns[turns.length - 1];
  const status = phase === 'listening' ? 'Listening… speak now' : phase === 'thinking' ? 'Thinking… tap the mic to ask something else' : phase === 'speaking' ? 'Speaking… tap the mic to ask another question' : listenOk ? 'Tap the mic and ask your question' : 'Type your question below';

  return <div ref={drag.ref} style={drag.style} className={`va-panel ${drag.dragging ? 'is-dragging' : ''}`} role="dialog" aria-label="Voice money assistant">
    <header className="va-head va-drag" {...drag.handle} title="Drag to move">
      <div><b>Voice money assistant</b><small>Ask in your language. Answers in simple words.</small></div>
      <button type="button" className="va-icon" onClick={() => { stopAll(); onClose(); }} aria-label="Close voice assistant"><X size={18}/></button>
    </header>

    <div className="va-langs notranslate" role="radiogroup" aria-label="Language">
      {VOICE_LANGUAGES.map((l) => <button key={l.code} type="button" role="radio" aria-checked={l.code === lang.code} className={l.code === lang.code ? 'on' : ''} onClick={() => { stopAll(); setLang(l); }}>{l.native}</button>)}
    </div>

    <div className="va-log" ref={logRef} aria-live="polite">
      {!turns.length && phase === 'idle' && <div className="va-empty">
        <p>Ask anything about money: salary, savings, EMI, SIP, mutual funds, tax, insurance or crypto.</p>
        <div className="va-samples">{SAMPLES.map((s) => <button key={s} type="button" onClick={() => void ask(s)}>{s}</button>)}</div>
      </div>}
      {turns.map((t, i) => <div key={i} className="va-turn">
        <p className="va-q notranslate">{t.q}</p>
        <div className="va-a notranslate">
          <p>{t.a}</p>
          <footer>
            {t.offline && <span className="va-tag">AI offline · basic answer in English</span>}
            <button type="button" onClick={() => void say(t.a, t.offline)} disabled={phase !== 'idle'}><Volume2 size={14}/> Listen again</button>
            <button type="button" onClick={() => void saveNote(t.a, t.offline)}><Download size={14}/> Voice note</button>
          </footer>
        </div>
      </div>)}
      {phase === 'thinking' && <ThinkingSteps active compact/>}
    </div>

    <div className="va-mic-row">
      <button type="button" className={`va-mic ${phase}`} onClick={listenOk ? startListening : stopAll} disabled={!listenOk && phase !== 'speaking'}
        aria-label={phase === 'listening' ? 'Stop listening' : phase === 'speaking' || phase === 'thinking' ? 'Stop and ask another question' : 'Start speaking'}>
        <span className="va-ring"/><span className="va-ring r2"/>
        {phase === 'listening' ? <Square size={22}/> : <Mic size={26}/>}
      </button>
      <div className="va-status">
        <b>{status}</b>
        {heard && <span className="notranslate">“{heard}”</span>}
        {error && <span className="va-err" role="alert">{error}</span>}
      </div>
    </div>

    <form className="va-type" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Or type in ${lang.name}…`} aria-label="Type your question" maxLength={600}/>
      <button type="submit" aria-label="Ask" disabled={!draft.trim()}><Send size={16}/></button>
    </form>

    <div className="va-foot">
      <label>Speed <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>{SPEEDS.map(([v, l]) => <option key={v} value={v}>{l} ({v}×)</option>)}</select></label>
      {last && <button type="button" onClick={() => { stopAll(); setTurns([]); }}><RotateCcw size={13}/> New conversation</button>}
    </div>
    {voiceNote && <p className="va-note">{voiceNote}</p>}
    {!listenOk && <p className="va-note">Voice input works in Chrome or Edge. In this browser, please type your question.</p>}
    <p className="va-fine">For information only. Not investment advice. Speech is turned into text by your browser’s speech service; ArthaMind does not record your voice.</p>
  </div>;
}
