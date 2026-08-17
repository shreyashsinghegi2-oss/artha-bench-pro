import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkNewsProviderDiagnostic,
  fetchNewsFromProvider,
} from '../server/providers/newsProvider';
import {
  fetchHistoryFromProvider,
  fetchQuoteFromProvider,
  normalizeTwelveDataSymbol,
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
import {
  checkFinnhubDiagnostic,
  fetchFinnhubCompanyIntelligence,
} from '../server/providers/finnhubProvider';

const trackedEnvironmentKeys = [
  'BUSINESS_NEWS_PROVIDER',
  'BUSINESS_NEWS_API_KEY',
  'BUSINESS_NEWS_BASE_URL',
  'MARKET_DATA_PROVIDER',
  'MARKET_DATA_API_KEY',
  'MARKET_DATA_BASE_URL',
  'FRED_API_KEY',
  'FRED_API_BASE_URL',
  'FINNHUB_API_KEY',
  'FINNHUB_API_BASE_URL',
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
  it('normalizes NSE and BSE symbol formats at the provider boundary', () => {
    expect(normalizeTwelveDataSymbol('NSE:SBIN')).toEqual({
      providerSymbol: 'SBIN:NSE',
      baseSymbol: 'SBIN',
      exchange: 'NSE',
    });
    expect(normalizeTwelveDataSymbol('RELIANCE.NS').providerSymbol).toBe('RELIANCE:NSE');
    expect(normalizeTwelveDataSymbol('500325.BO').providerSymbol).toBe('500325:BSE');
  });

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
      { date: '2026-08-15', price: 220, close: 220, volume: 100 },
      { date: '2026-08-16', price: 224.5, close: 224.5, volume: 200 },
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

  it('requests an exchange-qualified NSE quote and labels it end of day', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelvedata';
    process.env.MARKET_DATA_API_KEY = 'market-test-secret';
    process.env.MARKET_DATA_BASE_URL = 'https://api.twelvedata.com/quote';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          symbol: 'SBIN',
          name: 'State Bank of India',
          exchange: 'NSE',
          currency: 'INR',
          datetime: '2026-08-14',
          open: '806.40',
          high: '817.20',
          low: '803.90',
          close: '812.65',
          previous_close: '806.25',
          change: '6.40',
          percent_change: '0.79',
          volume: '12600000',
          is_market_open: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchQuoteFromProvider('NSE:SBIN');

    expect(result.status).toBe('connected');
    expect(result.message).toContain('end-of-day');
    expect(result.quote).toMatchObject({
      symbol: 'SBIN:NSE',
      exchange: 'NSE',
      currency: 'INR',
      freshness: 'end_of_day',
      price: 812.65,
    });
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get('symbol')).toBe('SBIN:NSE');
  });

  it('preserves Indian OHLCV history and uses EOD intervals', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelvedata';
    process.env.MARKET_DATA_API_KEY = 'market-test-secret';
    process.env.MARKET_DATA_BASE_URL = 'https://api.twelvedata.com/quote';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          values: [{
            datetime: '2026-08-14',
            open: '1372.50',
            high: '1391.80',
            low: '1368.20',
            close: '1384.40',
            volume: '7420000',
          }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const points = await fetchHistoryFromProvider('RELIANCE.NS', '1d');

    expect(points).toEqual([{
      date: '2026-08-14',
      price: 1384.4,
      open: 1372.5,
      high: 1391.8,
      low: 1368.2,
      close: 1384.4,
      volume: 7420000,
    }]);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.searchParams.get('symbol')).toBe('RELIANCE:NSE');
    expect(requestUrl.searchParams.get('interval')).toBe('1day');
  });

  it('uses an INR-labelled NSE demo when the key is absent', async () => {
    delete process.env.MARKET_DATA_API_KEY;
    const result = await fetchQuoteFromProvider('SBIN.NS');
    expect(result.status).toBe('not_configured');
    expect(result.quote).toMatchObject({
      symbol: 'SBIN:NSE',
      exchange: 'NSE',
      currency: 'INR',
      freshness: 'demo',
    });
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

describe('Finnhub company-intelligence adapter', () => {
  it('returns a clear configuration state when the Finnhub key is absent', async () => {
    delete process.env.FINNHUB_API_KEY;
    const result = await fetchFinnhubCompanyIntelligence('AAPL');
    expect(result.status).toBe('not_configured');
    expect(result.profile).toBeNull();
  });

  it('keeps the token server-side and normalizes company datasets', async () => {
    process.env.FINNHUB_API_KEY = 'finnhub-test-secret';
    process.env.FINNHUB_API_BASE_URL = 'https://finnhub.io/api/v1';
    const fetchMock = vi.fn().mockImplementation((input: string | URL | Request) => {
      const url = new URL(String(input));
      let body: unknown = {};

      if (url.pathname.endsWith('/stock/profile2')) {
        body = {
          country: 'US',
          currency: 'USD',
          exchange: 'NASDAQ NMS - GLOBAL MARKET',
          finnhubIndustry: 'Technology',
          ipo: '1980-12-12',
          marketCapitalization: 3_500_000,
          name: 'Apple Inc',
          ticker: 'AAPL',
          weburl: 'https://www.apple.com/',
        };
      } else if (url.pathname.endsWith('/stock/metric')) {
        body = {
          metric: {
            peBasicExclExtraTTM: 31.5,
            pbAnnual: 45.2,
            roeTTM: 150.1,
            beta: 1.2,
            '52WeekHigh': 250,
            '52WeekLow': 170,
          },
        };
      } else if (url.pathname.endsWith('/stock/earnings')) {
        body = [
          {
            actual: 1.6,
            estimate: 1.5,
            period: '2026-06-30',
            surprise: 0.1,
            surprisePercent: 6.67,
          },
        ];
      } else if (url.pathname.endsWith('/stock/recommendation')) {
        body = [
          {
            period: '2026-08-01',
            strongBuy: 12,
            buy: 20,
            hold: 8,
            sell: 1,
            strongSell: 0,
          },
        ];
      }

      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchFinnhubCompanyIntelligence('aapl');
    expect(result.status).toBe('connected');
    expect(result.profile).toMatchObject({ name: 'Apple Inc', ticker: 'AAPL' });
    expect(result.metrics).toMatchObject({ peRatio: 31.5, week52High: 250 });
    expect(result.earnings).toHaveLength(1);
    expect(result.recommendations[0].strongBuy).toBe(12);

    for (const call of fetchMock.mock.calls) {
      const requestUrl = new URL(String(call[0]));
      expect(requestUrl.searchParams.get('token')).toBe('finnhub-test-secret');
      expect(requestUrl.searchParams.get('symbol')).toBe('AAPL');
    }
    expect(JSON.stringify(result)).not.toContain('finnhub-test-secret');
  });

  it('does not expose a rejected Finnhub credential in diagnostics', async () => {
    process.env.FINNHUB_API_KEY = 'never-return-this-finnhub-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 }),
      ),
    );

    const diagnostic = await checkFinnhubDiagnostic();
    expect(diagnostic.status).toBe('invalid_credentials');
    expect(diagnostic.message).not.toContain('never-return-this-finnhub-key');
  });
});
