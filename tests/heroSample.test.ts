import { describe, expect, it } from 'vitest';
import { buildMoneyCheck } from '../src/services/moneyCheck';
import { HERO_REPORT, HERO_SAMPLE } from '../src/components/landing/heroSample';

describe('hero sample snapshot', () => {
  it('matches the Money Check engine for the sample profile', () => {
    const r = buildMoneyCheck(HERO_SAMPLE);
    expect(HERO_REPORT).toEqual({
      netWorth: r.netWorth,
      cashflow: { surplus: r.cashflow.surplus },
      emergency: { months: r.emergency.months },
      freedom: { freedomAge: r.freedom.freedomAge },
      health: { score: r.health.score, status: r.health.status },
      tax: { better: r.tax.better, monthlyTakeHome: r.tax.monthlyTakeHome, newRegimeTax: r.tax.newRegimeTax, oldRegimeTax: r.tax.oldRegimeTax, saving: r.tax.saving },
    });
  });
});

describe('use-my-data setting key', () => {
  it('the AI request guard reads the same key as userContext', async () => {
    const { USE_MY_DATA_KEY } = await import('../src/services/userContext');
    const src = (await import('node:fs')).readFileSync('src/services/aiFetchResilience.ts', 'utf8');
    expect(src).toContain(`const USE_MY_DATA_KEY = '${USE_MY_DATA_KEY}'`);
  });
});
