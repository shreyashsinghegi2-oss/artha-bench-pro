import { AppNavigationDestination } from './navigationTypes';

export type PublicPageId = 'trust' | 'about' | 'methodology-public' | 'roadmap' | 'support' | 'changelog' | 'access';
export type AppLocation =
  | { kind: 'landing' }
  | { kind: 'workspace'; destination: AppNavigationDestination }
  | { kind: 'public'; page: PublicPageId }
  | { kind: 'auth'; returnTo: string };

const financePaths: Partial<Record<AppNavigationDestination, string>> = {
  overview: '/finance/overview',
  'financial-health': '/finance/health',
  income: '/finance/income',
  expenses: '/finance/expenses',
  budgeting: '/finance/budgeting',
  'finance-reports': '/finance/reports',
  'emi-manager': '/finance/emi-manager',
  'decision-replay': '/finance/decision-replay',
  'financial-twin': '/finance/ripple-twin',
  'india-markets': '/finance/markets/india',
};

const workspacePaths: Partial<Record<AppNavigationDestination, string>> = {
  dashboard: '/workspace/research-dashboard',
  markets: '/workspace/markets',
  crypto: '/workspace/crypto',
  'quick-check': '/workspace/quick-check',
  tutor: '/workspace/financial-tutor',
  'evaluation-lab': '/workspace/evaluation-lab',
  comparison: '/workspace/comparison',
  scenarios: '/workspace/scenarios',
  batch: '/workspace/batch-benchmark',
  reports: '/workspace/evaluation-reports',
  methodology: '/workspace/evaluation-methodology',
  connections: '/workspace/connections',
  learning: '/workspace/learning',
  news: '/workspace/business-news',
  economy: '/workspace/economic-data',
  settings: '/workspace/settings',
  account: '/workspace/account',
};

const publicPaths: Record<PublicPageId, string> = {
  trust: '/trust',
  about: '/about',
  'methodology-public': '/methodology',
  roadmap: '/roadmap',
  support: '/support',
  changelog: '/changelog',
  access: '/access',
};

const pathToWorkspace = new Map<string, AppNavigationDestination>([
  ...Object.entries(financePaths),
  ...Object.entries(workspacePaths),
].map(([destination, path]) => [path as string, destination as AppNavigationDestination]));
const pathToPublic = new Map<string, PublicPageId>(Object.entries(publicPaths).map(([page, path]) => [path, page as PublicPageId]));

export const PRIVATE_FINANCE_DESTINATIONS = new Set<AppNavigationDestination>([
  'financial-health', 'income', 'expenses', 'budgeting', 'finance-reports', 'emi-manager', 'decision-replay', 'financial-twin',
]);

export function pathForDestination(destination: AppNavigationDestination): string {
  return financePaths[destination] ?? workspacePaths[destination] ?? '/finance/overview';
}

export function destinationForPath(path: string): AppNavigationDestination | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized.startsWith('/finance/markets/india/')) return 'india-markets';
  return pathToWorkspace.get(normalized) ?? null;
}

export function pathForPublicPage(page: PublicPageId): string {
  return publicPaths[page];
}

export function readAppLocation(): AppLocation {
  if (typeof window === 'undefined') return { kind: 'landing' };
  const normalized = window.location.pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/auth') {
    const returnTo = new URLSearchParams(window.location.search).get('returnTo') || '/finance/overview';
    return { kind: 'auth', returnTo };
  }
  const publicPage = pathToPublic.get(normalized);
  if (publicPage) return { kind: 'public', page: publicPage };
  if (normalized.startsWith('/finance/markets/india/')) return { kind: 'workspace', destination: 'india-markets' };
  const destination = pathToWorkspace.get(normalized);
  if (destination) return { kind: 'workspace', destination };
  if (window.location.hash === '#workspace') return { kind: 'workspace', destination: 'overview' };
  return { kind: 'landing' };
}

export function pushDestination(destination: AppNavigationDestination, replace = false): void {
  const url = pathForDestination(destination);
  window.history[replace ? 'replaceState' : 'pushState']({ destination }, '', url);
}

export function pushAuth(returnTo: string, replace = false): void {
  const safeReturnTo = returnTo.startsWith('/') ? returnTo : '/finance/overview';
  const url = `/auth?returnTo=${encodeURIComponent(safeReturnTo)}`;
  window.history[replace ? 'replaceState' : 'pushState']({ auth: true, returnTo: safeReturnTo }, '', url);
}

export function pushPublicPage(page: PublicPageId, replace = false): void {
  window.history[replace ? 'replaceState' : 'pushState']({ publicPage: page }, '', pathForPublicPage(page));
}

export function pushLanding(replace = false): void {
  window.history[replace ? 'replaceState' : 'pushState']({ landing: true }, '', '/');
}
