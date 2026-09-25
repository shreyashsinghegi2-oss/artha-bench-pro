import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { canListen, listenOnce, voiceLanguageFor } from '../../services/voice';
import { currentPageLanguage } from '../LanguageSelector';
import './assistantTools.css';

/**
 * Speak instead of typing: fills the question box with what the user says, live, in the site's
 * language (Indian English otherwise, which also follows Hinglish well).
 */
export const MicButton: React.FC<{ onText: (text: string) => void; onFinal?: (text: string) => void; disabled?: boolean; className?: string }> = ({ onText, onFinal, disabled, className }) => {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const stopRef = useRef<() => void>(() => undefined);
  useEffect(() => () => stopRef.current(), []);
  const supported = canListen();

  const toggle = () => {
    if (listening) { stopRef.current(); return; }
    setError('');
    const lang = voiceLanguageFor(currentPageLanguage())?.code ?? 'en-IN';
    const { done, stop } = listenOnce(lang, onText);
    stopRef.current = stop;
    setListening(true);
    done.then((t) => { if (t) { onText(t); onFinal?.(t); } })
      .catch((e: Error) => setError(e.message))
      .finally(() => { setListening(false); stopRef.current = () => undefined; });
  };

  return <span className={`am-mic-wrap ${className ?? ''}`}>
    <button type="button" className={`am-mic ${listening ? 'on' : ''}`} onClick={toggle} disabled={disabled || !supported}
      aria-label={listening ? 'Stop listening' : 'Speak your question'} title={supported ? (listening ? 'Listening… tap to stop' : 'Speak your question') : 'Voice input works in Chrome or Edge'}>
      {listening ? <Square size={14}/> : <Mic size={15}/>}
    </button>
    {error && <span className="am-mic-err" role="alert">{error}</span>}
  </span>;
};
