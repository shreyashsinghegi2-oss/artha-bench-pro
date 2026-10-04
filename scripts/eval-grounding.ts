/**
 * Grounding evaluation: 30 India finance questions against a running deployment.
 *
 *   npx tsx scripts/eval-grounding.ts --base https://artha-bench-pro.vercel.app --label after
 *   npx tsx scripts/eval-grounding.ts --compare reports/grounding-eval-before.json reports/grounding-eval-after.json
 *
 * Per question it records:
 *   - fetch step (GET /api/grounding/preview): latency, sources returned, official sources, context size
 *   - answer (POST /api/ai/chat): latency, provider, fallback
 *   - citation coverage: share of answer sentences with a figure that carry a valid [n] (or state a verified number)
 *   - unsupported figures: ₹ amounts / percentages in the answer that appear in neither the fetched context nor the
 *     verified numbers (a proxy for invented numbers; it can flag correctly derived figures too)
 *   - expected facts: stable facts each answer must contain (calculations, statutory values)
 *   - estimated tokens: (context + prompt + answer) / 4
 * Deployments without /api/grounding/preview (the "before" pipeline) are measured on the answer only.
 * Requests are spaced to stay within the API's per-minute limits.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

interface Case {
  id: string;
  q: string;
  expect?: RegExp[];
  topic: 'calc' | 'tax' | 'regulation' | 'market' | 'mf' | 'concept' | 'news';
}

export const CASES: Case[] = [
  { id: 'emi-1', topic: 'calc', q: 'What is the EMI on a 50 lakh home loan at 8.5% for 20 years?', expect: [/₹43,391/] },
  { id: 'emi-2', topic: 'calc', q: 'EMI for a ₹10,00,000 car loan at 9% for 5 years?', expect: [/₹20,758/] },
  { id: 'emi-3', topic: 'calc', q: 'Monthly EMI on 25 lakh at 10.5% for 15 years and total interest paid?', expect: [/₹27,63[45]/] },
  { id: 'sip-1', topic: 'calc', q: 'What will a SIP of ₹10,000 a month grow to at 12% for 15 years?' },
  { id: 'sip-2', topic: 'calc', q: 'SIP of 5000 per month for 10 years at 10% — final value?' },
  { id: 'cagr-1', topic: 'calc', q: 'My investment grew from 1 lakh to 2.5 lakh in 5 years. What is the CAGR?', expect: [/20\.11%/] },
  { id: 'cagr-2', topic: 'calc', q: 'A fund went from ₹2,00,000 to ₹3,50,000 over 4 years, what CAGR is that?', expect: [/15\.02%/] },
  { id: 'tax-1', topic: 'tax', q: 'How much income tax on an 18 lakh salary in the new regime for FY 2026-27?', expect: [/₹1,50,800/] },
  { id: 'tax-2', topic: 'tax', q: 'Is income up to 12 lakh tax-free under the new regime? Explain the 87A rebate.', expect: [/12,00,000|12 lakh/i, /60,000/] },
  { id: 'tax-3', topic: 'tax', q: 'Tax on 12,75,000 salary old vs new regime', expect: [/₹0(\.00)?\b|nil|zero/i, /₹1,87,200/] },
  { id: 'tax-4', topic: 'tax', q: 'What is the standard deduction for salaried people in the new tax regime?', expect: [/75,000/] },
  { id: 'tax-5', topic: 'tax', q: 'What are the new regime income tax slabs for FY 2026-27?', expect: [/4,00,000/, /24,00,000/] },
  { id: 'reg-1', topic: 'regulation', q: 'What is the latest RBI repo rate decision?' },
  { id: 'reg-2', topic: 'regulation', q: 'What did the latest RBI monetary policy say about inflation?' },
  { id: 'reg-3', topic: 'regulation', q: 'What is the latest SEBI circular on mutual fund expense ratio?' },
  { id: 'reg-4', topic: 'regulation', q: 'What are SEBI rules for mutual fund KYC?' },
  { id: 'reg-5', topic: 'regulation', q: 'Latest SEBI update on F&O trading rules for retail investors' },
  { id: 'reg-6', topic: 'regulation', q: 'What is the current RBI rule on UPI transaction limits?' },
  { id: 'mkt-1', topic: 'market', q: 'What is Nifty 50 at today and why did it move?' },
  { id: 'mkt-2', topic: 'market', q: 'Sensex level now?' },
  { id: 'mkt-3', topic: 'market', q: 'What is the current USD to INR rate?' },
  { id: 'mkt-4', topic: 'market', q: 'Gold price today in dollars and why is it moving?' },
  { id: 'mkt-5', topic: 'market', q: 'How is Reliance share price doing today?' },
  { id: 'mf-1', topic: 'mf', q: 'What is the latest NAV of Parag Parikh Flexi Cap Fund?' },
  { id: 'mf-2', topic: 'mf', q: 'HDFC Flexi Cap fund returns over 3 years' },
  { id: 'news-1', topic: 'news', q: 'What is the latest news on Indian stock markets?' },
  { id: 'news-2', topic: 'news', q: 'Any recent announcement from the finance ministry on income tax?' },
  { id: 'con-1', topic: 'concept', q: 'What is an expense ratio in mutual funds?', expect: [/expense ratio/i] },
  { id: 'con-2', topic: 'concept', q: 'Explain XIRR in simple words', expect: [/xirr/i] },
  { id: 'con-3', topic: 'concept', q: 'What is the difference between old and new tax regime?', expect: [/deduction/i] },
];

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const MONEY = /(?:₹\s?\d[\d,]*(?:\.\d+)?|\d+(?:\.\d+)?\s?%)/g;
const norm = (s: string) => s.replace(/[\s,₹]/g, '').replace(/\.0+%$/, '%');
const sentencesOf = (s: string) =>
  s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

export interface Row {
  id: string;
  topic: string;
  fetchMs: number | null;
  sources: number | null;
  officialSources: number | null;
  contextChars: number | null;
  answerMs: number;
  status: number;
  provider: string;
  fallback: boolean;
  citationCoverage: number | null;
  unsupportedFigures: string[];
  expectedFactsMet: number | null;
  estTokens: number;
  verifiedNumbers: number;
  certified: number;
  invalidCitationsRemoved: number;
}

export function scoreAnswer(text: string, context: string | null, verified: string[]) {
  const withFigures = sentencesOf(text).filter((s) => MONEY.test(s) || /\d/.test(s));
  MONEY.lastIndex = 0;
  const cited = withFigures.filter((s) => /\[\d{1,2}(?:\s*,\s*\d{1,2})*\]/.test(s) || verified.some((v) => s.includes(v)));
  const coverage = withFigures.length ? cited.length / withFigures.length : null;
  const figures = [...new Set(text.match(MONEY) ?? [])];
  const pool = norm(`${context ?? ''} ${verified.join(' ')}`);
  const unsupported = context === null ? [] : figures.filter((f) => !pool.includes(norm(f)));
  return { coverage, unsupported };
}

async function runOne(base: string, c: Case): Promise<Row> {
  let fetchMs: number | null = null,
    sources: number | null = null,
    official: number | null = null,
    contextChars: number | null = null,
    context: string | null = null;
  const pv = await fetch(`${base}/api/grounding/preview?full=1&q=${encodeURIComponent(c.q)}`).catch(() => null);
  if (pv?.ok) {
    const p = (await pv.json()) as { fetchMs: number; numberedSources: Array<{ kind: string }>; contextChars: number; context: string };
    fetchMs = p.fetchMs;
    sources = p.numberedSources.length;
    official = p.numberedSources.filter((s) => s.kind === 'official').length;
    contextChars = p.contextChars;
    context = p.context;
  }
  const t0 = Date.now();
  const res = await fetch(`${base}/api/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: c.q, task: 'cfo' }),
  });
  const answerMs = Date.now() - t0;
  const body = (await res.json().catch(() => ({}))) as any;
  const a = body.structuredAnswer ?? {};
  const text = [a.directAnswer, ...(a.steps ?? []).map((s: any) => s.explanation), a.example?.result, ...(a.keyTakeaways ?? [])].filter(Boolean).join(' ');
  const verified: string[] = (a.verifiedNumbers ?? []).map((v: any) => v.display);
  const { coverage, unsupported } = scoreAnswer(text, context, verified);
  return {
    id: c.id,
    topic: c.topic,
    fetchMs,
    sources,
    officialSources: official,
    contextChars,
    answerMs,
    status: res.status,
    provider: String(body.provider ?? ''),
    fallback: Boolean(body.fallbackUsed) || body.ok === false,
    citationCoverage: coverage,
    unsupportedFigures: unsupported,
    expectedFactsMet: c.expect ? c.expect.filter((re) => re.test(text)).length / c.expect.length : null,
    estTokens: Math.round(((contextChars ?? 0) + c.q.length + text.length) / 4),
    verifiedNumbers: verified.length,
    certified: (a.verifiedNumbers ?? []).filter((v: any) => v.certified).length,
    invalidCitationsRemoved: body.grounding?.invalidCitationsRemoved?.length ?? 0,
  };
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function summarise(rows: Row[]) {
  const nums = <K extends keyof Row>(k: K) => rows.map((r) => r[k]).filter((v): v is number & Row[K] => typeof v === 'number');
  return {
    questions: rows.length,
    errors: rows.filter((r) => r.status !== 200).length,
    fallbacks: rows.filter((r) => r.fallback).length,
    citationCoverageMean: mean(nums('citationCoverage')),
    unsupportedFiguresTotal: rows.reduce((n, r) => n + r.unsupportedFigures.length, 0),
    expectedFactsMetMean: mean(nums('expectedFactsMet')),
    fetchMsP50: pct(nums('fetchMs'), 50),
    fetchMsP95: pct(nums('fetchMs'), 95),
    answerMsP50: pct(nums('answerMs'), 50),
    answerMsP95: pct(nums('answerMs'), 95),
    sourcesMean: mean(nums('sources')),
    officialSourcesMean: mean(nums('officialSources')),
    estTokensMean: mean(nums('estTokens')),
    certifiedNumbers: rows.reduce((n, r) => n + r.certified, 0),
    invalidCitationsRemoved: rows.reduce((n, r) => n + r.invalidCitationsRemoved, 0),
  };
}

async function main() {
  const compare = process.argv.indexOf('--compare');
  if (compare > 0) {
    const [a, b] = [process.argv[compare + 1], process.argv[compare + 2]].map(
      (f) => JSON.parse(readFileSync(f, 'utf8')) as { label: string; summary: Record<string, number | null> },
    );
    console.log(`metric | ${a.label} | ${b.label}\n--- | --- | ---`);
    for (const k of Object.keys(a.summary)) console.log(`${k} | ${a.summary[k] ?? '—'} | ${b.summary[k] ?? '—'}`);
    return;
  }
  const base = (arg('base') ?? 'http://localhost:3000').replace(/\/$/, '');
  const label = arg('label') ?? 'run';
  const gapMs = Number(arg('gap-ms') ?? 3500);
  const rows: Row[] = [];
  for (const c of CASES) {
    try {
      rows.push(await runOne(base, c));
    } catch (e) {
      rows.push({
        id: c.id,
        topic: c.topic,
        fetchMs: null,
        sources: null,
        officialSources: null,
        contextChars: null,
        answerMs: 0,
        status: 0,
        provider: String(e),
        fallback: true,
        citationCoverage: null,
        unsupportedFigures: [],
        expectedFactsMet: null,
        estTokens: 0,
        verifiedNumbers: 0,
        certified: 0,
        invalidCitationsRemoved: 0,
      });
    }
    process.stdout.write(`${c.id} `);
    await new Promise((r) => setTimeout(r, gapMs));
  }
  const summary = summarise(rows);
  mkdirSync('reports', { recursive: true });
  const out = `reports/grounding-eval-${label}.json`;
  writeFileSync(out, JSON.stringify({ label, base, ranAt: new Date().toISOString(), summary, rows }, null, 2));
  console.log(`\n${JSON.stringify(summary, null, 2)}\nWrote ${out}`);
}

if (process.argv[1]?.includes('eval-grounding')) void main();
