import { fundDetail, searchFunds, type AmfiScheme } from './mutualFundService';

/**
 * Where to put the monthly surplus, by the person's own profile. The split is set by two rules a
 * reader can check: how soon the money is needed (horizon), and how much risk the person said they accept.
 * Funds come from the official AMFI NAV file; returns are shown only when the NAV history has them.
 * This is education and a starting point, not a personal regulated recommendation.
 */

export type Risk = 'low' | 'moderate' | 'high';
export type BucketKey = 'liquid' | 'debt' | 'hybrid' | 'index' | 'flexi';

export interface PlanInput {
  age: number;
  monthlySurplus: number;
  risk: Risk;
  horizonYears: number;
  /** How much the safety fund is still short of its target (0 when complete). */
  emergencyGap: number;
  /** True when credit-card or other high-interest debt is outstanding. */
  highCostDebt: boolean;
}

interface BucketInfo { label: string; query: string; hint: RegExp; reason: string }

export const BUCKETS: Record<BucketKey, BucketInfo> = {
  liquid: { label: 'Liquid fund', query: 'liquid fund direct growth', hint: /liquid/i, reason: 'Money you may need within months. Easy to withdraw, low price swings.' },
  debt: { label: 'Short-duration debt fund', query: 'short duration direct growth', hint: /short duration|low duration|corporate bond|banking (and|&) psu/i, reason: 'Steadier than shares. Returns track interest rates, so expect small ups and downs.' },
  hybrid: { label: 'Conservative hybrid fund', query: 'conservative hybrid direct growth', hint: /conservative hybrid|balanced/i, reason: 'Mostly debt with a small share of shares. Smooths the ride between debt and equity.' },
  index: { label: 'Index fund (Nifty 50)', query: 'nifty 50 index direct growth', hint: /index|nifty 50/i, reason: 'Owns the 50 largest listed Indian companies at very low cost. A simple long-term core.' },
  flexi: { label: 'Flexi-cap fund', query: 'flexi cap direct growth', hint: /flexi cap/i, reason: 'A diversified equity fund that can move across company sizes. Higher swings than an index fund.' },
};

/** Horizon band → risk → allocation in percent (each row adds to 100). */
const SPLIT: Record<'short' | 'medium' | 'long', Record<Risk, Array<[BucketKey, number]>>> = {
  short: {
    low: [['liquid', 60], ['debt', 40]],
    moderate: [['liquid', 50], ['debt', 50]],
    high: [['liquid', 50], ['debt', 50]],
  },
  medium: {
    low: [['debt', 50], ['hybrid', 30], ['liquid', 20]],
    moderate: [['hybrid', 40], ['index', 40], ['debt', 20]],
    high: [['index', 50], ['flexi', 30], ['hybrid', 20]],
  },
  long: {
    low: [['index', 30], ['debt', 50], ['liquid', 20]],
    moderate: [['index', 45], ['flexi', 25], ['debt', 20], ['liquid', 10]],
    high: [['index', 40], ['flexi', 40], ['debt', 10], ['liquid', 10]],
  },
};

export interface AllocationRow { key: BucketKey; label: string; percent: number; monthly: number; reason: string }
export interface PlanFund {
  bucket: BucketKey; code: string; name: string; house: string; category: string;
  nav: number; navDate: string; oneYear: number | null; threeYear: number | null; source: string;
}
export interface SectorIdea { name: string; why: string; check: string[] }
export interface InvestmentPlan {
  band: 'short' | 'medium' | 'long';
  headline: string;
  fixFirst: string | null;
  monthlyToInvest: number;
  allocation: AllocationRow[];
  funds: PlanFund[];
  sectors: SectorIdea[];
  notes: string[];
  sources: string[];
  generatedAt: string;
}

function bandFor(years: number): 'short' | 'medium' | 'long' {
  if (years < 3) return 'short';
  if (years <= 5) return 'medium';
  return 'long';
}

/** Rounds to the nearest ₹100 so the plan reads as a real monthly amount. */
const roundTo100 = (v: number) => Math.round(v / 100) * 100;

export function allocationFor(input: PlanInput): { band: 'short' | 'medium' | 'long'; rows: AllocationRow[] } {
  const band = bandFor(input.horizonYears);
  const surplus = Math.max(0, input.monthlySurplus);
  const rows = SPLIT[band][input.risk].map(([key, percent]) => ({
    key,
    label: BUCKETS[key].label,
    percent,
    monthly: roundTo100((surplus * percent) / 100),
    reason: BUCKETS[key].reason,
  }));
  return { band, rows };
}

