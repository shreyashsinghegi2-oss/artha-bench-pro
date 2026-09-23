import React from 'react';

/**
 * ArthaMind AI mark: one continuous stroke reads as "AM" (the A's peak runs into the M's two peaks)
 * and as a simple price line, ending in an evidence node. Monochrome via currentColor; the node takes
 * the accent colour on hover or when the parent is active (see .am-mark in landingHero.css).
 * Drawn on a 24px grid with 2px strokes so it stays crisp at 24px.
 */
export const ArthaMindMark: React.FC<{ size?: number; className?: string; title?: string }> = ({ size = 24, className = '', title }) => (
  <svg
    className={`am-mark ${className}`.trim()}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <rect x="1" y="1" width="22" height="22" rx="6" stroke="currentColor" strokeWidth="1.5" opacity=".22" />
    <path d="M5 17.5 8.5 7l3.5 10.5L15.5 7 19 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6.6 13h3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle className="am-node" cx="15.5" cy="7" r="2.1" fill="currentColor" />
  </svg>
);
