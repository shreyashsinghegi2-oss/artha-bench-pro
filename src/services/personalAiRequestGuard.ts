import { loadAiDataContext } from './aiDataContext';

let installed = false;

/** Browser-side compatibility policy for older personal-finance assistant panels. */
export function installPersonalAiRequestGuard(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/tutor') && typeof init?.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        const prompt = String(payload?.userPrompt || payload?.message || '');
        const prefs = loadAiDataContext();
        const missing: string[] = [];
        if (/ArthaMind Income Intelligence|Artha Income AI/i.test(prompt) && !prefs.income) missing.push('Income');
        if (/ArthaMind Expense Intelligence|expense question using ONLY|recorded expense/i.test(prompt)) {
          if (!prefs.expenses) missing.push('Expenses');
          if (/monthlyIncomeINR|estimated INR income|remainingAfterExpenses/i.test(prompt) && !prefs.income) missing.push('Income');
        }
        if (/ArthaMind Budget Coach|budget coach/i.test(prompt)) {
          if (!prefs.budgets) missing.push('Budgets');
          if (/actualSpending|linked expenses|monthExpenses/i.test(prompt) && !prefs.expenses) missing.push('Expenses');
          if (/monthlyIncomeINR|monthlyIncome/i.test(prompt) && !prefs.income) missing.push('Income');
        }
        const required = [...new Set(missing)];
        if (required.length) {
          return new Response(JSON.stringify({ error: `Enable ${required.join(' + ')} context before asking ArthaMind to use those personal records.` }), { status: 403, headers: { 'Content-Type': 'application/json' } });
        }
      } catch {
        // Preserve non-JSON/public Tutor requests.
      }
    }
    return nativeFetch(input, init);
  };
}
