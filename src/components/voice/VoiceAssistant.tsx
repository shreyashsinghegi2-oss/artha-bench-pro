import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { useDraggable } from '../../hooks/useDraggable';
import { currentPageLanguage, onPageLanguage } from '../LanguageSelector';
import { VOICE_LANGUAGES, voiceLanguageFor } from '../../services/voice';
import './voiceAssistant.css';

const VoiceAssistantPanel = lazy(() => import('./VoiceAssistantPanel'));

/** Floating "Ask by voice" button on every page; the panel loads only when opened. */
export const VoiceAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState(currentPageLanguage());
  useEffect(() => onPageLanguage(setSite), []);
  useEffect(() => {
    const openFromElsewhere = () => setOpen(true);
    window.addEventListener('arthamind:open-voice', openFromElsewhere);
    return () => window.removeEventListener('arthamind:open-voice', openFromElsewhere);
  }, []);
  // Follow the site language when it has a voice; Hindi otherwise, since most users speak it.
  const initial = voiceLanguageFor(site) ?? VOICE_LANGUAGES[0];
  const drag = useDraggable<HTMLButtonElement>('am-drag-voice-launch');

  return <>
    {!open && <button ref={drag.ref} style={drag.style} {...drag.handle} type="button" className={`va-launch ${drag.dragging ? 'is-dragging' : ''}`} onClick={() => setOpen(true)} aria-label="Ask by voice (drag to move)" title="Drag to move">
      <span className="va-launch-dot"><Mic size={18}/></span><span className="va-launch-text">Ask by voice</span>
    </button>}
    {open && <Suspense fallback={<div className="va-panel va-loading">Opening voice assistant…</div>}>
      <VoiceAssistantPanel initialLanguage={initial} onClose={() => setOpen(false)}/>
    </Suspense>}
  </>;
};
