/**
 * The downloadable ArthaMind financial report (PDF). Every number is calculated by the app from the user's
 * own answers and records; the advisor section is ArthaMind's latest analysis of the full dashboard, which
 * reads live market data, news and web sources on the server. Live index levels are fetched at download time.
 *
 * The PDF uses the built-in Helvetica font, which has no ₹ sign, so amounts are written as "Rs 12,00,000".
 */
import type { StructuredFinancialAnswer } from '../types';
import { loadMoneyProfile } from './moneyProfile';
import { buildCompleteDashboard, type CompleteDashboard } from './completeDashboard';
import { loadEmiRecords } from './emiStorage';
import { loadIncomeSources } from './incomeStorage';
import { loadExpenses } from './personalFinanceStorage';
import { loadPortfolio, summarise } from './portfolio';
import { GOAL_OPTIONS, WORK_OPTIONS, buildPath, loadOnboardingRecord, totalSpend } from './onboarding';
import { loadPrefs } from './userPrefs';
import { analyseFinances, type Slice } from './financialAnalysis';

const DASH_ANALYSIS_KEY = 'arthamind.dashAnalysis.v1';

/** "Rs 12,00,000" (Indian grouping) or "USD 1,200,000". */
export function pdfMoney(value: number, currency = 'INR'): string {
  const n = Math.round(Math.abs(value));
  const s = currency === 'INR' ? n.toLocaleString('en-IN') : n.toLocaleString('en-US');
  return `${value < 0 ? '-' : ''}${currency === 'INR' ? 'Rs' : currency} ${s}`;
}
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
/** Helvetica only covers Latin-1: drop anything else (emoji, ₹, other scripts) so the PDF never shows boxes. */
const clean = (t: string) => String(t ?? '').replace(/₹\s?/g, 'Rs ').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/−/g, '-').replace(/×/g, 'x').replace(/→/g, '->').replace(/≈/g, '~').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/•/g, '-').replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

async function logoPng(): Promise<string | null> {
  try {
    const svg = await (await fetch('/favicon.svg')).text();
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 160;
    c.getContext('2d')!.drawImage(img, 0, 0, 160, 160);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function liveMarkets(): Promise<Array<{ label: string; price: number; ch: number | null }>> {
  const list = [['^NSEI', 'NIFTY 50'], ['^BSESN', 'SENSEX'], ['INR=X', 'USD/INR'], ['GC=F', 'Gold (US$/oz)']] as const;
  try {
    const r = await fetch(`/api/markets/batch?symbols=${encodeURIComponent(list.map((x) => x[0]).join(','))}`, { signal: AbortSignal.timeout(8000) });
    const d = (await r.json()) as { results?: Array<{ symbol: string; quote?: { price: number; changePercent: number | null } }> };
    return list.flatMap(([s, label]) => { const q = d.results?.find((x) => x.symbol === s)?.quote; return q ? [{ label, price: q.price, ch: q.changePercent }] : []; });
  } catch {
    return [];
  }
}

/** The latest dashboard analysis, or a fresh one (grounded on live markets, news and web) if there is none. */
async function advisorAnalysis(summary: string): Promise<StructuredFinancialAnswer | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(DASH_ANALYSIS_KEY) || 'null') as { at: number; answer: StructuredFinancialAnswer } | null;
    if (cached?.answer && Date.now() - cached.at < 24 * 3600_000) return cached.answer;
  } catch { /* ignore */ }
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ task: 'cfo', prompt: `You are this person's CFO, writing the advisor section of their financial report. Use every number and answer below plus today's market and news context. Cover: the verdict; strengths to keep; weaknesses ranked by urgency with the numbers behind each; cash flow, debt, emergency fund, insurance, tax regime, goals and retirement, and an investment mix that fits their risk mindset; the limits of this analysis; and a 30/60/90-day action plan with amounts.\n\n${summary}\n\nQuestion: Give me a complete analysis of my finances`.slice(0, 7800), history: [], context: { detail: 'detailed' } }),
    });
    const data = await res.json().catch(() => ({}));
    return data?.structuredAnswer ?? null;
  } catch {
    return null;
  }
}


