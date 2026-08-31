import { NavigationDestination } from './types';

export type AppNavigationDestination = NavigationDestination | 'finance-reports' | 'emi-manager';

export const FINANCE_DESTINATIONS: readonly AppNavigationDestination[] = [
  'overview',
  'income',
  'expenses',
  'budgeting',
  'finance-reports',
  'emi-manager',
] as const;

export function isFinanceDestination(destination: AppNavigationDestination): boolean {
  return destination === 'dashboard' || destination === 'decision-replay' || FINANCE_DESTINATIONS.includes(destination);
}
