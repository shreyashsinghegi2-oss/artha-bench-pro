import type {
  CryptoAssistantContext,
  CryptoInterval,
  CryptoKlinesResponse,
  CryptoMarketsResponse,
  CryptoSymbol,
} from '../components/crypto/cryptoTypes';

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

export function getCryptoMarkets(signal?: AbortSignal): Promise<CryptoMarketsResponse> {
  return requestJson('/api/crypto/markets', { signal });
}

export function getCryptoKlines(
  symbol: CryptoSymbol,
  interval: CryptoInterval,
  signal?: AbortSignal,
): Promise<CryptoKlinesResponse> {
  const query = new URLSearchParams({ symbol, interval });
  return requestJson(`/api/crypto/klines?${query.toString()}`, { signal });
}

export function askCryptoAssistant(
  question: string,
  context: CryptoAssistantContext,
): Promise<{ answer: string }> {
  return requestJson('/api/crypto/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  });
}
