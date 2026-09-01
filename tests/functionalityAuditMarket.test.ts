import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { destinationForPath, pathForDestination } from '../src/appRoutes';
import { INDIA_MARKET_UNIVERSE } from '../src/data/indiaMarketUniverse';
import { MARKET_LEARNING_COURSES } from '../src/data/marketLearningContent';
import { MARKET_CHART_COLORS, marketMovementColor } from '../src/lib/charts/marketChartTheme';
import { hasGenuineOhlc, looksIntraday, marketDataState, MARKET_SAFE_REDIRECT } from '../src/services/marketPro';
import { TWELVE_DATA_INDIA_MAPPINGS, TWELVE_DATA_STARTER_ASSET_IDS } from '../server/data/indiaProviderMappings';
import { getIndiaMarketQuotes, getIndiaMarketStatus, searchIndiaMarketIdentities } from '../server/indiaMarketService';

const originalProvider = process.env.MARKET_DATA_PROVIDER;
const originalTwelveKey = process.env.TWELVE_DATA_API_KEY;
const originalGenericKey = process.env.MARKET_DATA_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalProvider === undefined) delete process.env.MARKET_DATA_PROVIDER; else process.env.MARKET_DATA_PROVIDER = originalProvider;
  if (originalTwelveKey === undefined) delete process.env.TWELVE_DATA_API_KEY; else process.env.TWELVE_DATA_API_KEY = originalTwelveKey;
  if (originalGenericKey === undefined) delete process.env.MARKET_DATA_API_KEY; else process.env.MARKET_DATA_API_KEY = originalGenericKey;
});

describe('route smoke mapping', () => {
  const routes: Array<[string, string]> = [
    ['/finance/overview', 'overview'],
    ['/finance/markets/india', 'india-markets'],
    ['/finance/markets/india/RELIANCE.NS', 'india-markets'],
    ['/finance/markets/intraday', 'intraday-markets'],
    ['/finance/markets/forex', 'forex-markets'],
    ['/finance/markets/us', 'us-markets'],
    ['/finance/markets/watchlist', 'market-watchlist'],
    ['/finance/markets/alerts', 'market-alerts'],
    ['/finance/markets/learn', 'markets-learn'],
    ['/finance/markets/learn/forex-fundamentals/currency-pairs', 'markets-learn'],
    ['/go-pro', 'go-pro'],
  ];
  for (const [route, destination] of routes) {
    it(`${route} maps to ${destination}`, () => expect(destinationForPath(route)).toBe(destination));
  }
  it('Go Pro destination has a real route', () => expect(pathForDestination('go-pro')).toBe('/go-pro'));
});

