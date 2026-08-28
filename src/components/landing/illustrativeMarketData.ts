export type IllustrativeMarketSignal = {
  symbol: string;
  label: string;
  change: number;
  direction: 'up' | 'down';
};

export const illustrativeMarketData: IllustrativeMarketSignal[] = [
  { symbol: 'NIFTY 50', label: 'India', change: 0.42, direction: 'up' },
  { symbol: 'SENSEX', label: 'India', change: 0.31, direction: 'up' },
  { symbol: 'S&P 500', label: 'US', change: -0.18, direction: 'down' },
  { symbol: 'NASDAQ', label: 'US', change: 0.27, direction: 'up' },
  { symbol: 'GOLD', label: 'Commodity', change: 0.14, direction: 'up' },
  { symbol: 'BTC', label: 'Crypto', change: -0.36, direction: 'down' },
  { symbol: 'ETH', label: 'Crypto', change: 0.22, direction: 'up' },
  { symbol: 'RELIANCE', label: 'India', change: 0.19, direction: 'up' },
];

export const illustrativeDisclosure = 'Illustrative market context — not live market data';
