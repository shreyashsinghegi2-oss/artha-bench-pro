import React, { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowDown } from 'lucide-react';
import './chatScroll.css';

const NEAR_BOTTOM_PX = 120;

/**
 * Follows new messages only while the reader is at the bottom. Once they scroll up to reread an older
 * answer, the page stays where it is and "behind" turns on so a "Jump to latest" button can appear.
 */
export function useStickToBottom(scroller: RefObject<HTMLElement | null>, trigger: unknown) {
  const stuck = useRef(true);
  const [behind, setBehind] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      stuck.current = gap < NEAR_BOTTOM_PX;
      setBehind(!stuck.current);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scroller]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !stuck.current) return;
    // A short delay lets the new text lay out first, so the scroll does not jerk.
    const id = window.setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 60);
    return () => window.clearTimeout(id);
  }, [scroller, trigger]);

  const jump = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    stuck.current = true;
    setBehind(false);
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [scroller]);

  return { behind, jump };
}

export const JumpToLatest: React.FC<{ show: boolean; onClick: () => void }> = ({ show, onClick }) => {
  if (!show) return null;
  return <button type="button" className="chat-jump" onClick={onClick}><ArrowDown size={14} aria-hidden="true" /> Jump to latest</button>;
};
