import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkNewsProviderDiagnostic,
  fetchNewsFromProvider,
} from '../server/providers/newsProvider';
import {
  fetchHistoryFromProvider,
  fetchQuoteFromProvider,
} from '../server/providers/marketDataProvider';
import {
  checkFredDiagnostic,
  fetchFredOverview,
  fetchFredSeries,
} from '../server/providers/fredProvider';
import {
  fetchWorldBankIndiaOverview,
  fetchWorldBankIndiaSeries,
} from '../server/providers/worldBankProvider';

const trackedEnvironmentKeys = [
  'BUSINESS_NEWS_PROVIDER',
  'BUSINESS_NEWS_API_KEY',
  'BUSINESS_NEWS_BASE_URL',
  'MARKET_DATA_PROVIDER',
  'MARKET_DATA_API_KEY',
  'MARKET_DATA_BASE_URL',
  'FRED_API_KEY',
  'FRED_API_BASE_URL',
] as const;

const originalEnvironment = Object.fromEntries(
  trackedEnvironmentKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const key of trackedEnvironmentKeys) {
    const originalValue = originalEnvironment[key];
    if (originalValue === undefined) delete process.env[key];
    else process.env[key] = originalValue;
  }
});

describe('NewsData.io provider adapter', () => {
  it('authenticates with apikey and maps the NewsData results schema', async () => {
    process.env.BUSINESS_NEWS_PROVIDER = 'newsdata';
    process.env.BUSINESS_NEWS_API_KEY = 'news-test-secret';
    process.env.BUSINESS_NEWS_BASE_URL = 'https://newsdata.io/api/1/latest';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          results: [
            {
              article_id: 'article-1',
              title: 'Markets react to policy decision',
              description: 'A concise description.',
              link: 'https://publisher.example/article-1',
              pubDate: '2026-08-16 10:00:00',
              image_url: 'https://publisher.example/image.jpg',
              source_id: 'publisher',
              source_name: 'Publisher',
              category: ['business'],
              country: ['india'],
            },
          ],
          nextPage: 'opaque-token',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchNewsFromProvider('markets', 'corporate', 'india');

    expect(result.status).toBe('connected');
    expect(result.items[0]).toMatchObject({
      id: 'article-1',
      sourceName: 'Publisher',
      category: 'business',
      region: 'india',
    });
    expect(result.nextPage).toBe('opaque-token');

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get('apikey')).toBe('news-test-secret');
    expect(requestUrl.searchParams.get('apiKey')).toBeNull();
    expect(requestUrl.searchParams.get('category')).toBe('business');
    expect(requestUrl.searchParams.get('country')).toBe('in');
  });

  it('returns labelled demo news when the API key is absent', async () => {
    delete process.env.BUSINESS_NEWS_API_KEY;
    const result = await fetchNewsFromProvider();
    expect(result.status).toBe('not_configured');
    expect(result.providerName).toContain('Demo');
    expect(result.items.every((item) => item.sourceName.includes('Demo'))).toBe(true);
  });

  it('does not expose the credential in diagnostic messages', async () => {
    process.env.BUSINESS_NEWS_PROVIDER = 'newsdata';
    process.env.BUSINESS_NEWS_API_KEY = 'never-return-this-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 401 })),
    );

    const diagnostic = await checkNewsProviderDiagnostic();
    expect(diagnostic.status).toBe('invalid_credentials');
    expect(diagnostic.message).not.toContain('never-return-this-key');
  });
});

describe('Twelve Data provider adapter', () => {
  it('authenticates with apikey and normalizes a quote response', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelvedata';
    process.env.MARKET_DATA_API_KEY = 'market-test-secret';
    process.env.MARKET_DATA_BASE_URL = 'https://api.twelvedata.com/quote';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          symbol: 'AAPL',
          name: 'Apple Inc',
          exchange: 'NASDAQ',
          currency: 'USD',
          datetime: '2026-08-16',
          open: '221.00',
          high: '225.00',
          low: '220.00',
          close: '224.50',
          previous_close: '221.80',
          change: '2.70',
          percent_change: '1.22',
          volume: '48200000',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchQuoteFromProvider('AAPL');

    expect(result.status).toBe('connected');
    expect(result.quote).toMatchObject({
      symbol: 'AAPL',
      price: 224.5,
      change: 2.7,
      changePercent: 1.22,
      providerName: 'Twelve Data',
    });

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe('/quote');
    expect(requestUrl.searchParams.get('apikey')).toBe('market-test-secret');
    expect(requestUrl.searchParams.get('apiKey')).toBeNull();
  });

  it('loads and orders Twelve Data history without a synthetic live claim', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelvedata';
    process.env.MARKET_DATA_API_KEY = 'market-test-secret';
    process.env.MARKET_DATA_BASE_URL = 'https://api.twelvedata.com/quote';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          values: [
            { datetime: '2026-08-15', close: '220.00', volume: '100' },
            { datetime: '2026-08-16', close: '224.50', volume: '200' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const points = await fetchHistoryFromProvider('AAPL', '1m');
    expect(points).toEqual([
      { date: '2026-08-15', price: 220, volume: 100 },
      { date: '2026-08-16', price: 224.5, volume: 200 },
    ]);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe('/time_series');
    expect(requestUrl.searchParams.get('interval')).toBe('1day');
  });

  it('returns a labelled demo quote when the API key is absent', async () => {
    delete process.env.MARKET_DATA_API_KEY;
    const result = await fetchQuoteFromProvider('AAPL');
    expect(result.status).toBe('not_configured');
    expect(result.quote.freshness).toBe('demo');
    expect(result.quote.providerName).toContain('Demo');
  });
});