/** Sector starting points. They depend on the horizon only; they are not stock picks. */
export function sectorsFor(band: 'short' | 'medium' | 'long'): SectorIdea[] {
  if (band === 'short') {
    return [{ name: 'No single-sector bets yet', why: 'Money needed within three years should not depend on how one industry does. Keep it in cash-like funds.', check: [] }];
  }
  const checks = ['Revenue and profit growth over 5 years', 'Debt levels and interest cover', 'Valuation against its own history', 'Competition and government policy risk'];
  return [
    { name: 'Banks and financial services', why: 'Benefit when loans and deposits grow with the economy.', check: ['Gross and net bad-loan ratios', 'Loan growth and margins', ...checks.slice(1, 2)] },
    { name: 'Capital goods and infrastructure', why: 'Follow public and private investment in roads, power and factories.', check: ['Order book size and its timing', checks[1], checks[3]] },
    { name: 'Consumer staples', why: 'Steady demand for everyday products, so earnings tend to be less volatile.', check: ['Volume growth, not just price', checks[0], checks[2]] },
    { name: 'Healthcare', why: 'Demand grows with age and with health spending.', check: ['Regulatory approvals and inspections', checks[1], checks[2]] },
  ];
}

const SOURCE = 'AMFI daily NAV file (amfiindia.com)';

async function pickFunds(key: BucketKey): Promise<PlanFund[]> {
  const info = BUCKETS[key];
  const { results } = await searchFunds(info.query, 12).catch(() => ({ results: [] as AmfiScheme[], source: '' }));
  const matches = results.filter((s) => info.hint.test(`${s.category} ${s.name}`) && /direct/i.test(s.name) && /growth/i.test(s.name));
  const seen = new Set<string>();
  const picked: AmfiScheme[] = [];
  for (const s of matches) {
    if (seen.has(s.house)) continue;
    seen.add(s.house);
    picked.push(s);
    if (picked.length === 2) break;
  }
  return Promise.all(picked.map(async (s) => {
    const detail = await fundDetail(s.code).catch(() => null);
    const r = (detail?.returns ?? {}) as Record<string, number>;
    return {
      bucket: key, code: s.code, name: s.name, house: s.house, category: s.category,
      nav: s.nav, navDate: s.navDate,
      oneYear: typeof r['1Y'] === 'number' ? r['1Y'] : null,
      threeYear: typeof r['3Y'] === 'number' ? r['3Y'] : null,
      source: SOURCE,
    };
  }));
}

const cache = new Map<string, { at: number; plan: InvestmentPlan }>();
const CACHE_MS = 60 * 60 * 1000;

export async function buildInvestmentPlan(input: PlanInput): Promise<InvestmentPlan> {
  const key = JSON.stringify(input);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.plan;

  const { band, rows } = allocationFor(input);
  const fixFirst = input.emergencyGap > 0 || input.highCostDebt
    ? (input.highCostDebt ? 'Clear the high-interest debt first. A credit-card balance costs more than most funds earn.' : 'Fill the safety fund first. Until then, park the surplus in a liquid fund.')
    : null;
  const usedKeys = fixFirst ? (['liquid'] as BucketKey[]) : [...new Set(rows.map((r) => r.key))];
  const funds = (await Promise.all(usedKeys.map(pickFunds))).flat();

  const plan: InvestmentPlan = {
    band,
    headline: fixFirst ? 'Protect first, then invest' : band === 'short' ? 'Keep it safe: the money is needed soon' : band === 'medium' ? 'A balanced mix for a medium-term goal' : 'Grow it for the long term, in steps',
    fixFirst,
    monthlyToInvest: input.monthlySurplus > 0 ? roundTo100(input.monthlySurplus) : 0,
    allocation: fixFirst ? [{ key: 'liquid', label: BUCKETS.liquid.label, percent: 100, monthly: roundTo100(Math.max(0, input.monthlySurplus)), reason: BUCKETS.liquid.reason }] : rows,
    funds: funds.length ? funds : [],
    sectors: fixFirst ? [] : sectorsFor(band),
    notes: [
      'Start with a SIP (a fixed amount every month) so you invest through ups and downs.',
      'Choose the Direct plan with Growth; the Regular plan pays a distributor commission from your returns.',
      'Past returns do not guarantee future returns. Check each fund’s factsheet before you invest.',
      'Equity and index funds can fall 20% or more in a bad year. Only use them for money you will not need for several years.',
    ],
    sources: [SOURCE, 'Fund returns: NAV history from AMFI and mfapi.in (3-year return needs 3 years of data)'],
    generatedAt: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), plan });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return plan;
}
