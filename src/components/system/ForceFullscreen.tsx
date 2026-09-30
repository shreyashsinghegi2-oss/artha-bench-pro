import React, { useEffect, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import './forceFullscreen.css';

/**
 * Keeps ArthaMind in full screen.
 *
 * Browsers only allow full screen from a user gesture, so the page cannot switch on load by itself. Instead,
 * the first tap, click or key press anywhere enters full screen, and if the user leaves it (Esc), the next
 * interaction enters it again. A small hint is shown while the page is not in full screen. Phones that do not
 * support the Fullscreen API for pages (iPhone Safari) are left alone; the installed app opens full screen
 * through the web manifest instead.
 */

type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean };
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function fullscreenSupported(doc: Document = document): boolean {
  const d = doc as FullscreenDoc;
  const el = doc.documentElement as FullscreenEl;
  return Boolean((d.fullscreenEnabled || d.webkitFullscreenEnabled) && (el.requestFullscreen || el.webkitRequestFullscreen));
}

export function isFullscreen(doc: Document = document): boolean {
  const d = doc as FullscreenDoc;
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Keys that must never trigger full screen: they exit it, belong to shortcuts, or are not a real activation. */
export function isIgnoredKey(e: KeyboardEvent): boolean {
  return e.key === 'Escape' || e.key === 'F11' || e.key === 'Tab' || e.metaKey || e.ctrlKey || e.altKey;
}

export function requestAppFullscreen(doc: Document = document): void {
  if (isFullscreen(doc) || !fullscreenSupported(doc)) return;
  const el = doc.documentElement as FullscreenEl;
  try {
    const result = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    if (result && typeof (result as Promise<void>).catch === 'function') (result as Promise<void>).catch(() => undefined);
  } catch {
    /* refused by the browser: try again on the next gesture */
  }
}

export const ForceFullscreen: React.FC = () => {
  const automated = typeof navigator !== 'undefined' && navigator.webdriver;
  const supported = typeof document !== 'undefined' && !automated && fullscreenSupported();
  const [active, setActive] = useState(() => (supported ? isFullscreen() : true));

  useEffect(() => {
    if (!supported) return;
    const onGesture = (e: Event) => {
      if (e instanceof KeyboardEvent && isIgnoredKey(e)) return;
      requestAppFullscreen();
    };
    const onChange = () => setActive(isFullscreen());
    // Capture phase so the request runs inside the same user gesture, before any handler stops it.
    window.addEventListener('click', onGesture, true);
    window.addEventListener('touchend', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      window.removeEventListener('click', onGesture, true);
      window.removeEventListener('touchend', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [supported]);

  if (!supported || active) return null;
  return (
    <div className="ffs-hint" role="status">
      <Maximize2 size={14} aria-hidden="true" /> Tap anywhere to continue in full screen
    </div>
  );
};
