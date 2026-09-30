import React, { useEffect } from 'react';

/**
 * Keeps ArthaMind in full screen.
 *
 * Browsers only allow full screen from a user gesture, so the page cannot switch on load by itself. Instead,
 * it tries at once (allowed only on some managed browsers) and otherwise enters full screen silently at the first
 * tap, click or key press; if the user leaves it (Esc), the next interaction enters it again. No hint is shown.
 * Phones that do not support the Fullscreen API for pages (iPhone Safari) are left alone; the installed app
 * opens full screen through the web manifest instead.
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
  useEffect(() => {
    const automated = typeof navigator !== 'undefined' && navigator.webdriver;
    if (automated || !fullscreenSupported()) return;
    // Try at once: browsers that allow automatic full screen (e.g. kiosk or managed devices) switch now; the rest
    // refuse silently and the first gesture below does it.
    requestAppFullscreen();
    const onGesture = (e: Event) => {
      if (e instanceof KeyboardEvent && isIgnoredKey(e)) return;
      requestAppFullscreen();
    };
    // Capture phase so the request runs inside the same user gesture, before any handler stops it.
    const events = ['pointerdown', 'mousedown', 'click', 'touchend', 'keydown'] as const;
    events.forEach((name) => window.addEventListener(name, onGesture, true));
    return () => events.forEach((name) => window.removeEventListener(name, onGesture, true));
  }, []);
  return null;
};
