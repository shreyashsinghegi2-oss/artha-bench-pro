import { afterEach, describe, expect, it, vi } from 'vitest';
import { installAiFetchResilience } from '../src/services/aiFetchResilience';

function installWithNativeFetch(nativeFetch: ReturnType<typeof vi.fn>) {
  const fakeWindow = {
    location: { origin: 'https://artha-bench.example' },
    fetch: nativeFetch,
  } as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', fakeWindow);
  installAiFetchResilience();
  return fakeWindow;
}

async function jsonOf(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AI endpoint resilience boundary', () => {
  it('passes a successful AI response through unchanged', async () => {
    const native = vi.fn().mockResolvedValue(new Response(JSON.stringify({ answer: 'real model response' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/crypto/assistant', {
      method: 'POST',
      body: JSON.stringify({ question: 'Explain candle', context: { close: 100 } }),
    });
    expect(await jsonOf(response)).toEqual({ answer: 'real model response' });
    expect(response.headers.get('X-Artha-Fallback')).toBeNull();
  });

  it('returns a grounded Dashboard Assistant response on provider 503', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/dashboard/assistant', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Explain this dashboard.',
        snapshot: {
          capturedAt: '2026-09-01T03:00:00.000Z',
          selectedSymbol: 'SPY',
          quotes: [{ symbol: 'SPY', price: 700, providerName: 'Yahoo Finance · experimental/reference', freshness: 'delayed' }],
          economicIndicators: [{ label: 'US CPI', value: 2.8, sourceName: 'FRED' }],
        },
      }),
    });
    const body = await jsonOf(response);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Artha-Fallback')).toBe('grounded-client');
    expect(body.answer).toContain('ArthaMind grounded fallback mode');
    expect(body.answer).toContain('SPY');
    expect(body.sourceLabels).toContain('Yahoo Finance · experimental/reference');
    expect(body.sourceLabels).toContain('FRED');
    expect(body.structuredAnswer.directAnswer).toContain('grounded fallback');
  });

  it('never claims personal data was used when the personalized endpoint is unavailable', async () => {
    const native = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/personal/assistant', {
      method: 'POST',
      headers: { Authorization: 'Bearer hidden-user-token' },
      body: JSON.stringify({
        question: 'Summarize my finances.',
        publicContext: { selectedSymbol: 'SPY', capturedAt: '2026-09-01T03:00:00.000Z' },
        settings: { personalFinance: true },
      }),
    });
    const body = await jsonOf(response);
    expect(body.personalDataUsed).toBe(false);
    expect(body.answer).toContain('did not read or infer private finance records');
    expect(JSON.stringify(body)).not.toContain('hidden-user-token');
  });

  it('does not mask authentication and authorization failures', async () => {
    for (const status of [401, 403]) {
      const native = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'not authorized' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }));
      const browser = installWithNativeFetch(native);
      const response = await browser.fetch('/api/personal/assistant', {
        method: 'POST',
        body: JSON.stringify({ question: 'Use my private data' }),
      });
      expect(response.status).toBe(status);
      expect(response.headers.get('X-Artha-Fallback')).toBeNull();
    }
  });

  it('returns a Company Intelligence answer without inventing fundamentals', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/company/assistant', {
      method: 'POST',
      body: JSON.stringify({ symbol: 'AAPL', question: 'Explain the company.' }),
    });
    const body = await jsonOf(response);
    expect(body.symbol).toBe('AAPL');
    expect(body.answer).toContain('No valuation ratio, earnings figure, analyst trend, target, fundamental, or company fact has been invented');
    expect(body.structuredAnswer.sources[0].name).toContain('AAPL');
  });

  it('grounds Crypto Assistant fallback in the selected Binance candle context', async () => {
    const native = vi.fn().mockRejectedValue(new Error('AI offline'));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/crypto/assistant', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Explain this candle.',
        context: { symbol: 'BTCUSDT', close: 109250.5, percentChange: 1.2, provider: 'Binance Public Market Data', streamStatus: 'connected' },
      }),
    });
    const body = await jsonOf(response);
    expect(body.answer).toContain('BTCUSDT');
    expect(body.answer).toContain('109250.5');
    expect(body.answer).toContain('Binance Public Market Data');
  });

  it('keeps Scenario Assistant fallback separate from deterministic calculation claims', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/finance/scenario-assistant', {
      method: 'POST',
      body: JSON.stringify({
        scenario: 'compound',
        question: 'Explain the result.',
        profile: 'India',
        currency: 'INR',
        inputs: { principal: 100000, annualRate: 8, years: 5 },
      }),
    });
    const body = await jsonOf(response);
    expect(body.engine).toBe('Client grounded fallback — no new calculation');
    expect(body.structuredAnswer.directAnswer).toContain('does not claim a newly verified deterministic result');
    expect(body.sourceLabels).toEqual(['Visible scenario inputs / calculator state']);
  });

  it('uses only the supplied headline metadata for News fallback', async () => {
    const native = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    const browser = installWithNativeFetch(native);
    const response = await browser.fetch('/api/news/explain', {
      method: 'POST',
      body: JSON.stringify({
        title: 'RBI policy update',
        summary: 'A supplied summary.',
        sourceName: 'Official source',
        sourceUrl: 'https://example.com/source',
        publishedAt: '2026-09-01T00:00:00.000Z',
      }),
    });
    const body = await jsonOf(response);
    expect(body.explanation).toContain('RBI policy update');
    expect(body.structuredAnswer.sources[0].name).toBe('Official source');
    expect(body.keyTakeaways.length).toBeGreaterThan(0);
  });
});
