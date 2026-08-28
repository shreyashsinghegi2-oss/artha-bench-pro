export const AI_CONTEXT_STORAGE_KEY = 'arthabench_ai_context_v1';

export interface AiDataContextPreferences {
  personalFinance: boolean;
  budgetsAndGoals: boolean;
  paperPortfolio: boolean;
  learningProgress: boolean;
  saveConversation: boolean;
}

export const DEFAULT_AI_CONTEXT: AiDataContextPreferences = {
  personalFinance: false,
  budgetsAndGoals: false,
  paperPortfolio: false,
  learningProgress: false,
  saveConversation: false,
};

export function loadAiDataContext(): AiDataContextPreferences {
  if (typeof window === 'undefined') return DEFAULT_AI_CONTEXT;
  try {
    const raw = localStorage.getItem(AI_CONTEXT_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONTEXT;
    const parsed = JSON.parse(raw) as Partial<AiDataContextPreferences>;
    return {
      personalFinance: parsed.personalFinance === true,
      budgetsAndGoals: parsed.budgetsAndGoals === true,
      paperPortfolio: parsed.paperPortfolio === true,
      learningProgress: parsed.learningProgress === true,
      saveConversation: parsed.saveConversation === true,
    };
  } catch {
    return DEFAULT_AI_CONTEXT;
  }
}

export function saveAiDataContext(preferences: AiDataContextPreferences): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AI_CONTEXT_STORAGE_KEY, JSON.stringify(preferences));
}
