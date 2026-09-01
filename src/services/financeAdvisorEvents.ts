import { AppNavigationDestination } from '../navigationTypes';

export const FINANCE_ADVISOR_OPEN_EVENT = 'arthabench:finance-advisor-open';

export type FinanceAdvisorOpenDetail = {
  module?: AppNavigationDestination;
  question?: string;
};

export function openFinanceAdvisor(detail: FinanceAdvisorOpenDetail = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FinanceAdvisorOpenDetail>(FINANCE_ADVISOR_OPEN_EVENT, { detail }));
}
