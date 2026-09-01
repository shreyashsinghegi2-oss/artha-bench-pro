import { NavigationDestination } from './types';

export type AppNavigationDestination = NavigationDestination | 'finance-reports' | 'emi-manager' | 'financial-health';

export const FINANCE_DESTINATIONS: readonly AppNavigationDestination[] = [
  'overview',
  'financial-health',
  'income',
  'expenses',
  'budgeting',
  'finance-reports',
  'emi-manager',
  'decision-replay',
] as const;

export function isFinanceDestination(destination: AppNavigationDestination): boolean {
  return destination === 'dashboard' || FINANCE_DESTINATIONS.includes(destination);
}