// ---------------- Charts (drawn on a canvas, placed in the PDF as images) ----------------

const PALETTE = ['#0F766E', '#2DD4BF', '#F59E0B', '#64748B', '#16A34A', '#0EA5E9', '#B45309'];

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d')!;
  g.scale(2, 2);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  return [c, g];
}

/** Donut chart with the total in the middle. */
function donutPng(data: Slice[], centre: string): string {
  const [c, g] = canvas(240, 240);
  const total = data.reduce((s, x) => s + x.value, 0) || 1;
  let a = -Math.PI / 2;
  data.forEach((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    g.beginPath(); g.moveTo(120, 120); g.arc(120, 120, 110, a, a + sweep); g.closePath();
    g.fillStyle = PALETTE[i % PALETTE.length]; g.fill();
    a += sweep;
  });
  g.beginPath(); g.arc(120, 120, 66, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
  g.fillStyle = '#172033'; g.font = 'bold 17px Helvetica, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(centre, 120, 120);
  return c.toDataURL('image/png');
}

/** One bar per item: how much of what is needed is covered (100% = fully covered). */
function haveNeedPng(rows: Array<{ label: string; have: number; need: number }>, fmt: (n: number) => string): string {
  const W = 500, rowH = 46, H = 10 + rows.length * rowH, track = 300, left = 120;
  const [c, g] = canvas(W, H);
  g.textBaseline = 'middle';
  rows.forEach((r, i) => {
    const y = 10 + i * rowH + 12;
    const share = r.need > 0 ? Math.min(1, r.have / r.need) : 1;
    g.fillStyle = '#172033'; g.font = 'bold 12px Helvetica, Arial'; g.textAlign = 'left'; g.fillText(r.label, 0, y);
    g.fillStyle = '#E2E8F0'; g.fillRect(left, y - 8, track, 16);
    g.fillStyle = share >= 1 ? '#16A34A' : share >= 0.5 ? '#F59E0B' : '#DC2626'; g.fillRect(left, y - 8, Math.max(3, share * track), 16);
    g.fillStyle = '#172033'; g.font = 'bold 12px Helvetica, Arial'; g.fillText(`${Math.round(share * 100)}%`, left + track + 8, y);
    g.fillStyle = '#64748B'; g.font = '10.5px Helvetica, Arial'; g.fillText(`${fmt(r.have)} of ${fmt(r.need)}`, left, y + 17);
  });
  return c.toDataURL('image/png');
}

/** Line chart: projected investments vs money needed, by age. */
function pathPng(points: Array<{ age: number; projected: number; needed: number }>, fmt: (n: number) => string): string {
  const W = 500, H = 230, L = 70, R = 14, T = 14, B = 30;
  const [c, g] = canvas(W, H);
  const max = Math.max(1, ...points.flatMap((p) => [p.projected, p.needed])) * 1.08;
  const x = (i: number) => L + (i / Math.max(1, points.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  g.strokeStyle = '#E2E8F0'; g.lineWidth = 1; g.font = '10px Helvetica, Arial'; g.fillStyle = '#64748B'; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let k = 0; k <= 4; k++) { const v = (max / 4) * k; g.beginPath(); g.moveTo(L, y(v)); g.lineTo(W - R, y(v)); g.stroke(); g.fillText(fmt(v), L - 6, y(v)); }
  g.textAlign = 'center'; g.textBaseline = 'top';
  points.forEach((p, i) => g.fillText(`${p.age}`, x(i), H - B + 8));
  const line = (key: 'projected' | 'needed', color: string, dash: number[]) => {
    g.beginPath(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = 2.5;
    points.forEach((p, i) => (i ? g.lineTo(x(i), y(p[key])) : g.moveTo(x(i), y(p[key])))); g.stroke(); g.setLineDash([]);
  };
  line('needed', '#F59E0B', [6, 4]); line('projected', '#0F766E', []);
  return c.toDataURL('image/png');
}

/** Score gauge (0-100) for the cover. */
function gaugePng(score: number): string {
  const [c, g] = canvas(200, 120);
  g.lineWidth = 18; g.lineCap = 'round';
  g.strokeStyle = '#E2E8F0'; g.beginPath(); g.arc(100, 100, 76, Math.PI, 2 * Math.PI); g.stroke();
  g.strokeStyle = score >= 70 ? '#16A34A' : score >= 45 ? '#F59E0B' : '#DC2626';
  g.beginPath(); g.arc(100, 100, 76, Math.PI, Math.PI + (Math.max(0, Math.min(100, score)) / 100) * Math.PI); g.stroke();
  g.fillStyle = '#172033'; g.font = 'bold 30px Helvetica, Arial'; g.textAlign = 'center'; g.fillText(String(score), 100, 96);
  g.font = '11px Helvetica, Arial'; g.fillStyle = '#64748B'; g.fillText('out of 100', 100, 114);
  return c.toDataURL('image/png');
}

/** Builds and downloads the PDF. Throws only when there is nothing to report yet. */
export async function downloadFinancialReport(summary: string): Promise<void> {
  const profile = loadMoneyProfile();
  if (!profile) throw new Error('Answer the setup questions first, then download your report.');
  let d: CompleteDashboard;
  try { d = buildCompleteDashboard({ profile, loans: loadEmiRecords(), income: loadIncomeSources(), expenses: loadExpenses() }); }
  catch { d = buildCompleteDashboard({ profile, loans: [], income: [], expenses: [] }); }
  const record = loadOnboardingRecord();
  const a = record?.answers ?? {};
  const m = (v: number) => pdfMoney(v, 'INR');
  const mShort = (v: number) => (Math.abs(v) >= 1e7 ? `Rs ${(v / 1e7).toFixed(2)} cr` : Math.abs(v) >= 1e5 ? `Rs ${(v / 1e5).toFixed(1)} L` : m(v));
  const r = d.report;
  const x = analyseFinances(profile, d, a);
  const [{ jsPDF }, logo, markets, analysis] = await Promise.all([import('jspdf'), logoPng(), liveMarkets(), advisorAnalysis(summary)]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), X = 48, maxW = W - 2 * X;
  type RGB = [number, number, number];
  const TEAL: RGB = [15, 118, 110], INK: RGB = [23, 32, 51], MUTED: RGB = [100, 116, 139], RED: RGB = [185, 28, 28], GREEN: RGB = [21, 128, 61];
  let y = 0;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const name = clean(a.name || profile.name || 'You');
  let section = 0;

  const pageHeader = () => {
    doc.setFillColor(11, 15, 20); doc.rect(0, 0, W, 46, 'F');
    if (logo) doc.addImage(logo, 'PNG', X, 10, 26, 26);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('ArthaMind', X + 34, 28);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 210, 220);
    doc.text(clean(`Personal Financial Report · ${name} · ${today}`), W - X, 28, { align: 'right' });
    y = 78;
  };
  const newPage = () => { doc.addPage(); pageHeader(); };
  const ensure = (h: number) => { if (y + h > H - 64) newPage(); };
  const h2 = (t: string, keep = 220) => {
    ensure(keep); section += 1; y += 4;
    doc.setFillColor(...TEAL); doc.rect(X, y - 2, 4, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...INK); doc.text(clean(`${section}. ${t}`), X + 12, y + 13); y += 36;
  };
  const h3 = (t: string, color: RGB = INK, keep = 28) => { ensure(keep); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...color); doc.text(clean(t), X, y); y += 16; };
  const para = (t: string, size = 10.5, color: RGB = INK, bold = false, indent = 0) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(clean(t), maxW - indent) as string[]) { ensure(size + 5); doc.text(line, X + indent, y); y += size + 4.5; }
    y += 4;
  };
  const bullet = (t: string, color: RGB = INK) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean(t), maxW - 14) as string[];
    lines.forEach((line, i) => { ensure(15); if (i === 0) { doc.setFillColor(...color); doc.circle(X + 3, y - 3.5, 1.8, 'F'); } doc.text(line, X + 14, y); y += 15; });
    y += 2;
  };
  const table = (rows: Array<[string, string]>, width = maxW, left = X) => {
    doc.setFontSize(10.5);
    rows.forEach(([k, v], i) => {
      ensure(20);
      if (i % 2 === 0) { doc.setFillColor(244, 247, 250); doc.rect(left, y - 13, width, 20, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(clean(k), left + 8, y, { maxWidth: width * 0.58 });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(clean(v), left + width - 8, y, { align: 'right' });
      y += 20;
    });
    y += 8;
  };
  /** A donut on the left and its legend on the right. */
  const donut = (data: Slice[], centre: string, emptyText: string) => {
    if (!data.length) { para(emptyText, 10.5, MUTED); return; }
    ensure(190);
    const top = y;
    doc.addImage(donutPng(data, centre), 'PNG', X, top, 170, 170);
    const total = data.reduce((s, v) => s + v.value, 0) || 1;
    let ly = top + 24;
    data.forEach((s, i) => {
      const col = PALETTE[i % PALETTE.length];
      doc.setFillColor(parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16));
      doc.rect(X + 196, ly - 8, 10, 10, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
      doc.text(clean(s.label), X + 214, ly, { maxWidth: 150 });
      doc.setFont('helvetica', 'bold'); doc.text(m(s.value), X + maxW - 46, ly, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(`${Math.round((s.value / total) * 100)}%`, X + maxW, ly, { align: 'right' });
      ly += 20;
    });
    y = Math.max(top + 182, ly + 6);
  };

  // ---------- Cover ----------
  doc.setFillColor(11, 15, 20); doc.rect(0, 0, W, 300, 'F');
  if (logo) doc.addImage(logo, 'PNG', X, 54, 56, 56);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.text('ArthaMind', X + 70, 90);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(170, 220, 210); doc.text('Personal Financial Report', X + 70, 108);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(255, 255, 255); doc.text(clean(`Prepared for ${name}`), X, 190);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(200, 210, 220);
  doc.text(clean(`${today} · Age ${profile.age}${a.jobTitle ? ` · ${a.jobTitle}` : ''}${a.country ? ` · ${a.country}` : ''}`), X, 212);
  doc.text('A complete, plain-language review of income, spending, savings, loans, insurance, tax, goals and retirement,', X, 246);
  doc.text('with an action plan. Every number is calculated from your own answers.', X, 262);
  y = 330;
  doc.addImage(gaugePng(r.health.score), 'PNG', X, y, 150, 90);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(clean(`ArthaMind health score: ${r.health.status}`), X + 170, y + 26);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(clean(x.verdict), maxW - 170) as string[], X + 170, y + 44);
  y += 120;
  const kpis: Array<[string, string]> = [
    ['Net worth', mShort(d.netWorth.value)], ['Take-home a month', mShort(d.monthlyTakeHome.value)],
    ['Left to save a month', mShort(d.monthlySurplus.value)], ['Emergency fund', Number.isFinite(r.emergency.months) ? `${r.emergency.months.toFixed(1)} months` : '-'],
  ];
  const boxW = (maxW - 30) / 4;
  kpis.forEach(([k, v], i) => {
    const bx = X + i * (boxW + 10);
    doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252); doc.roundedRect(bx, y, boxW, 62, 8, 8, 'FD');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(k, bx + 10, y + 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...(k === 'Left to save a month' && d.monthlySurplus.value < 0 ? RED : INK)); doc.text(clean(v), bx + 10, y + 44);
  });
  y += 92;
  h3('What is inside');
  ['Executive summary: strengths and what needs attention', 'Cash flow, net worth, loans and tax, with charts', 'Insurance, emergency fund, goals and the road to retirement', 'ArthaMind advisor analysis and a 30/60/90-day action plan', 'Method, assumptions, limitations, sources and a glossary'].forEach((t) => bullet(t, MUTED));

  // ---------- Executive summary ----------
  newPage();
  h2('Executive summary');
  para(x.verdict, 11);
  h3('Strengths', GREEN);
  if (x.strengths.length) x.strengths.forEach((s) => bullet(`${s.title}: ${s.detail}`, INK)); else para('No clear strengths yet. The action plan below builds them.', 10.5, MUTED);
  h3('Needs attention (most urgent first)', RED);
  if (x.weaknesses.length) x.weaknesses.forEach((s) => bullet(`${s.severity === 'high' ? '[Urgent] ' : ''}${s.title}: ${s.detail}`, s.severity === 'high' ? RED : INK)); else para('Nothing urgent.', 10.5, MUTED);

  // ---------- Profile ----------
  h2('About you');
  const goals = (a.goals ?? (a.goal ? [a.goal] : [])).map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? g);
  table([
    ['Age · people who depend on you', `${profile.age} · ${profile.dependants}`],
    ['Work', clean([WORK_OPTIONS.find((w) => w.value === a.work)?.label, a.jobTitle].filter(Boolean).join(' · ') || 'Not answered')],
    ...(a.jobYears !== undefined ? [['Years in this work · total years earning', `${a.jobYears} · ${a.totalYears ?? '-'}`] as [string, string]] : []),
    ['Income pattern', a.steadiness === 'fixed' ? 'Same every month' : a.steadiness === 'varies' ? 'Changes a little' : a.steadiness === 'irregular' ? 'Changes a lot' : 'Not answered'],
    ...(a.incomeSources?.length ? [['Income from', a.incomeSources.join(', ')] as [string, string]] : []),
    ['Goals, in order', goals.length ? goals.join(' > ') : 'Not answered'],
    ['Plans to stop working at', `${profile.retireAge ?? 60}`],
    ['Money mindset', record ? `${record.result.riskLabel.split(':')[0]} risk · ${record.result.habitLabel.split(':')[0]}` : 'Not answered'],
    ['Reading level · language', `${loadPrefs().level} · ${a.language ?? 'en-IN'}`],
  ]);

  // ---------- Cash flow ----------
  h2('Cash flow: where the money goes each month');
  donut(x.monthlyFlow, mShort(d.annualIncome.value / 12), 'No income or spending entered.');
  table([
    ['Income before tax', m(d.annualIncome.value / 12)],
    ['Income tax (monthly)', m(Math.max(0, d.annualIncome.value / 12 - d.monthlyTakeHome.value))],
    ['Take-home pay', m(d.monthlyTakeHome.value)],
    ['Spending', m(d.monthlyExpenses.value)],
    ['Loan EMIs', m(d.monthlyEmi.value)],
    [d.monthlySurplus.value >= 0 ? 'Left to save' : 'Short each month', m(Math.abs(d.monthlySurplus.value))],
    ['Savings rate (target 20%+)', pct(Math.max(0, r.cashflow.savingsRate))],
  ]);
  if (a.fixedExpenses !== undefined) para(`Spending split from your answers: fixed costs ${m(a.fixedExpenses)}, day-to-day ${m(a.variableExpenses ?? 0)}${a.overspend ? `; extra money usually goes to ${a.overspend.toLowerCase()}` : ''}.`, 9.5, MUTED);

  // ---------- Net worth ----------
  h2('Net worth statement');
  h3('What you own', INK, 210);
  donut(x.assets, mShort(x.assets.reduce((s, v) => s + v.value, 0)), 'No savings or investments entered.');
  h3('What you owe', INK, 210);
  donut(x.liabilities, mShort(d.totalDebt.value), 'No loans. Debt-free.');
  table([
    ['Cash, bank and FDs', m(d.totalSavings.value)],
    ['Long-term investments (incl. gold)', m(d.totalInvestments.value)],
    ['Loans still to repay', `-${m(d.totalDebt.value)}`],
    ['Net worth (financial)', m(d.netWorth.value)],
  ]);
  const pf = loadPortfolio();
  const pfs = pf.holdings.length ? summarise(pf, profile.age) : null;
  if (pfs) para(`Portfolio: value ${m(pfs.assets)}, gain ${m(pfs.gain)}${pfs.xirr != null ? `, yearly return (XIRR) ${pct(pfs.xirr)}` : ''}. Mix: ${pfs.byClass.map((c) => `${c.cls} ${pct(c.share)}`).join(', ')}.`);

  // ---------- Loans ----------
  h2('Loans and EMIs');
  const emiShare = d.monthlyTakeHome.value > 0 ? d.monthlyEmi.value / d.monthlyTakeHome.value : 0;
  para(`EMIs take ${pct(emiShare)} of take-home pay. Comfortable is under 30-40%.${a.highestRate ? ` Your costliest loan charges ${a.highestRate}% a year; paying it early is a guaranteed ${a.highestRate}% return.` : ''}`);
  if (d.loans.length) table(d.loans.map((l) => [clean(`${l.name}${l.rate != null ? ` (${l.rate}%)` : ''}`), `${m(l.emi)}/month · ${m(l.outstanding)} left`] as [string, string]));
  if (a.creditCardDue) para(`Unpaid credit card: ${m(a.creditCardDue)} at about 36-42% a year. Clear this first.`, 10.5, RED, true);

  // ---------- Tax ----------
  h2('Income tax (India, this financial year)');
  table([
    ['Tax in the old regime', m(r.tax.oldRegimeTax)],
    ['Tax in the new regime', m(r.tax.newRegimeTax)],
    ['Better for you', r.tax.better === 'same' ? 'Both cost the same' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime, saves ${m(r.tax.saving)}`],
    ['Effective tax rate', pct(d.effectiveTaxRate)],
    ...(a.taxRegime ? [['Regime you use now', a.taxRegime === 'unsure' ? 'Not sure' : a.taxRegime === 'new' ? 'New' : 'Old'] as [string, string]] : []),
  ]);
  if (r.tax.warnings.length) para(`Notes: ${r.tax.warnings.slice(0, 3).join(' ')}`, 9.5, MUTED);

  // ---------- Protection ----------
  h2('Insurance and emergency fund');
  const protH = ((10 + x.protection.length * 46) / 500) * maxW;
  ensure(protH + 16);
  doc.addImage(haveNeedPng(x.protection, mShort), 'PNG', X, y, maxW, protH);
  y += protH + 12;
  table([
    ['Emergency fund target (6 months of costs)', m(r.emergency.target)],
    ['Still needed', m(r.emergency.gap)],
    ['Life cover needed · gap', `${mShort(r.protection.termCoverNeeded)} · ${r.protection.termGap > 0 ? mShort(r.protection.termGap) : 'Covered'}`],
    ['Health cover suggested · gap', `${mShort(r.protection.healthCoverSuggested)} · ${r.protection.healthGap > 0 ? mShort(r.protection.healthGap) : 'Covered'}`],
    ['Nominees · will', `${a.nominees === 'all' ? 'On all' : a.nominees ? 'Not on all' : 'Not answered'} · ${a.will === 'yes' ? 'Yes' : a.will === 'no' ? 'Not yet' : 'Not answered'}`],
  ]);

  // ---------- Goals ----------
  h2('Goals and the road to retirement');
  if (goals.length) para(`Your goals, most important first: ${goals.join(', ')}.`);
  if (x.retirementPath.length > 1) {
    ensure(190);
    doc.addImage(pathPng(x.retirementPath, mShort), 'PNG', X, y, 400, 184);
    y += 190;
    para('Teal line: your investments, growing about 10% a year with today\'s monthly surplus invested. Dashed line: money needed at retirement.', 9, MUTED);
  }
  table([
    ['Money needed at retirement (freedom number)', m(r.freedom.corpusNeeded)],
    ['Reached so far', pct(d.freedomProgress)],
    ['Monthly investment needed', m(r.freedom.monthlySipNeeded)],
    ['Financially free by age (investing your surplus)', r.freedom.freedomAge ? String(r.freedom.freedomAge) : 'Not yet on this plan'],
    ...(r.goal ? [['Top goal: future cost · monthly saving', `${mShort(r.goal.futureCost)} · ${m(r.goal.monthlySip)}`] as [string, string]] : []),
  ]);

  // ---------- Advisor ----------
  h2('ArthaMind advisor analysis');
  if (analysis) {
    para(analysis.directAnswer, 11);
    analysis.steps?.forEach((s) => { h3(s.title); para(s.explanation, 10.5, MUTED); });
    if (analysis.interpretation?.length) { h3('What it means'); analysis.interpretation.forEach((t) => bullet(t)); }
    if (analysis.risks?.length) { h3('Risks to watch', RED); analysis.risks.forEach((t) => bullet(t)); }
    if (analysis.keyTakeaways?.length) { h3('Recommended actions', GREEN); analysis.keyTakeaways.forEach((t) => bullet(t)); }
    if (analysis.sources?.length) { h3('Sources used by the advisor'); analysis.sources.slice(0, 8).forEach((s) => bullet(`${s.name}${s.dataDate ? ` (${s.dataDate})` : ''}${s.url ? ` - ${s.url}` : ''}`, MUTED)); }
  } else {
    para('The written advisor analysis could not be fetched right now. Open your dashboard once while online and download the report again. All calculated sections above are complete.', 10.5, MUTED);
  }

  // ---------- Action plan ----------
  const path = buildPath({ ...a, monthlyIncome: a.monthlyIncome ?? profile.annualSalary / 12, monthlyEmi: a.monthlyEmi ?? profile.monthlyEmi, liquidSavings: a.liquidSavings ?? profile.liquidSavings, dependants: a.dependants ?? profile.dependants, healthCover: a.healthCover ?? profile.healthCover, termCover: a.termCover ?? profile.termCover, ...(totalSpend(a) === undefined ? { monthlyExpenses: profile.monthlyExpenses } : {}) }, m);
  h2('Your action plan');
  const urgent = path.steps.filter((s) => s.tone === 'urgent'), next = path.steps.filter((s) => s.tone === 'next'), grow = path.steps.filter((s) => s.tone === 'good');
  ([['Next 30 days', urgent], ['Next 60 days', next], ['Next 90 days and beyond', grow]] as const).forEach(([label, list]) => {
    if (!list.length) return;
    h3(label, label === 'Next 30 days' ? RED : TEAL);
    list.forEach((s) => bullet(`${s.title}: ${s.text}`));
  });

  // ---------- Markets ----------
  if (markets.length) {
    h2('Markets on the day of this report');
    table(markets.map((q) => [q.label, `${q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${q.ch != null ? `  (${q.ch >= 0 ? '+' : ''}${q.ch.toFixed(2)}%)` : ''}`] as [string, string]));
    para('Delayed quotes. Markets go up and down; past moves do not predict the future.', 9, MUTED);
  }

  // ---------- Method ----------
  h2('Method, assumptions and limitations');
  x.limitations.forEach((t) => bullet(t));
  h2('Sources');
  x.sources.forEach((s) => bullet(`${s.name} - used for: ${s.use}.`));
  h2('Glossary');
  x.glossary.forEach((g) => { ensure(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(clean(g.term), X, y); y += 14; para(g.meaning, 10, MUTED); });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.6); doc.line(X, H - 46, W - X, H - 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Investments are subject to market risks. Read all related documents carefully. ArthaMind is for learning and planning, not investment advice.', X, H - 32, { maxWidth: maxW - 60 });
    doc.text(`Page ${i} of ${pages}`, W - X, H - 32, { align: 'right' });
  }
  doc.save(`ArthaMind-Financial-Report-${clean(name).replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
