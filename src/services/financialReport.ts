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
      body: JSON.stringify({ task: 'cfo', prompt: `Write the advisor section of this person's financial report. Use every number below plus today's market and news context. Rank issues by urgency with the numbers behind each, then give concrete next steps with amounts and timelines.\n\n${summary}\n\nQuestion: Give me a complete analysis of my finances`.slice(0, 7800), history: [], context: { detail: 'detailed' } }),
    });
    const data = await res.json().catch(() => ({}));
    return data?.structuredAnswer ?? null;
  } catch {
    return null;
  }
}


/** Builds and downloads the PDF. Throws only when there is nothing to report yet. */
export async function downloadFinancialReport(summary: string): Promise<void> {
  const profile = loadMoneyProfile();
  if (!profile) throw new Error('Answer the setup questions first, then download your report.');
  const loans = loadEmiRecords();
  let d: CompleteDashboard;
  try { d = buildCompleteDashboard({ profile, loans, income: loadIncomeSources(), expenses: loadExpenses() }); }
  catch { d = buildCompleteDashboard({ profile, loans: [], income: [], expenses: [] }); }
  const record = loadOnboardingRecord();
  const a = record?.answers ?? {};
  const cur = 'INR'; // the workspace calculators work in rupees
  const m = (v: number) => pdfMoney(v, cur);
  const r = d.report;
  const [{ jsPDF }, logo, markets, analysis] = await Promise.all([import('jspdf'), logoPng(), liveMarkets(), advisorAnalysis(summary)]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), X = 48, maxW = W - 2 * X;
  const TEAL: [number, number, number] = [15, 118, 110], INK: [number, number, number] = [23, 32, 51], MUTED: [number, number, number] = [100, 116, 139];
  let y = 0;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const name = clean(a.name || profile.name || 'You');

  const header = (first: boolean) => {
    doc.setFillColor(11, 15, 20); doc.rect(0, 0, W, first ? 118 : 46, 'F');
    if (logo) doc.addImage(logo, 'PNG', X, first ? 26 : 10, first ? 40 : 26, first ? 40 : 26);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(first ? 22 : 13);
    doc.text('ArthaMind', X + (first ? 52 : 34), first ? 52 : 28);
    if (first) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(200, 210, 220);
      doc.text('Personal Financial Report', X + 52, 70);
      doc.text(clean(`Prepared for ${name} · ${today}`), X, 100);
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 210, 220);
      doc.text(clean(`Personal Financial Report · ${name}`), W - X, 28, { align: 'right' });
    }
    y = first ? 146 : 76;
  };
  const ensure = (h: number) => { if (y + h > H - 60) { doc.addPage(); header(false); } };
  const h2 = (t: string) => {
    ensure(48); y += 6;
    doc.setDrawColor(...TEAL); doc.setLineWidth(2); doc.line(X, y, X + 28, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...INK); doc.text(clean(t), X, y + 20); y += 44;
  };
  const para = (t: string, size = 10.5, color: [number, number, number] = INK, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(clean(t), maxW) as string[]) { ensure(size + 5); doc.text(line, X, y); y += size + 4.5; }
    y += 4;
  };
  const bullet = (t: string) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(clean(t), maxW - 14) as string[];
    lines.forEach((line, i) => { ensure(15); if (i === 0) doc.text('•', X, y); doc.text(line, X + 14, y); y += 15; });
    y += 2;
  };
  const table = (rows: Array<[string, string]>) => {
    doc.setFontSize(10.5);
    rows.forEach(([k, v], i) => {
      ensure(20);
      if (i % 2 === 0) { doc.setFillColor(244, 247, 250); doc.rect(X, y - 13, maxW, 20, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(clean(k), X + 8, y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(clean(v), X + maxW - 8, y, { align: 'right' });
      y += 20;
    });
    y += 8;
  };

  header(true);

  // 1. Summary
  h2('1. Your money at a glance');
  const spendAns = totalSpend(a);
  table([
    ['Money in each month (before tax)', m(profile.annualSalary / 12)],
    ['Take-home each month (after tax)', m(d.monthlyTakeHome.value)],
    ['Spending each month', m(d.monthlyExpenses.value)],
    ['Loan EMIs each month', m(d.monthlyEmi.value)],
    [d.monthlySurplus.value >= 0 ? 'Left to save each month' : 'Short each month', m(Math.abs(d.monthlySurplus.value))],
    ['Savings rate', pct(Math.max(0, r.cashflow.savingsRate))],
    ['Net worth (what you own minus what you owe)', m(d.netWorth.value)],
    ['Emergency fund', Number.isFinite(r.emergency.months) ? `${r.emergency.months.toFixed(1)} months of costs` : 'No monthly costs entered'],
    ['ArthaMind health score', `${r.health.score} / 100 (${r.health.status})`],
  ]);
  if (spendAns !== undefined && a.fixedExpenses !== undefined) para(`Spending split from your answers: fixed costs ${m(a.fixedExpenses)}, day-to-day ${m(a.variableExpenses ?? 0)} a month.`, 9.5, MUTED);

  // 2. Net worth statement
  h2('2. Net worth statement');
  const pf = loadPortfolio();
  const pfs = pf.holdings.length ? summarise(pf, profile.age) : null;
  table([
    ['Cash, bank and FDs', m(d.totalSavings.value)],
    ['Long-term investments', m(d.totalInvestments.value)],
    ...(a.gold ? [['Gold (included above)', m(a.gold)] as [string, string]] : []),
    ...(a.propertyValue ? [['Property', m(a.propertyValue)] as [string, string]] : []),
    ...(a.businessValue ? [['Business stake', m(a.businessValue)] as [string, string]] : []),
    ['Loans still to repay', `-${m(d.totalDebt.value)}`],
    ...(a.creditCardDue ? [['Unpaid credit card (included above)', `-${m(a.creditCardDue)}`] as [string, string]] : []),
    ['Net worth (financial)', m(d.netWorth.value)],
  ]);
  if (a.propertyValue || a.businessValue) para('Net worth above counts money and investments. Property and business stake are shown for completeness but not added, because they are hard to sell quickly.', 9.5, MUTED);
  if (pfs) para(`Portfolio: value ${m(pfs.assets)}, gain ${m(pfs.gain)}${pfs.xirr != null ? `, yearly return (XIRR) ${pct(pfs.xirr)}` : ''}. Mix: ${pfs.byClass.map((c) => `${c.cls} ${pct(c.share)}`).join(', ')}.`);

  // 3. Debt
  h2('3. Loans and EMIs');
  const emiShare = d.monthlyTakeHome.value > 0 ? d.monthlyEmi.value / d.monthlyTakeHome.value : 0;
  para(`EMIs take ${pct(emiShare)} of your take-home pay. A safe level is below 40%.`);
  if (d.loans.length) table(d.loans.map((l) => [clean(`${l.name}${l.rate != null ? ` (${l.rate}%)` : ''}`), `${m(l.emi)}/month · ${m(l.outstanding)} left`] as [string, string]));
  else para('No loans recorded.', 10.5, MUTED);
  if (a.highestRate) para(`Highest interest rate you told us: ${a.highestRate}% a year. Pay extra on this loan first.`);

  // 4. Tax
  h2('4. Income tax (India, this financial year)');
  table([
    ['Tax in the old regime', m(r.tax.oldRegimeTax)],
    ['Tax in the new regime', m(r.tax.newRegimeTax)],
    ['Better for you', r.tax.better === 'same' ? 'Both are the same' : `${r.tax.better === 'new' ? 'New' : 'Old'} regime, saves ${m(r.tax.saving)}`],
    ['Effective tax rate', pct(d.effectiveTaxRate)],
  ]);
  if (a.taxRegime && a.taxRegime !== 'unsure' && r.tax.better !== 'same' && a.taxRegime !== r.tax.better) para(`You said you use the ${a.taxRegime} regime, but the ${r.tax.better} regime saves you ${m(r.tax.saving)} this year. Check with your CA before you file.`, 10.5, TEAL, true);

  // 5. Protection
  h2('5. Insurance and safety');
  table([
    ['Emergency fund target (6 months)', m(r.emergency.target)],
    ['Emergency fund still needed', m(r.emergency.gap)],
    ['Life cover gap', r.protection.termGap > 0 ? m(r.protection.termGap) : 'Covered'],
    ['Health cover gap', r.protection.healthGap > 0 ? m(r.protection.healthGap) : 'Covered'],
    ['Nominees on all accounts', a.nominees === 'all' ? 'Yes' : a.nominees ? 'Not on all' : 'Not answered'],
    ['Will', a.will === 'yes' ? 'Yes' : a.will === 'no' ? 'Not yet' : 'Not answered'],
  ]);

  // 6. Goals
  h2('6. Goals and retirement');
  const goals = (a.goals ?? []).map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? g);
  if (goals.length) para(`Your goals, most important first: ${goals.join(', ')}.`);
  table([
    ['Retirement money needed (freedom number)', m(r.freedom.corpusNeeded)],
    ['Reached so far', pct(d.freedomProgress)],
    ['Monthly investment needed to get there', m(r.freedom.monthlySipNeeded)],
    ['Stop working at', `${profile.retireAge ?? 60}`],
  ]);

  // 7. Path
  const path = buildPath({ ...a, monthlyIncome: a.monthlyIncome ?? profile.annualSalary / 12, monthlyEmi: a.monthlyEmi ?? profile.monthlyEmi, liquidSavings: a.liquidSavings ?? profile.liquidSavings, dependants: a.dependants ?? profile.dependants, healthCover: a.healthCover ?? profile.healthCover, termCover: a.termCover ?? profile.termCover, ...(spendAns === undefined ? { monthlyExpenses: profile.monthlyExpenses } : {}) }, m);
  h2('7. Your path, step by step');
  path.steps.forEach((s, i) => { para(`${i + 1}. ${s.title}`, 11, s.tone === 'urgent' ? [185, 28, 28] : INK, true); y -= 4; para(s.text, 10.5, MUTED); });

  // 8. Advisor
  h2('8. ArthaMind advisor analysis');
  if (analysis) {
    para(analysis.directAnswer);
    analysis.steps?.forEach((s) => { para(s.title, 11, INK, true); y -= 4; para(s.explanation, 10.5, MUTED); });
    if (analysis.risks?.length) { para('Risks to watch', 11, INK, true); analysis.risks.forEach(bullet); }
    if (analysis.keyTakeaways?.length) { para('What to do next', 11, INK, true); analysis.keyTakeaways.forEach(bullet); }
    if (analysis.sources?.length) para(`Sources: ${analysis.sources.slice(0, 6).map((s) => `${s.name}${s.dataDate ? ` (${s.dataDate})` : ''}`).join('; ')}.`, 9, MUTED);
  } else {
    para('The advisor analysis could not be fetched right now. Open your dashboard once while online and download the report again.', 10.5, MUTED);
  }

  // 9. Markets
  if (markets.length) {
    h2('9. Markets on the day of this report');
    table(markets.map((q) => [q.label, `${q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${q.ch != null ? `  (${q.ch >= 0 ? '+' : ''}${q.ch.toFixed(2)}%)` : ''}`] as [string, string]));
    para('Delayed quotes. Markets go up and down; past moves do not predict the future.', 9, MUTED);
  }

  // 10. Profile
  h2(markets.length ? '10. About you' : '9. About you');
  table([
    ['Age', `${profile.age}`],
    ['Work', clean([WORK_OPTIONS.find((w) => w.value === a.work)?.label, a.jobTitle].filter(Boolean).join(' · ') || 'Not answered')],
    ['People who depend on you', `${profile.dependants}`],
    ['Money mindset', record ? record.result.riskLabel.split(':')[0] + ' · ' + record.result.habitLabel.split(':')[0] : 'Not answered'],
    ['Reading level', loadPrefs().level],
  ]);

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.6); doc.line(X, H - 46, W - X, H - 46);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Investments are subject to market risks. Read all related documents carefully. ArthaMind is for learning and planning, not investment advice.', X, H - 32, { maxWidth: maxW - 50 });
    doc.text(`Page ${i} of ${pages}`, W - X, H - 32, { align: 'right' });
  }
  doc.save(`ArthaMind-Financial-Report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
