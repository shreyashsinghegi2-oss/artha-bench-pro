export const AI_CONTEXT_STORAGE_KEY = 'arthabench_ai_context_v1';
export const AI_CONTEXT_USAGE_STORAGE_KEY = 'arthabench_ai_context_usage_v1';

export interface AiDataContextPreferences {
  income: boolean;
  expenses: boolean;
  budgets: boolean;
  emis: boolean;
  goals: boolean;
  paperPortfolio: boolean;
  learningProgress: boolean;
  saveConversation: boolean;
  /** Compatibility flag for older modules. */
  personalFinance: boolean;
  /** Compatibility flag for older modules. */
  budgetsAndGoals: boolean;
}

export interface AiContextUsageEntry {
  id: string;
  usedAt: string;
  module: string;
  period: string;
  categories: string[];
}

export const DEFAULT_AI_CONTEXT: AiDataContextPreferences = {
  income: false,
  expenses: false,
  budgets: false,
  emis: false,
  goals: false,
  paperPortfolio: false,
  learningProgress: false,
  saveConversation: false,
  personalFinance: false,
  budgetsAndGoals: false,
};

export function normalizeAiContext(input: Partial<AiDataContextPreferences> = {}): AiDataContextPreferences {
  const legacyPersonal = input.personalFinance === true;
  const legacyBudget = input.budgetsAndGoals === true;
  const income = input.income === true || legacyPersonal;
  const expenses = input.expenses === true || legacyPersonal;
  const emis = input.emis === true || legacyPersonal;
  const budgets = input.budgets === true || legacyBudget;
  const goals = input.goals === true || legacyBudget;
  return {
    income,
    expenses,
    budgets,
    emis,
    goals,
    paperPortfolio: input.paperPortfolio === true,
    learningProgress: input.learningProgress === true,
    saveConversation: input.saveConversation === true,
    personalFinance: income || expenses || emis,
    budgetsAndGoals: budgets || goals,
  };
}

export function loadAiDataContext(): AiDataContextPreferences {
  if (typeof window === 'undefined') return DEFAULT_AI_CONTEXT;
  try {
    const raw = localStorage.getItem(AI_CONTEXT_STORAGE_KEY);
    return raw ? normalizeAiContext(JSON.parse(raw)) : DEFAULT_AI_CONTEXT;
  } catch {
    return DEFAULT_AI_CONTEXT;
  }
}

export function saveAiDataContext(preferences: AiDataContextPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_CONTEXT_STORAGE_KEY, JSON.stringify(normalizeAiContext(preferences)));
}

export function updateAiDataContext(changes: Partial<AiDataContextPreferences>): AiDataContextPreferences {
  const next = normalizeAiContext({ ...loadAiDataContext(), ...changes });
  saveAiDataContext(next);
  return next;
}

export function logAiContextUsage(entry: Omit<AiContextUsageEntry, 'id' | 'usedAt'>): void {
  if (typeof window === 'undefined') return;
  const current = loadAiContextUsage();
  const next: AiContextUsageEntry = { id: crypto.randomUUID(), usedAt: new Date().toISOString(), ...entry };
  localStorage.setItem(AI_CONTEXT_USAGE_STORAGE_KEY, JSON.stringify([next, ...current].slice(0, 100)));
}

export function loadAiContextUsage(): AiContextUsageEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_CONTEXT_USAGE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((row) => row && typeof row.usedAt === 'string' && Array.isArray(row.categories)) : [];
  } catch {
    return [];
  }
}
