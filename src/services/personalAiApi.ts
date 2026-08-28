import { DashboardAssistantSnapshot, DashboardAssistantResponse } from '../types';
import { AiDataContextPreferences } from './aiDataContext';

export interface PersonalizedDashboardAssistantResponse extends DashboardAssistantResponse {
  personalDataUsed: boolean;
  personalContextReferences: string[];
}

export async function askPersonalizedDashboardAssistant(params: {
  token: string;
  question: string;
  snapshot: DashboardAssistantSnapshot;
  settings: AiDataContextPreferences;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<PersonalizedDashboardAssistantResponse> {
  const response = await fetch('/api/personal/assistant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      question: params.question,
      history: params.history,
      settings: params.settings,
      publicContext: {
        capturedAt: params.snapshot.capturedAt,
        selectedSymbol: params.snapshot.selectedSymbol,
        selectedRange: params.snapshot.selectedRange,
        selectedCountry: params.snapshot.selectedCountry,
        quotes: params.snapshot.quotes,
        economicIndicators: params.snapshot.economicIndicators,
        latestEvaluation: params.snapshot.latestEvaluation,
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Personalized ArthaMind request failed.');
  return payload as PersonalizedDashboardAssistantResponse;
}
