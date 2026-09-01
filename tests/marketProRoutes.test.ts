import { describe, expect, it } from 'vitest';
import { destinationForPath, pathForDestination } from '../src/appRoutes';

describe('ArthaMind Pro market routes', () => {
  it('maps every dedicated market route', () => {
    const routes = {
      'india-markets': '/finance/markets/india',
      'intraday-markets': '/finance/markets/intraday',
      'forex-markets': '/finance/markets/forex',
      'us-markets': '/finance/markets/us',
      'market-watchlist': '/finance/markets/watchlist',
      'market-alerts': '/finance/markets/alerts',
      'markets-learn': '/finance/markets/learn',
      'go-pro': '/go-pro',
    } as const;
    for (const [destination, path] of Object.entries(routes)) {
      expect(pathForDestination(destination as keyof typeof routes)).toBe(path);
      expect(destinationForPath(path)).toBe(destination);
    }
  });

  it('keeps India company detail URLs associated with India Market Explorer', () => {
    expect(destinationForPath('/finance/markets/india/RELIANCE')).toBe('india-markets');
  });
});
