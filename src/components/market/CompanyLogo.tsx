import React from 'react';

/**
 * Company logo files supplied by the site owner (public/logos). Marks belong to their owners and are
 * shown only to identify the listed security. Symbols without a file fall back to each caller's badge.
 */
const LOGOS: Record<string, { src: string; name: string; match: RegExp }> = {
  RELIANCE: { src: '/logos/RELIANCE.png', name: 'Reliance Industries', match: /\bReliance\b/i },
  TCS: { src: '/logos/TCS.png', name: 'Tata Consultancy Services', match: /\bTCS\b|Tata Consultancy/i },
  HDFCBANK: { src: '/logos/HDFCBANK.png', name: 'HDFC Bank', match: /\bHDFC Bank\b/i },
  INFY: { src: '/logos/INFY.png', name: 'Infosys', match: /\bInfosys\b/i },
  ICICIBANK: { src: '/logos/ICICIBANK.png', name: 'ICICI Bank', match: /\bICICI Bank\b/i },
};

/** "RELIANCE.NS", "TCS:NSE" and "hdfcbank" all resolve to the same key. */
export const logoKey = (symbol: string) => symbol.toUpperCase().replace(/\.(NS|BO)$/, '').replace(/:(NSE|BSE)$/, '').trim();

export const companyLogoSrc = (symbol: string): string | undefined => LOGOS[logoKey(symbol)]?.src;

/** First known company named in a piece of text (e.g. a news headline). */
export const companyLogoInText = (text: string): { symbol: string; src: string; name: string } | undefined => {
  const hit = Object.entries(LOGOS).find(([, logo]) => logo.match.test(text));
  return hit && { symbol: hit[0], src: hit[1].src, name: hit[1].name };
};

export const CompanyLogo: React.FC<{ symbol: string; size?: number; className?: string }> = ({ symbol, size = 28, className = '' }) => {
  const logo = LOGOS[logoKey(symbol)];
  if (!logo) return null;
  return <img src={logo.src} alt={`${logo.name} logo`} width={size} height={size} loading="lazy" decoding="async"
    className={`shrink-0 rounded-lg bg-white object-contain ${className}`.trim()} style={{ width: size, height: size }} />;
};
