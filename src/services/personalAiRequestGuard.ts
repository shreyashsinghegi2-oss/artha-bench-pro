import { loadAiDataContext } from './aiDataContext';

let installed = false;

/**
 * Compatibility privacy guard for older finance-specific assistant panels.
 * New finance assistant requests already build snapshots from enabled categories;
 * this prevents legacy Income/Expenses/Budgeting prompts from leaving the browser
 * when the matching context category is disabled.
 */
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
        const required: Array<[RegExp, boolean, string]> = [
          [/ArthaMind Income Intelligence|Artha Income AI/i, prefs.income, 'Income'],
          [/ArthaMind Expense Intelligence|expense question using ONLY|recorded expense/i, prefs.expenses, 'Expenses'],
          [/ArthaMind Budget Coach|budget coach/i, prefs.budgets, 'Budgets'],
        ];
        const blocked = required.find(([pattern, enabled]) => pattern.test(prompt) && !enabled);
        if (blocked) {
          return new Response(JSON.stringify({ error: `Enable ${blocked[2]} context before asking ArthaMind to use that personal data.` }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch {
        // If the request body is not parseable, preserve the existing request path.
      }
    }
    return nativeFetch(input, init);
  };
}