describe('FRED provider adapter', () => {
  it('authenticates server-side and normalizes economic observations', async () => {
    process.env.FRED_API_KEY = 'fred-test-secret';
    process.env.FRED_API_BASE_URL =
      'https://api.stlouisfed.org/fred/series/observations';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          observations: [
            { date: '2026-06-01', value: '4.2' },
            { date: '2026-07-01', value: '4.1' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFredSeries('UNRATE', 2);
    expect(result.status).toBe('connected');
    expect(result.observations).toEqual([
      { date: '2026-06-01', value: 4.2 },
      { date: '2026-07-01', value: 4.1 },
    ]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get('series_id')).toBe('UNRATE');
    expect(requestUrl.searchParams.get('api_key')).toBe('fred-test-secret');
    expect(requestUrl.searchParams.get('file_type')).toBe('json');
  });

  it('returns a non-live response when the FRED key is absent', async () => {
    delete process.env.FRED_API_KEY;
    const overview = await fetchFredOverview();
    expect(overview.status).toBe('not_configured');
    expect(overview.indicators.every((indicator) => indicator.value === null)).toBe(true);
  });

  it('calculates year-over-year inflation by matching the prior-year month', async () => {
    process.env.FRED_API_KEY = 'fred-test-secret';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = new URL(String(input));
        const seriesId = url.searchParams.get('series_id');
        const observations =
          seriesId === 'CPIAUCSL'
            ? [
                { date: '2025-07-01', value: '320' },
                // A missing intervening month must not shift the YoY comparison.
                { date: '2026-07-01', value: '336' },
              ]
            : [{ date: '2026-07-01', value: '4.0' }];
        return Promise.resolve(
          new Response(JSON.stringify({ observations }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    const overview = await fetchFredOverview();
    const inflation = overview.indicators.find((indicator) => indicator.id === 'inflation');
    expect(inflation).toMatchObject({ value: 5, status: 'connected' });
  });

  it('never exposes the FRED credential in diagnostics', async () => {
    process.env.FRED_API_KEY = 'never-return-this-fred-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error_message: 'Bad api_key' }), { status: 400 }),
      ),
    );

    const diagnostic = await checkFredDiagnostic();
    expect(diagnostic.status).toBe('invalid_credentials');
    expect(diagnostic.message).not.toContain('never-return-this-fred-key');
  });
});

describe('World Bank India provider adapter', () => {
  it('loads India indicators without sending an API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { page: 1, pages: 1 },
          [
            {
              indicator: { id: 'NY.GDP.MKTP.KD.ZG', value: 'GDP growth' },
              country: { id: 'IN', value: 'India' },
              countryiso3code: 'IND',
              date: '2025',
              value: 7.6,
            },
            {
              indicator: { id: 'NY.GDP.MKTP.KD.ZG', value: 'GDP growth' },
              country: { id: 'IN', value: 'India' },
              countryiso3code: 'IND',
              date: '2024',
              value: 6.5,
            },
          ],
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWorldBankIndiaSeries('NY.GDP.MKTP.KD.ZG', 10);
    expect(result.status).toBe('connected');
    expect(result.observations).toEqual([
      { date: '2024', value: 6.5 },
      { date: '2025', value: 7.6 },
    ]);

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toContain('/country/IND/indicator/NY.GDP.MKTP.KD.ZG');
    expect(requestUrl.searchParams.get('format')).toBe('json');
    expect(requestUrl.searchParams.has('api_key')).toBe(false);
  });

  it('normalizes all configured India overview indicators', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = new URL(String(input));
        const indicatorId = url.pathname.split('/').at(-1) || '';
        const value = indicatorId === 'NY.GDP.MKTP.CD' ? 4_000_000_000_000 : 6.25;
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { page: 1, pages: 1 },
              [
                {
                  indicator: { id: indicatorId, value: indicatorId },
                  country: { id: 'IN', value: 'India' },
                  countryiso3code: 'IND',
                  date: '2025',
                  value,
                },
              ],
            ]),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }),
    );

    const overview = await fetchWorldBankIndiaOverview();
    expect(overview.status).toBe('connected');
    expect(overview.indicators).toHaveLength(5);
    expect(overview.indicators[0]).toMatchObject({
      label: 'India GDP',
      value: 4,
      unit: 'US$T',
      sourceName: 'World Bank',
    });
  });
});
