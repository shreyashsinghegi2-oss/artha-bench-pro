import React, { Suspense, useEffect, useRef, useState } from 'react';

/**
 * Loads a below-the-fold landing section only when the visitor scrolls near it, so the first
 * download stays small. Until then a same-height placeholder keeps the page layout and any
 * navigation anchor (#id) working.
 */
export function lazyOnView<P extends object>(loader: () => Promise<{ default: React.ComponentType<P> }>, opts: { minHeight: number; anchorId?: string }): React.FC<P> {
  const Lazy = React.lazy(loader);
  const Wrapped: React.FC<P> = (props) => {
    const [show, setShow] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (show) return;
      const el = ref.current;
      if (!el || typeof IntersectionObserver === 'undefined') { setShow(true); return; }
      const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: '900px 0px' });
      io.observe(el);
      // Start loading anyway once the page is idle, so fast scrollers rarely see a placeholder.
      const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      const t = idle ? idle(() => { void loader(); }, { timeout: 4000 }) : window.setTimeout(() => { void loader(); }, 3000);
      return () => { io.disconnect(); if (!idle) window.clearTimeout(t as number); };
    }, [show]);
    const placeholder = <div ref={ref} id={opts.anchorId} style={{ minHeight: opts.minHeight }} aria-hidden="true"/>;
    return show ? <Suspense fallback={placeholder}><Lazy {...props}/></Suspense> : placeholder;
  };
  return Wrapped;
}
