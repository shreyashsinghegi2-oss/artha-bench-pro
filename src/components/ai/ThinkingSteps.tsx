import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import './assistantTools.css';

/** What the server does for every assistant question, in order (see server/liveGrounding.ts). */
const STEPS = [
  { at: 0, text: 'Understanding your question' },
  { at: 700, text: 'Fetching live market prices and news' },
  { at: 1700, text: 'Searching the web and reading sources' },
  { at: 3000, text: 'Analysing with your numbers and the formulas' },
  { at: 4600, text: 'Checking the maths and writing your answer' },
];

/**
 * Shown while an assistant works: the stages of the answer pipeline appear one after another,
 * so the user can see what is happening instead of a blank spinner. Timing is approximate; the
 * sources actually used are listed with the answer.
 */
export const ThinkingSteps: React.FC<{ active: boolean; compact?: boolean }> = ({ active, compact }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - start), 250);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active) return null;
  const current = STEPS.reduce((n, s, i) => (elapsed >= s.at ? i : n), 0);
  return <ol className={`am-steps ${compact ? 'compact' : ''}`} aria-live="polite" aria-label="What the assistant is doing">
    {STEPS.slice(0, current + 1).map((s, i) => <li key={s.text} className={i < current ? 'done' : 'now'}>
      <i>{i < current ? <Check size={12}/> : <Loader2 size={12} className="am-spin"/>}</i><span>{s.text}{i === current ? '…' : ''}</span>
    </li>)}
  </ol>;
};
