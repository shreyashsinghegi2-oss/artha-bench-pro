import { useEffect, type RefObject } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts a number up from 0 to its `data-n` target with an ease-out curve once the element
 * scrolls into view. Reduced-motion users see the final value immediately.
 */
function observeCountUps(root: HTMLElement, reduce: boolean): () => void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-n]'));
  const frames = new Set<number>();
  const run = (node: HTMLElement) => {
    const target = Number(node.dataset.n || 0);
    if (!Number.isFinite(target)) return;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      node.textContent = String(Math.round(target * easeOutCubic(progress)));
      if (progress < 1) frames.add(requestAnimationFrame(tick));
    };
    frames.add(requestAnimationFrame(tick));
  };
  // Markup carries the real value; only reset to 0 when we are actually going to animate it.
  if (reduce || !('IntersectionObserver' in window)) { nodes.forEach((node) => { node.textContent = String(Number(node.dataset.n || 0)); }); return () => undefined; }
  nodes.forEach((node) => { node.textContent = '0'; });
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    observer.unobserve(entry.target);
    run(entry.target as HTMLElement);
  }), { threshold: 0.6 });
  nodes.forEach((node) => observer.observe(node));
  return () => { observer.disconnect(); frames.forEach(cancelAnimationFrame); };
}

/**
 * Adds `.in` to staggered groups; each child receives a `--stagger` index for CSS delays.
 * Groups rendered later (news and market cards arrive after a fetch) are picked up by a
 * MutationObserver, so late content still gets its reveal. Late `.cl-reveal` blocks too.
 */
function observeStaggerGroups(root: HTMLElement, reduce: boolean): () => void {
  const index = (group: HTMLElement) => Array.from(group.children).forEach((child, i) => (child as HTMLElement).style.setProperty('--stagger', String(i)));
  const io = reduce || !('IntersectionObserver' in window) ? null : new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('in');
    io?.unobserve(entry.target);
  }), { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  const bound = new WeakSet<Element>();
  // Lazily mounted sections (`.cl-reveal-section`) arrive after the first scan, so they are
  // picked up here too; otherwise they would stay at opacity 0.
  const scan = () => root.querySelectorAll<HTMLElement>('[data-stagger], .cl-reveal, .cl-reveal-section').forEach((group) => {
    if (group.hasAttribute('data-stagger')) index(group);
    if (bound.has(group)) return;
    bound.add(group);
    if (io) io.observe(group); else group.classList.add('in');
  });
  scan();
  let frame = 0;
  const mutations = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; scan(); }); });
  mutations.observe(root, { childList: true, subtree: true });
  return () => { io?.disconnect(); mutations.disconnect(); if (frame) cancelAnimationFrame(frame); };
}

/**
 * Landing-page motion system: scroll progress, staggered reveals, count-ups, a pointer-following
 * hero spotlight, 3D tilt on the workspace preview, click ripples and magnetic primary buttons.
 * Every effect is skipped or collapsed to its final state when the user prefers reduced motion.
 */
export function useLandingMotion(rootRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = prefersReducedMotion();
    const cleanups: Array<() => void> = [];

    cleanups.push(observeCountUps(root, reduce));
    cleanups.push(observeStaggerGroups(root, reduce));

    // Scroll progress (a transform-only update, batched per animation frame).
    let scrollFrame = 0;
    const updateProgress = () => {
      scrollFrame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      root.style.setProperty('--cl-scroll', String(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0));
    };
    const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress); };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    cleanups.push(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
    });

    // Click ripple on primary actions and module cards (touch and mouse).
    if (!reduce) {
      const ripple = (event: PointerEvent) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('.cl-primary, .cl-secondary, .cl-module');
        if (!target || !root.contains(target)) return;
        const rect = target.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        const dot = document.createElement('span');
        dot.className = 'cl-ripple';
        dot.style.width = dot.style.height = `${size}px`;
        dot.style.left = `${event.clientX - rect.left - size / 2}px`;
        dot.style.top = `${event.clientY - rect.top - size / 2}px`;
        target.appendChild(dot);
        dot.addEventListener('animationend', () => dot.remove(), { once: true });
      };
      root.addEventListener('pointerdown', ripple);
      cleanups.push(() => root.removeEventListener('pointerdown', ripple));
    }

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduce || !finePointer) return () => cleanups.forEach((cleanup) => cleanup());

    // Hero spotlight + workspace tilt.
    const hero = root.querySelector<HTMLElement>('.cl-hero');
    const tiltTarget = root.querySelector<HTMLElement>('.cl-window');
    if (hero) {
      let heroFrame = 0;
      let pointer = { x: 0, y: 0 };
      const apply = () => {
        heroFrame = 0;
        const rect = hero.getBoundingClientRect();
        hero.style.setProperty('--spot-x', `${pointer.x - rect.left}px`);
        hero.style.setProperty('--spot-y', `${pointer.y - rect.top}px`);
        if (tiltTarget) {
          const box = tiltTarget.getBoundingClientRect();
          const rx = ((pointer.y - (box.top + box.height / 2)) / box.height) * -4;
          const ry = ((pointer.x - (box.left + box.width / 2)) / box.width) * 5;
          tiltTarget.style.setProperty('--tilt-x', `${Math.max(-4, Math.min(4, rx)).toFixed(2)}deg`);
          tiltTarget.style.setProperty('--tilt-y', `${Math.max(-5, Math.min(5, ry)).toFixed(2)}deg`);
        }
      };
      const move = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY }; if (!heroFrame) heroFrame = requestAnimationFrame(apply); };
      const leave = () => { tiltTarget?.style.setProperty('--tilt-x', '0deg'); tiltTarget?.style.setProperty('--tilt-y', '0deg'); };
      hero.addEventListener('pointermove', move);
      hero.addEventListener('pointerleave', leave);
      cleanups.push(() => { hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', leave); if (heroFrame) cancelAnimationFrame(heroFrame); });
    }

    // Magnetic primary buttons.
    const buttons: HTMLElement[] = Array.from(root.querySelectorAll<HTMLElement>('.cl-primary:not(.cl-small), .cl-secondary'));
    buttons.forEach((button) => {
      const move = (event: PointerEvent) => {
        const rect = button.getBoundingClientRect();
        const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
        const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
        button.style.setProperty('--mag-x', `${(dx * 8).toFixed(1)}px`);
        button.style.setProperty('--mag-y', `${(dy * 6).toFixed(1)}px`);
      };
      const leave = () => { button.style.setProperty('--mag-x', '0px'); button.style.setProperty('--mag-y', '0px'); };
      button.addEventListener('pointermove', move);
      button.addEventListener('pointerleave', leave);
      cleanups.push(() => { button.removeEventListener('pointermove', move); button.removeEventListener('pointerleave', leave); });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [rootRef]);
}
