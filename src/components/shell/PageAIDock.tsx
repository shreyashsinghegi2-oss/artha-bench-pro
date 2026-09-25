import React, { useCallback, useEffect, useState } from 'react';
import { Bot, X } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { PageAssistant } from '../ai/PageAssistant';
import { guideFor } from '../../data/assistantGuides';
import './pageAIDock.css';

/** What the user sees on the page right now, as plain text for the assistant. */
function readPage(): string {
  const main = document.querySelector('.ws-main') ?? document.querySelector('main');
  if (!main) return '';
  const clone = main.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script,style,svg,button,input,select,textarea,nav,.pa,.lb').forEach((n) => n.remove());
  return (clone.innerText || clone.textContent || '').replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, 3200);
}

/** "Ask AI about this page" on every workspace page: guided questions, then answers grounded in the page. */
export const PageAIDock: React.FC<{ destination: AppNavigationDestination; raised?: boolean }> = ({ destination, raised }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [destination]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const snapshot = useCallback(() => readPage() || 'The page is still loading.', []);
  const title = guideFor(destination).title;
  return <>
    {!open && <button type="button" className={`pai-launch ${raised ? 'raised' : ''}`} onClick={() => setOpen(true)} aria-label={`Ask AI about ${title}`}>
      <Bot size={18}/><span>Ask AI</span>
    </button>}
    {open && <div className="pai-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <aside className="pai-panel" role="dialog" aria-label={`${title} AI assistant`}>
        <button type="button" className="pai-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18}/></button>
        <PageAssistant key={destination} destination={destination} snapshot={snapshot}/>
      </aside>
    </div>}
  </>;
};
