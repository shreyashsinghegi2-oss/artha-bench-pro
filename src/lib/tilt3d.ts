/**
 * Pointer-driven 3D tilt and scroll reveals for card-like elements.
 *
 * One delegated pointer listener handles every card under `root`, so it works for content that renders
 * later (lazy pages, fetched lists). Only transform/opacity change, and everything is skipped for
 * reduced-motion users and touch-only devices (reveals still skip on reduced motion).
 */
export interface TiltOptions {
  /** Elements that may tilt. */
  selector: string;
  /** Largest card width (px) that tilts; bigger panels stay flat so forms and charts stay readable. */
  maxWidth?: number;
  /** Maximum rotation in degrees. */
  maxDeg?: number;
  /** Elements that also fade/rise in when scrolled into view. */
  revealSelector?: string;
}

const INTERACTIVE_INSIDE = 'input, textarea, select, canvas, iframe, [contenteditable="true"]';

export function installTilt(root: HTMLElement, { selector, maxWidth = 560, maxDeg = 6, revealSelector }: TiltOptions): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cleanups: Array<() => void> = [];

  if (!reduced && finePointer) {
    let active: HTMLElement | null = null;
    let frame = 0;
    let last: PointerEvent | null = null;

    const pick = (target: EventTarget | null): HTMLElement | null => {
      let el = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
      let best: HTMLElement | null = null;
      while (el && root.contains(el)) {
        const width = el.getBoundingClientRect().width;
        if (width <= maxWidth && !el.querySelector(INTERACTIVE_INSIDE)) best = el;
        el = el.parentElement?.closest<HTMLElement>(selector) ?? null;
      }
      return best;
    };
    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.removeAttribute('data-tilt-on');
      el.removeAttribute('data-tilt-pos');
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };
    const apply = () => {
      frame = 0;
      if (!last) return;
      const card = pick(last.target);
      if (card !== active) { reset(active); active = card; }
      if (!card) return;
      const box = card.getBoundingClientRect();
      const px = (last.clientX - box.left) / box.width - 0.5;
      const py = (last.clientY - box.top) / box.height - 0.5;
      if (!card.hasAttribute('data-tilt-on') && getComputedStyle(card).position === 'static') card.setAttribute('data-tilt-pos', '');
      card.setAttribute('data-tilt-on', '');
      card.style.setProperty('--rx', `${(-py * maxDeg).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${(px * maxDeg).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
    };
    const move = (event: PointerEvent) => { last = event; if (!frame) frame = requestAnimationFrame(apply); };
    const leave = () => { reset(active); active = null; };
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      if (frame) cancelAnimationFrame(frame);
      reset(active);
    });
  }

  if (revealSelector && !reduced && typeof IntersectionObserver !== 'undefined') {
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('sr-in');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const scan = () => {
      let count = 0;
      root.querySelectorAll<HTMLElement>(revealSelector).forEach((el) => {
        if (seen.has(el) || count > 80) return;
        seen.add(el);
        // Only animate content that starts below the fold, so nothing visible on load flickers.
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        count += 1;
        el.classList.add('sr');
        observer.observe(el);
      });
    };
    scan();
    let pending = 0;
    const mutations = new MutationObserver(() => { if (!pending) pending = window.setTimeout(() => { pending = 0; scan(); }, 150); });
    mutations.observe(root, { childList: true, subtree: true });
    cleanups.push(() => { observer.disconnect(); mutations.disconnect(); window.clearTimeout(pending); });
  }

  return () => cleanups.forEach((cleanup) => cleanup());
}
