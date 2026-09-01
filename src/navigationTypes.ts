import { NavigationDestination } from './types';

export type AppNavigationDestination = NavigationDestination
  | 'finance-reports'
  | 'emi-manager'
  | 'financial-health'
  | 'financial-twin'
  | 'india-markets'
  | 'intraday-markets'
  | 'forex-markets'
  | 'us-markets'
  | 'market-watchlist'
  | 'market-alerts'
  | 'markets-learn'
  | 'go-pro';

export const FINANCE_DESTINATIONS: readonly AppNavigationDestination[] = [
  'overview',
  'financial-health',
  'income',
  'expenses',
  'budgeting',
  'finance-reports',
  'emi-manager',
  'decision-replay',
  'financial-twin',
] as const;

export const MARKET_PRO_DESTINATIONS: readonly AppNavigationDestination[] = [
  'india-markets',
  'intraday-markets',
  'forex-markets',
  'us-markets',
  'market-watchlist',
  'market-alerts',
  'markets-learn',
  'go-pro',
] as const;

export function isFinanceDestination(destination: AppNavigationDestination): boolean {
  return destination === 'dashboard' || FINANCE_DESTINATIONS.includes(destination);
}

export function isMarketProDestination(destination: AppNavigationDestination): boolean {
  return MARKET_PRO_DESTINATIONS.includes(destination);
}
