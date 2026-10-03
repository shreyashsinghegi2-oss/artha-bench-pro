import React, { useCallback, useEffect, useState } from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { AssistantLogo } from '../ai/AssistantLogo';
import type { AppNavigationDestination } from '../../navigationTypes';
import { PageAssistant } from '../ai/PageAssistant';
import { useDraggable } from '../../hooks/useDraggable';
import { expertName } from '../../data/assistantGuides';
import './pageAIDock.css';

/** What the user sees on the page right now, as plain text for the assistant. */
function readPage(): string {
  const main = document.querySelector('.ws-main') ?? document.querySelector('main');
  if (!main) return '';
  const clone = main.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script,style,svg,button,input,select,textarea,nav,.pa,.lb').forEach((n) => n.remove());
  return (clone.innerText || clone.textContent || '').replace(/\n{2,}/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, 3200);
}

/** "Ask ArthaMind AI" about this page on every workspace page: guided questions, then answers grounded in the page. */
export const PageAIDock: React.FC<{ destination: AppNavigationDestination; raised?: boolean }> = ({ destination, raised }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [destination]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const launch = useDraggable<HTMLButtonElement>('am-drag-ai-launch');
  const panel = useDraggable<HTMLElement>('am-drag-ai-panel', { enabled: typeof window !== 'undefined' && window.matchMedia('(min-width: 721px)').matches });
  const snapshot = useCallback(() => readPage() || 'The page is still loading.', []);
  const title = expertName(destination);
  return <>
    {!open && <button ref={launch.ref} style={launch.style} {...launch.handle} type="button" className={`pai-launch ${raised ? 'raised' : ''} ${launch.dragging ? 'is-dragging' : ''}`} onClick={() => setOpen(true)} aria-label={`Ask ${title} (drag to move)`} title="Drag to move">
      <AssistantLogo size={24}/><span>Ask ArthaMind AI</span>
    </button>}
    {open && <div className="pai-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <aside ref={panel.ref} style={panel.style} className={`pai-panel ${panel.dragging ? 'is-dragging' : ''}`} role="dialog" aria-label={title}>
        <div className="pai-grip" {...panel.handle} title="Drag to move"><GripHorizontal size={16}/><span>Drag to move · the page stays readable</span></div>
        <button type="button" className="pai-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18}/></button>
        <PageAssistant key={destination} destination={destination} snapshot={snapshot}/>
      </aside>
    </div>}
  </>;
};
