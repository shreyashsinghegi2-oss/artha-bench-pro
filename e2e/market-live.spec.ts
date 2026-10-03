import { expect, test } from '@playwright/test';

const WS_PORT = Number(process.env.E2E_WS_PORT || 8799);

test('market page shows a price within 2 seconds of the data arriving', async ({ page }) => {
  let servedAt = 0;
  await page.route('**/api/markets/batch**', async (route) => {
    const symbols = decodeURIComponent(new URL(route.request().url()).searchParams.get('symbols') || '').split(',');
    const now = new Date().toISOString();
    if (symbols.includes('^NSEI') && !servedAt) servedAt = Date.now();
    await route.fulfill({
      json: {
        requested: symbols.length,
        available: symbols.length,
        retrievedAt: now,
        results: symbols.map((symbol) => ({
          symbol,
          status: 'available',
          quote: {
            symbol,
            name: symbol,
            assetType: 'index',
            exchange: 'NSE',
            currency: 'INR',
            price: symbol === '^NSEI' ? 25123.45 : 100,
            open: null,
            high: null,
            low: null,
            previousClose: 25000,
            change: 123.45,
            changePercent: 0.49,
            volume: null,
            providerTimestamp: now,
            retrievedAt: now,
            freshness: 'delayed',
            providerName: 'e2e fixture',
          },
        })),
      },
    });
  });
  await page.goto('/workspace/markets');
  await expect.poll(() => servedAt, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.getByText(/^25,123(\.\d+)?$/).first()).toBeVisible({ timeout: 2_000 });
  const ms = Date.now() - servedAt;
  test.info().annotations.push({ type: 'price-visible-ms', description: String(ms) });
  expect(ms).toBeLessThan(2_000);
});

test('browser WebSocket receives a live tick within 2 seconds of subscribing', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (port) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/stream`);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    const t0 = performance.now();
    ws.send(JSON.stringify({ type: 'subscribe', symbols: ['RELIANCE.NS'] }));
    const tick = await new Promise<any>((res, rej) => {
      const timer = setTimeout(() => rej(new Error('no tick in 2 s')), 2000);
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === 'tick') {
          clearTimeout(timer);
          res(m);
        }
      };
    });
    ws.close();
    return { ms: performance.now() - t0, tick };
  }, WS_PORT);
  expect(result.ms).toBeLessThan(2000);
  expect(result.tick).toMatchObject({ symbol: 'RELIANCE.NS', source: 'e2e-fixture' });
  expect(result.tick.price).toBeGreaterThan(0);
});
