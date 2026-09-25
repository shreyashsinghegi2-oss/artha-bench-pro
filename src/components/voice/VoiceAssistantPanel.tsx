import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, RotateCcw, Send, Square, Volume2, X } from 'lucide-react';
import { askAiCfo, type CfoTurn } from '../../services/cfoApi';
import { canListen, canSpeak, listenOnce, pickVoice, speak, stopSpeaking, VOICE_LANGUAGES, voicesReady, type VoiceLanguage } from '../../services/voice';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';
interface Turn { q: string; a: string; offline: boolean }

const SAMPLES = ['How much emergency fund do I need?', 'Should I repay my loan first or start a SIP?', 'Explain mutual funds in simple words', 'Is crypto safe for me?'];
const LANG_KEY = 'arthamind-voice-language';
const RATE_KEY = 'arthamind-voice-rate';

/** What the voice reads: the short answer plus up to three actions. */
function spokenAnswer(reply: Awaited<ReturnType<typeof askAiCfo>>): string {
  const s = reply.structured;
  const main = s?.directAnswer || reply.answer;
  const steps = (s?.keyTakeaways ?? []).slice(0, 3);
  return [main, ...steps].filter(Boolean).join(' ');
}

export default function VoiceAssistantPanel({ initialLanguage, onClose }: { initialLanguage: VoiceLanguage; onClose: () => void }) {
  const [lang, setLang] = useState<VoiceLanguage>(() => {
    try { const saved = window.localStorage.getItem(LANG_KEY); return VOICE_LANGUAGES.find((l) => l.code === saved) ?? initialLanguage; } catch { return initialLanguage; }
  });
  const [rate, setRate] = useState<number>(() => { try { return Number(window.localStorage.getItem(RATE_KEY)) || 0.95; } catch { return 0.95; } });
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
  useEffect(() => { try { window.localStorage.setItem(RATE_KEY, String(rate)); } catch { /* private mode */ } }, [rate]);
  useEffect(() => {
    let live = true;
    void voicesReady().then((all) => { if (!live) return; setVoice(pickVoice(all, lang.code)); setEnglishVoice(pickVoice(all, 'en-IN')); setVoicesChecked(true); });
    return () => { live = false; };
  }, [lang]);
  useEffect(() => () => { stopListening.current(); stopSpeaking(); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [turns, phase]);

  const say = useCallback(async (text: string, offline: boolean) => {
    // An offline answer is in English: read it with an English voice, never with a voice for another script.
    const v = offline && lang.name !== 'English' ? englishVoice : voice;
    if (!speakOk || !v || !text) { setPhase('idle'); return; }
    setPhase('speaking');
    await speak(text, v, rate);
    setPhase((p) => (p === 'speaking' ? 'idle' : p));
  }, [englishVoice, lang.name, rate, speakOk, voice]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q) return;
    setError(''); setHeard(''); setDraft(''); setPhase('thinking'); stopSpeaking();
    const history: CfoTurn[] = turns.slice(-3).flatMap((t) => [{ role: 'user' as const, content: t.q }, { role: 'assistant' as const, content: t.a }]);
    try {
      const reply = await askAiCfo(q, history, lang.name === 'Hindi' ? 'hindi' : 'english', { replyLanguage: lang.name, voice: true });
      const text = spokenAnswer(reply);
      setTurns((t) => [...t, { q, a: text, offline: reply.fallback }]);
      await say(text, reply.fallback);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setPhase('idle');
    }
  }, [lang.name, say, turns]);

  const startListening = () => {
    if (phase === 'listening') { stopListening.current(); return; }
    stopSpeaking(); setError(''); setHeard(''); setPhase('listening');
    const { done, stop } = listenOnce(lang.code, setHeard);
    stopListening.current = stop;
    done.then((text) => { if (text) void ask(text); else { setPhase('idle'); setError('I did not catch that. Tap the mic and try again.'); } })
      .catch((e: Error) => { setPhase('idle'); setError(e.message); });
  };

  const stopAll = () => { stopListening.current(); stopSpeaking(); setPhase('idle'); };
  const last = turns[turns.length - 1];
  const status = phase === 'listening' ? 'Listening… speak now' : phase === 'thinking' ? 'Thinking…' : phase === 'speaking' ? 'Speaking…' : listenOk ? 'Tap the mic and ask your question' : 'Type your question below';

  return <div className="va-panel" role="dialog" aria-label="Voice money assistant">
    <header className="va-head">
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
            {speakOk && <button type="button" onClick={() => void say(t.a, t.offline)} disabled={phase !== 'idle'}><Volume2 size={14}/> Listen again</button>}
          </footer>
        </div>
      </div>)}
      {phase === 'thinking' && <div className="va-thinking"><Loader2 size={16} className="va-spin"/> Preparing a simple answer in {lang.name}…</div>}
    </div>

    <div className="va-mic-row">
      <button type="button" className={`va-mic ${phase}`} onClick={phase === 'speaking' ? stopAll : startListening} disabled={phase === 'thinking' || (!listenOk && phase !== 'speaking')}
        aria-label={phase === 'listening' ? 'Stop listening' : phase === 'speaking' ? 'Stop speaking' : 'Start speaking'}>
        <span className="va-ring"/><span className="va-ring r2"/>
        {phase === 'speaking' || phase === 'listening' ? <Square size={22}/> : <Mic size={26}/>}
      </button>
      <div className="va-status">
        <b>{status}</b>
        {heard && <span className="notranslate">“{heard}”</span>}
        {error && <span className="va-err" role="alert">{error}</span>}
      </div>
    </div>

    <form className="va-type" onSubmit={(e) => { e.preventDefault(); void ask(draft); }}>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Or type in ${lang.name}…`} aria-label="Type your question" maxLength={600} disabled={phase === 'thinking'}/>
      <button type="submit" aria-label="Ask" disabled={!draft.trim() || phase === 'thinking'}><Send size={16}/></button>
    </form>

    <div className="va-foot">
      <label>Speed <select value={rate} onChange={(e) => setRate(Number(e.target.value))}><option value={0.8}>Slow</option><option value={0.95}>Normal</option><option value={1.15}>Fast</option></select></label>
      {last && <button type="button" onClick={() => { stopAll(); setTurns([]); }}><RotateCcw size={13}/> New conversation</button>}
    </div>
    {voicesChecked && speakOk && !voice && <p className="va-note">This device has no {lang.name} voice installed, so answers are shown as text. You can add one in your phone or computer’s text-to-speech settings.</p>}
    {!speakOk && <p className="va-note">This browser cannot read answers aloud; answers are shown as text.</p>}
    {!listenOk && <p className="va-note">Voice input works in Chrome or Edge. In this browser, please type your question.</p>}
    <p className="va-fine">Education only, not investment advice. Speech is turned into text by your browser’s speech service; ArthaMind does not record your voice.</p>
  </div>;
}