describe('India market identity and quote loading architecture', () => {
  it('keeps the configured Indian tracked universe independently of quote availability', () => {
    expect(INDIA_MARKET_UNIVERSE.length).toBeGreaterThanOrEqual(65);
    expect(new Set(INDIA_MARKET_UNIVERSE.map((asset) => asset.id)).size).toBe(INDIA_MARKET_UNIVERSE.length);
  });

  it('search works from identity metadata with no provider request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const results = searchIndiaMarketIdentities('Reliance');
    expect(results.some((asset) => asset.displayName.includes('Reliance'))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts the five Twelve Data mappings as unknown rather than guessed', () => {
    expect(TWELVE_DATA_STARTER_ASSET_IDS).toEqual(['reliance','tcs','hdfc-bank','infosys','icici-bank']);
    for (const id of TWELVE_DATA_STARTER_ASSET_IDS) {
      expect(TWELVE_DATA_INDIA_MAPPINGS[id]).toMatchObject({ providerSymbol: null, providerExchange: null, support: 'unknown', verifiedAt: null });
    }
  });

  it('strict Twelve Data mode returns coverage-pending without calling the provider for unknown mappings', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelve_data';
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const [row] = await getIndiaMarketQuotes(['reliance']);
    expect(row.quote).toBeNull();
    expect(row.support).toBe('unknown');
    expect(row.attribution.state).toBe('unavailable');
    expect(row.reason).toMatch(/coverage pending/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bounds a batch to 20 asset IDs instead of creating a 65-request waterfall', async () => {
    process.env.MARKET_DATA_PROVIDER = 'twelve_data';
    delete process.env.TWELVE_DATA_API_KEY;
    delete process.env.MARKET_DATA_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ids = INDIA_MARKET_UNIVERSE.slice(0, 25).map((asset) => asset.id);
    const results = await getIndiaMarketQuotes(ids);
    expect(results.length).toBeLessThanOrEqual(20);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('status exposes key presence only as a boolean and derives total coverage from the registry', () => {
    process.env.MARKET_DATA_PROVIDER = 'twelve_data';
    process.env.TWELVE_DATA_API_KEY = 'server-test-key';
    const status = getIndiaMarketStatus();
    expect(status.apiKeyPresent).toBe(true);
    expect(status.totalTrackedAssets).toBe(INDIA_MARKET_UNIVERSE.length);
    expect(JSON.stringify(status)).not.toContain('server-test-key');
  });
});

describe('market data state and chart integrity', () => {
  it('maps stale/unavailable/demo states without calling them live', () => {
    expect(marketDataState(null).state).toBe('unavailable');
    expect(marketDataState({ freshness: 'stale' } as never).label).toBe('Stale data');
    expect(marketDataState({ freshness: 'demo' } as never).label).toBe('Demo data');
  });

  it('requires genuine OHLC rather than only close values', () => {
    expect(hasGenuineOhlc([{ date: '2026-09-01T09:15:00Z', price: 100, close: 100 }])).toBe(false);
    expect(hasGenuineOhlc([{ date: '2026-09-01T09:15:00Z', price: 100, open: 99, high: 101, low: 98, close: 100 }])).toBe(true);
  });

  it('recognizes intraday timestamp spacing only from actual observations', () => {
    expect(looksIntraday([
      { date: '2026-09-01T09:15:00Z', price: 100 },
      { date: '2026-09-01T09:20:00Z', price: 101 },
    ])).toBe(true);
    expect(looksIntraday([
      { date: '2026-09-01T00:00:00Z', price: 100 },
      { date: '2026-09-02T00:00:00Z', price: 101 },
    ])).toBe(false);
  });

  it('uses green/red/slate chart colors based on selected-range return', () => {
    expect(marketMovementColor(1)).toBe(MARKET_CHART_COLORS.positive);
    expect(marketMovementColor(-1)).toBe(MARKET_CHART_COLORS.negative);
    expect(marketMovementColor(null)).toBe(MARKET_CHART_COLORS.neutral);
    expect(marketMovementColor(0)).toBe(MARKET_CHART_COLORS.neutral);
  });
});

describe('market AI safety and evidence contract', () => {
  it('keeps the required safe redirect language', () => {
    expect(MARKET_SAFE_REDIRECT).toMatch(/cannot provide personalised buy\/sell instructions/i);
    expect(MARKET_SAFE_REDIRECT).toMatch(/targets, stop-losses/i);
  });

  it('does not put Twelve Data or provider API secret names in browser source modules', () => {
    const root = path.resolve(process.cwd(), 'src');
    const files: string[] = [];
    const walk = (directory: string) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
      }
    };
    walk(root);
    const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toContain('TWELVE_DATA_API_KEY');
    expect(source).not.toContain('INDIA_INTRADAY_API_KEY');
    expect(source).not.toContain('SUBSCRIPTION_SECRET_KEY');
  });
});

describe('Markets Learning Lab functionality', () => {
  it('contains all nine requested learning tracks', () => {
    expect(MARKET_LEARNING_COURSES.map((course) => course.title)).toEqual([
      'Personal finance foundations',
      'Indian markets fundamentals',
      'Investing basics',
      'Forex fundamentals',
      'Intraday chart literacy',
      'Risk and volatility',
      'Debt and EMI understanding',
      'Tax basics',
      'AI and financial-data literacy',
    ]);
  });

  it('has routable lessons with valid one-question knowledge checks', () => {
    const lessons = MARKET_LEARNING_COURSES.flatMap((course) => course.lessons.map((lesson) => ({ course, lesson })));
    expect(lessons).toHaveLength(18);
    for (const { course, lesson } of lessons) {
      expect(lesson.slug).toBeTruthy();
      expect(lesson.quiz.options.length).toBeGreaterThanOrEqual(2);
      expect(lesson.quiz.correctIndex).toBeGreaterThanOrEqual(0);
      expect(lesson.quiz.correctIndex).toBeLessThan(lesson.quiz.options.length);
      expect(destinationForPath(`/finance/markets/learn/${course.slug}/${lesson.slug}`)).toBe('markets-learn');
    }
  });
});
