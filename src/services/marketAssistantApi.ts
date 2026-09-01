export type AssistantResponseStatus =
  | 'success'
  | 'insufficient_context'
  | 'provider_unavailable'
  | 'rate_limited'
  | 'authentication_required'
  | 'safety_redirect'
  | 'error';

export type EvidenceReference = {
  id: string;
  label: string;
  sourceType:
    | 'market_quote'
    | 'market_history'
    | 'economic_indicator'
    | 'company_profile'
    | 'news'
    | 'user_record'
    | 'calculation'
    | 'learning_content'
    | 'provider_status';
  providerName?: string;
  sourceUrl?: string;
  timestamp?: string;
  retrievedAt?: string;
  freshnessState?: string;
  valueSummary?: string;
};

export type MarketAssistantResponse = {
  status: AssistantResponseStatus;
  answer: string;
  sections: Array<{ title: string; content: string }>;
  evidence: EvidenceReference[];
  limitations: string[];
  suggestedActions: Array<{
    label: string;
    actionType: 'navigate' | 'open_modal' | 'retry' | 'learn_more';
    href?: string;
  }>;
  generatedAt: string;
  requestId: string | null;
};

export async function askMarketExplainer(input: {
  page: string;
  question: string;
  visibleData: unknown;
  evidence: EvidenceReference[];
}): Promise<MarketAssistantResponse> {
  const response = await fetch('/api/markets/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null) as MarketAssistantResponse | null;
  if (!body || !body.status) {
    throw new Error('ArthaMind returned an invalid market-explainer response.');
  }
  return body;
}
