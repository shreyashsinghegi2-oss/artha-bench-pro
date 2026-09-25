import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

interface Offset { x: number; y: number }

/** Bars a floating button may not cover: the app and landing headers and pinned name/section bars. */
const KEEP_CLEAR = 'header.sticky, .cl-nav, .cl-header, .mh-sticky, .wd-nav, [data-keep-clear]';
function keepClearBottom(): number {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>(KEEP_CLEAR).forEach((el) => {
    const r = el.getBoundingClientRect();
    // Only bars pinned near the top of the screen count.
    if (r.height > 0 && r.top < 140 && getComputedStyle(el).position.match(/sticky|fixed/)) bottom = Math.max(bottom, r.bottom);
  });
  return bottom;
}

const read = (key: string): Offset => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null') as Offset | null;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return v;
  } catch { /* storage blocked */ }
  return { x: 0, y: 0 };
};

/**
 * Lets a floating element be dragged anywhere on screen (mouse or touch) by pressing and moving.
 * The offset is applied with the CSS `translate` property, so the element's own CSS position and
 * hover transforms keep working, and it is remembered per `storageKey`. A press that moves less than
 * a few pixels is still a normal click; a real drag swallows the click that follows it.
 */
export function useDraggable<T extends HTMLElement>(storageKey: string, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState<Offset>(() => (enabled ? read(storageKey) : { x: 0, y: 0 }));
  const current = useRef(offset);
  current.current = offset;
  const dragged = useRef(false);
  const [dragging, setDragging] = useState(false);

  /** Keeps the element inside the viewport and below any bar that must stay visible. */
  const clamp = useCallback((next: Offset): Offset => {
    const el = ref.current;
    if (!el) return next;
    const r = el.getBoundingClientRect();
    const baseLeft = r.left - current.current.x, baseTop = r.top - current.current.y;
    const minX = 8 - baseLeft, maxX = window.innerWidth - 8 - r.width - baseLeft;
    // Never over the app header, the logo or a pinned name/section bar: those must stay visible.
    const minY = keepClearBottom() + 8 - baseTop, maxY = window.innerHeight - 8 - r.height - baseTop;
    return { x: Math.min(Math.max(next.x, minX), Math.max(minX, maxX)), y: Math.min(Math.max(next.y, minY), Math.max(minY, maxY)) };
  }, []);

  // Pull the element back on screen after a resize or when a saved position no longer fits.
  useEffect(() => {
    if (!enabled) return;
    const fit = () => setOffset((o) => { const c = clamp(o); return c.x === o.x && c.y === o.y ? o : c; });
    const id = window.requestAnimationFrame(fit);
    // Pinned bars can appear while scrolling (e.g. the Home name bar), so re-check then too.
    let raf = 0;
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(() => { raf = 0; fit(); }); };
    window.addEventListener('resize', fit);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.cancelAnimationFrame(id); if (raf) window.cancelAnimationFrame(raf); window.removeEventListener('resize', fit); window.removeEventListener('scroll', onScroll); };
  }, [enabled, clamp]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    if (!enabled || e.button !== 0) return;
    // Buttons and fields inside a drag handle keep their normal behaviour.
    const target = e.target as HTMLElement;
    const interactive = target.closest('button, input, textarea, select, a, [role="radio"]');
    if (interactive && interactive !== e.currentTarget) return;
    const start = { x: e.clientX, y: e.clientY }, origin = current.current;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      if (!moved) { moved = true; setDragging(true); }
      ev.preventDefault();
      setOffset(clamp({ x: origin.x + dx, y: origin.y + dy }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!moved) return;
      dragged.current = true;
      setDragging(false);
      try { localStorage.setItem(storageKey, JSON.stringify(current.current)); } catch { /* storage blocked */ }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [enabled, clamp, storageKey]);

  /** Swallows the click that ends a drag, so dropping a button does not also press it. */
  const onClickCapture = useCallback((e: ReactMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const style: CSSProperties | undefined = enabled && (offset.x || offset.y) ? { translate: `${offset.x}px ${offset.y}px` } : undefined;
  return { ref, style, dragging, handle: { onPointerDown, onClickCapture } };
}
