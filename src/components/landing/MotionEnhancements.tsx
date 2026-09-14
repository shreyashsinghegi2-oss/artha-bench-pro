import React, { useEffect, useRef, useState } from 'react';

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export const ScrollRevealOnce: React.FC<React.PropsWithChildren<{ className?: string; delay?: number }>> = ({
  children,
  className = '',
  delay = 0,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShown(true);
        observer.disconnect();
      }
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <div ref={ref} className={`additive-scroll-reveal ${shown ? 'is-visible' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export const EvidenceFlow: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`additive-evidence-flow ${className}`}>{children}</div>
);

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export const AnimatedFeatureSurface: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`additive-feature-surface ${className}`}>{children}</div>
);

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export const HeroCinematicReveal: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const key = 'artha-bench-pro:hero-cinematic-reveal-v1';
      if (sessionStorage.getItem(key) === '1') {
        setReady(true);
        return;
      }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setReady(true);
        sessionStorage.setItem(key, '1');
        return;
      }
      const id = window.requestAnimationFrame(() => setReady(true));
      const timer = window.setTimeout(() => sessionStorage.setItem(key, '1'), 2600);
      return () => {
        window.cancelAnimationFrame(id);
        window.clearTimeout(timer);
      };
    } catch {
      setReady(true);
    }
  }, []);

  return <div className={`additive-hero-cinematic ${ready ? 'is-ready' : ''} ${className}`}>{children}</div>;
};

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export const ProductTiltShell: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = '' }) => (
  <div className={`additive-product-tilt-shell ${className}`}>{children}</div>
);

// ADDITIVE MOTION ENHANCEMENT — existing behavior preserved
export const ChartHoverOverlay: React.FC<{ visible: boolean; x: number; y: number; children?: React.ReactNode }> = ({ visible, x, y, children }) => (
  <div className={`additive-chart-tooltip ${visible ? 'is-visible' : ''}`} style={{ left: `${x}px`, top: `${y}px` }} role="status" aria-live="polite">
    {children}
  </div>
);
