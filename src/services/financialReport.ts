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
import { loadProfilePhoto, circleCrop } from './profilePhoto';
import { MONEY_CHECK_ASSUMPTIONS } from './moneyCheck';
import { fetchInvestmentPlan, planInputFrom, type InvestmentPlan } from './investmentPlanApi';

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

/** Builds and downloads the PDF (about 20-25 pages). Throws only when there is nothing to report yet. */
export async function downloadFinancialReport(summary: string): Promise<void> {
  const profile = loadMoneyProfile();
  if (!profile) throw new Error('Answer the setup questions first, then download your report.');
  let d: CompleteDashboard;
  try { d = buildCompleteDashboard({ profile, loans: loadEmiRecords(), income: loadIncomeSources(), expenses: loadExpenses() }); }
  catch { d = buildCompleteDashboard({ profile, loans: [], income: [], expenses: [] }); }
  const record = loadOnboardingRecord();
  const a = record?.answers ?? {};
  const photo = loadProfilePhoto();
  const m = (v: number) => pdfMoney(v, 'INR');
  const mShort = (v: number) => (Math.abs(v) >= 1e7 ? `Rs ${(v / 1e7).toFixed(2)} cr` : Math.abs(v) >= 1e5 ? `Rs ${(v / 1e5).toFixed(2)} lakh` : m(v));
  const r = d.report;
  const x = analyseFinances(profile, d, a);
  const [{ jsPDF }, logo, markets, analysis, avatar, plan] = await Promise.all([
    import('jspdf'), logoPng(), liveMarkets(), advisorAnalysis(summary),
    photo ? circleCrop(photo.dataUrl, 320).catch(() => null) : Promise.resolve(null),
    fetchInvestmentPlan(planInputFrom(profile, d, record)).catch((): InvestmentPlan | null => null),
  ]);

  // ---- derived figures used across sections (all calculated, none generated) ----
  const gross = d.annualIncome.value / 12, takeHome = d.monthlyTakeHome.value, tax = Math.max(0, gross - takeHome);
  const spend = d.monthlyExpenses.value, emi = d.monthlyEmi.value, surplus = d.monthlySurplus.value;
  const outflow = spend + emi, liquid = d.totalSavings.value, invested = d.totalInvestments.value;
  const bankMonths = outflow > 0 ? liquid / outflow : Infinity;
  const healthCover = profile.healthCover ?? 0, termCover = profile.termCover ?? 0;
  const goals = (a.goals ?? (a.goal ? [a.goal] : [])).map((g) => GOAL_OPTIONS.find((o) => o.value === g)?.label ?? g);
  const name = clean(a.name || profile.name || 'You');
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const reportId = `AM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(profile.updatedAt || '').replace(/\D/g, '').slice(-6) || '000000'}`;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), X = 48, maxW = W - 2 * X;
  type RGB = [number, number, number];
  const TEAL: RGB = [15, 118, 110], INK: RGB = [23, 32, 51], MUTED: RGB = [100, 116, 139], RED: RGB = [185, 28, 28], GREEN: RGB = [21, 128, 61], AMBER: RGB = [180, 83, 9];
  let y = 0;
  const sections: Array<{ title: string; page: number }> = [];
  let sectionNo = 0;
  const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

  const pageHeader = () => {
    doc.setFillColor(11, 15, 20); doc.rect(0, 0, W, 46, 'F');
    if (logo) doc.addImage(logo, 'PNG', X, 10, 26, 26);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('ArthaMind', X + 34, 28);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 210, 220);
    doc.text(clean(`Personal Financial Report · ${name} · ${reportId}`), W - X, 28, { align: 'right' });
    y = 78;
  };
  const newPage = () => { doc.addPage(); pageHeader(); };
  const ensure = (h: number) => { if (y + h > H - 64) newPage(); };
  const startSection = (t: string) => {
    newPage(); sectionNo += 1;
    sections.push({ title: `${sectionNo}. ${t}`, page: doc.getNumberOfPages() });
    doc.setFillColor(...TEAL); doc.rect(X, y - 2, 4, 22, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...INK); doc.text(clean(`${sectionNo}. ${t}`), X + 12, y + 14); y += 40;
  };
  const h3 = (t: string, color: RGB = INK, keep = 40) => { ensure(keep); doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...color); doc.text(clean(t), X, y); y += 16; };
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
  /** Two-column table: label on the left, value on the right, shaded every other row. */
  const table = (rows: Array<[string, string]>, width = maxW, left = X) => {
    doc.setFontSize(10.5);
    rows.forEach(([k, v], i) => {
      ensure(20);
      if (i % 2 === 0) { doc.setFillColor(244, 247, 250); doc.rect(left, y - 13, width, 20, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(clean(k), left + 8, y, { maxWidth: width * 0.56 });
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(clean(v), left + width - 8, y, { align: 'right', maxWidth: width * 0.42 });
      y += 20;
    });
    y += 8;
  };
  /** Multi-column table with a shaded header row. */
  const grid = (headers: string[], rows: string[][], widths: number[], align: Array<'left' | 'right'> = []) => {
    const total = widths.reduce((s, w) => s + w, 0), scale = maxW / total, ws = widths.map((w) => w * scale);
    const cellX = (i: number) => X + ws.slice(0, i).reduce((s, w) => s + w, 0);
    ensure(24);
    doc.setFillColor(...TEAL); doc.rect(X, y - 13, maxW, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    headers.forEach((h, i) => doc.text(clean(h), align[i] === 'right' ? cellX(i) + ws[i] - 6 : cellX(i) + 6, y, { align: align[i] === 'right' ? 'right' : 'left', maxWidth: ws[i] - 10 }));
    y += 20;
    rows.forEach((row, ri) => {
      ensure(20);
      if (ri % 2 === 0) { doc.setFillColor(244, 247, 250); doc.rect(X, y - 13, maxW, 20, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      row.forEach((cell, i) => doc.text(clean(cell), align[i] === 'right' ? cellX(i) + ws[i] - 6 : cellX(i) + 6, y, { align: align[i] === 'right' ? 'right' : 'left', maxWidth: ws[i] - 10 }));
      y += 20;
    });
    y += 8;
  };
  const picture = (src: string, w: number, h: number) => { ensure(h + 8); doc.addImage(src, 'PNG', X, y, w, h); y += h + 8; };
  /** Donut on the left, its legend on the right. */
  const donut = (data: Slice[], centre: string, emptyText: string) => {
    if (!data.length) { para(emptyText, 10.5, MUTED); return; }
    ensure(190);
    const top = y;
    doc.addImage(donutPng(data, centre), 'PNG', X, top, 170, 170);
    const total = data.reduce((s, v) => s + v.value, 0) || 1;
    let ly = top + 24;
    data.forEach((s, i) => {
      const [cr, cg, cb] = hex(PALETTE[i % PALETTE.length]);
      doc.setFillColor(cr, cg, cb); doc.rect(X + 196, ly - 8, 10, 10, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...INK);
      doc.text(clean(s.label), X + 214, ly, { maxWidth: 150 });
      doc.setFont('helvetica', 'bold'); doc.text(m(s.value), X + maxW - 46, ly, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(`${Math.round((s.value / total) * 100)}%`, X + maxW, ly, { align: 'right' });
      ly += 20;
    });
    y = Math.max(top + 182, ly + 6);
  };
  const callout = (title: string, text: string, color: RGB = TEAL) => {
    const lines = doc.splitTextToSize(clean(text), maxW - 24) as string[];
    const h = 22 + lines.length * 14;
    ensure(h + 12);
    doc.setFillColor(244, 247, 250); doc.rect(X, y - 12, maxW, h, 'F');
    doc.setFillColor(...color); doc.rect(X, y - 12, 4, h, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...color); doc.text(clean(title), X + 14, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
    lines.forEach((l, i) => doc.text(l, X + 14, y + 18 + i * 14));
    y += h + 8;
  };

  // ================= Page 1: cover =================
  doc.setFillColor(11, 15, 20); doc.rect(0, 0, W, 330, 'F');
  if (logo) doc.addImage(logo, 'PNG', X, 54, 56, 56);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.text('ArthaMind', X + 70, 90);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(170, 220, 210); doc.text('Personal Financial Report', X + 70, 108);
  if (avatar) doc.addImage(avatar, 'PNG', W - X - 118, 40, 118, 118);
  else { doc.setDrawColor(170, 220, 210); doc.setLineWidth(1.5); doc.circle(W - X - 59, 99, 56, 'S'); doc.setFontSize(10); doc.setTextColor(170, 220, 210); doc.text('Live photo not taken yet', W - X - 59, 102, { align: 'center' }); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(255, 255, 255); doc.text(clean(`Prepared for ${name}`), X, 196);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(200, 210, 220);
  doc.text(clean(`${today} · Age ${profile.age}${a.jobTitle ? ` · ${a.jobTitle}` : ''}${a.country ? ` · ${a.country}` : ''}`), X, 218);
  doc.text(clean(`Report ID ${reportId} · Every figure is calculated from the answers you gave.`), X, 234);
  doc.text('A complete review of income, spending, savings, loans, insurance, tax, goals,', X, 268);
  doc.text('retirement and a step-by-step plan, with the advisor analysis and its sources.', X, 284);
  y = 360;
  doc.addImage(gaugePng(r.health.score), 'PNG', X, y, 150, 90);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(clean(`ArthaMind health score: ${r.health.score} / 100 (${r.health.status})`), X + 170, y + 22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTED);
  doc.text(doc.splitTextToSize(clean(x.verdict), maxW - 170) as string[], X + 170, y + 40);
  y += 118;
  const kpis: Array<[string, string]> = [
    ['Net worth', mShort(d.netWorth.value)], ['Take-home a month', mShort(takeHome)],
    ['Left to save a month', mShort(surplus)], ['Bank savings last', Number.isFinite(bankMonths) ? `${bankMonths.toFixed(1)} months` : '-'],
  ];
  const boxW = (maxW - 30) / 4;
  kpis.forEach(([k, v], i) => {
    const bx = X + i * (boxW + 10);
    doc.setDrawColor(226, 232, 240); doc.setFillColor(248, 250, 252); doc.roundedRect(bx, y, boxW, 62, 8, 8, 'FD');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED); doc.text(k, bx + 10, y + 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13.5); doc.setTextColor(...(k === 'Left to save a month' && surplus < 0 ? RED : INK)); doc.text(clean(v), bx + 10, y + 44);
  });
  y += 84;
  if (!photo) para('Note: the live photo has not been taken on this device yet. It is required for the report to be complete; take it on the last step of the setup questions.', 9.5, AMBER);
  h3('What this report contains');
  ['1. Executive summary and the verdict', '2. About you, with your photo', '3. Your monthly money, line by line', '4. Savings and the safety fund', '5. What you own and what you owe', '6. Loans and a debt plan', '7. Income tax, old and new regime', '8. Insurance and protection', '9. Goals', '10. Where to invest, by your profile', '11. The road to retirement', '12. What if: stress tests', '13. Health score and money mindset', '14. The advisor analysis', '15. Your action plan', '16. Markets, method, assumptions, sources, glossary'].forEach((t) => bullet(t, MUTED));

  // ================= Page 2: contents (filled in at the end) =================
  newPage();
  const contentsPage = doc.getNumberOfPages();
  y = 110;

  // ================= 1. Executive summary =================
  startSection('Executive summary');
  para(x.verdict, 11.5, INK, true);
  para(`This report looks at ${name}'s money as it is today and as it could be. Every number comes from the answers given during setup or from the workspace records, and is worked out by ArthaMind's own calculations. Where a figure depends on an assumption (for example future price rises or investment returns), the assumption is written next to it and listed in section 16.`);
  grid(['Measure', 'Value', 'What it tells you'], [
    ['Money in each month (before tax)', m(gross), 'Your starting point'],
    ['Take-home each month', m(takeHome), 'After income tax, what you actually receive'],
    ['Spending + EMIs each month', m(outflow), 'What leaves your account every month'],
    ['Left to save (or short) each month', m(surplus), surplus >= 0 ? 'Positive: you can save and invest' : 'Negative: money is being used up each month'],
    ['Savings rate', pct(Math.max(0, r.cashflow.savingsRate)), 'Healthy is 20% or more of take-home'],
    ['Net worth', m(d.netWorth.value), 'What you own minus what you owe'],
    ['Bank savings last', Number.isFinite(bankMonths) ? `${bankMonths.toFixed(1)} months` : '-', 'If income stopped today; target 6 months'],
    ['Health score', `${r.health.score} / 100`, r.health.status],
  ], [3.2, 1.6, 3.4], ['left', 'right', 'left']);
  h3('Strengths to build on', GREEN);
  if (x.strengths.length) x.strengths.slice(0, 5).forEach((s) => bullet(`${s.title}: ${s.detail}`, INK)); else para('No clear strengths yet. The action plan builds them.', 10.5, MUTED);
  h3('Most urgent issues', RED);
  if (x.weaknesses.length) x.weaknesses.slice(0, 5).forEach((s) => bullet(`${s.severity === 'high' ? '[Urgent] ' : ''}${s.title}: ${s.detail}`, s.severity === 'high' ? RED : INK)); else para('Nothing urgent was found.', 10.5, MUTED);
  callout('How to read this report', 'Start with sections 1, 13 and 14 for the verdict, the advisor analysis and the action plan. The other sections show the working behind each conclusion, so that a second reader (a family member, an adviser or a CA) can check every point.');

  // ================= 2. About you =================
  startSection('About you');
  if (avatar) { ensure(140); doc.addImage(avatar, 'PNG', X, y, 110, 110); }
  const aboutX = avatar ? X + 130 : X;
  const aboutW = avatar ? maxW - 130 : maxW;
  const rowsAbout: Array<[string, string]> = [
    ['Name', name],
    ['Age', `${profile.age}`],
    ['Work', clean([WORK_OPTIONS.find((w) => w.value === a.work)?.label, a.jobTitle].filter(Boolean).join(' · ') || 'Not answered')],
    ['Years in this work · total years earning', a.jobYears !== undefined ? `${a.jobYears} · ${a.totalYears ?? '-'}` : 'Not answered'],
    ['People who depend on you', `${profile.dependants}`],
    ['Income pattern', a.steadiness === 'fixed' ? 'Same every month' : a.steadiness === 'varies' ? 'Changes a little' : a.steadiness === 'irregular' ? 'Changes a lot' : 'Not answered'],
    ['Income comes from', a.incomeSources?.length ? a.incomeSources.join(', ') : 'Not answered'],
    ['Goals, in order', goals.length ? goals.join(' > ') : 'Not answered'],
    ['Plans to stop working at', `${profile.retireAge ?? 60}`],
    ['Money mindset', record ? `${record.result.riskLabel.split(':')[0]} · ${record.result.habitLabel.split(':')[0]}` : 'Not answered'],
    ['Reading level · language', `${loadPrefs().level} · ${a.language ?? 'en-IN'}`],
    ['Live photo', photo ? `Taken ${new Date(photo.takenAt).toLocaleDateString('en-IN')} on this device` : 'Not taken yet'],
  ];
  const restY = y;
  table(rowsAbout, aboutW, aboutX);
  if (avatar && y < restY + 120) y = restY + 124;
  para('Why these details matter: your age sets how long your money has to grow and how much risk suits you; dependants set how much insurance you need; your work and income pattern decide how large your safety fund should be; your goals set the order of your plan; and your money mindset shapes which ideas will fit you.', 10, MUTED);

  // ================= 3. Monthly money =================
  startSection('Your monthly money, line by line');
  para('This section follows one month of money from what you earn to what you can save. Each line shows its share of take-home pay, so you can see where the money goes.');
  donut(x.monthlyFlow, mShort(gross), 'No income or spending entered.');
  const pShare = (v: number) => (takeHome > 0 ? pct(v / takeHome) : '-');
  grid(['Line', 'Amount a month', 'Share of take-home', 'Plain comment'], [
    ['Income before tax', m(gross), '-', 'Everything that comes in, before tax'],
    ['Income tax (estimated)', m(tax), pShare(tax), 'Worked out under this year\'s rules, section 7'],
    ['Take-home pay', m(takeHome), '100%', 'What you actually receive'],
    ['Fixed costs', m(a.fixedExpenses ?? spend), pShare(a.fixedExpenses ?? spend), 'Rent, bills, school fees, subscriptions'],
    ['Day-to-day spending', m(a.variableExpenses ?? 0), pShare(a.variableExpenses ?? 0), 'Food, travel, shopping, fun'],
    ['Loan EMIs', m(emi), pShare(emi), emi / Math.max(1, takeHome) > 0.4 ? 'Above 40%: too high' : 'Under 40% is comfortable'],
    [surplus >= 0 ? 'Left to save' : 'Shortfall', m(Math.abs(surplus)), pShare(Math.abs(surplus)), surplus >= 0 ? 'This can go into savings and investments' : 'Money is being used up each month'],
  ], [2.2, 1.5, 1.4, 3.1], ['left', 'right', 'right', 'left']);
  h3('What this means');
  para(surplus >= 0
    ? `Each month ${name} keeps ${m(surplus)}, which is ${pct(Math.max(0, r.cashflow.savingsRate))} of take-home pay. Keeping 20% or more is the healthy mark, so the saving habit is ${Math.max(0, r.cashflow.savingsRate) >= 0.2 ? 'already strong' : `about ${m(Math.max(0, takeHome * 0.2 - surplus))} a month short of it`}.`
    : `Spending and EMIs add up to ${m(outflow)}, which is more than the ${m(takeHome)} take-home pay. The gap of ${m(-surplus)} a month has to come from savings or new borrowing, so this is the first thing to fix.`);
  h3('What if spending changes?');
  grid(['Change', 'Left to save a month', 'Difference'], [
    ['Today', m(surplus), '-'],
    ['Day-to-day spending cut by 10%', m(surplus + 0.1 * (a.variableExpenses ?? 0)), m(0.1 * (a.variableExpenses ?? 0))],
    ['Day-to-day spending cut by 20%', m(surplus + 0.2 * (a.variableExpenses ?? 0)), m(0.2 * (a.variableExpenses ?? 0))],
    ['Loan EMIs closed (one loan paid off)', m(surplus + emi * 0.5), m(emi * 0.5)],
  ], [3.2, 1.8, 1.5], ['left', 'right', 'right']);
  para('The last row assumes about half of the EMI goes away when one loan is closed. Replace it with the real EMI of that loan when you know it.', 9, MUTED);

  // ================= 4. Savings and safety fund =================
  startSection('Savings and the safety fund');
  para(`A safety fund is money kept in a bank account or fixed deposit for surprises: a job loss, a hospital bill or a repair. The usual target is six months of spending and EMIs. For ${name} that target is ${m(r.emergency.target)}.`);
  grid(['Measure', 'Value', 'Plain meaning'], [
    ['Money in bank and FDs', m(liquid), 'Money that can be used within days'],
    ['Six-month target', m(r.emergency.target), 'Six months of spending plus EMIs'],
    ['Still to save', m(r.emergency.gap), r.emergency.gap > 0 ? 'The gap between today and the target' : 'Target reached'],
    ['Months the bank money lasts', Number.isFinite(bankMonths) ? bankMonths.toFixed(1) : '-', 'If income stopped today'],
    ['Months savings and investments last', Number.isFinite(r.runwayMonths) ? r.runwayMonths.toFixed(1) : '-', 'Counting investments too (they can take time to sell)'],
  ], [2.2, 1.4, 3.6], ['left', 'right', 'left']);
  const months = Number.isFinite(bankMonths) ? Math.min(12, bankMonths) : 0;
  picture(haveNeedPng([{ label: 'Safety fund', have: liquid, need: r.emergency.target }], mShort), maxW, ((10 + 46) / 500) * maxW);
  h3('What to do');
  if (r.emergency.gap > 0 && surplus > 0) {
    const perMonth = surplus * 0.5;
    para(`Keep saving about ${m(perMonth)} a month into a liquid fund or a sweep-in FD until the ${m(r.emergency.gap)} gap is closed. At that pace it takes about ${Math.ceil(r.emergency.gap / perMonth)} months.`);
  } else if (r.emergency.gap > 0) {
    para(`The first step is to create a monthly surplus, because at the moment there is nothing left over to add to the fund. Section 3 shows how.`);
  } else {
    para('The safety fund is complete. Keep it in cash or a fixed deposit, not in shares or funds that can fall sharply.');
  }
  callout('Why a safety fund comes first', 'Investments can fall at the same time as income, so a loss of income plus a market fall is the worst case. A cash cushion lets you avoid selling investments at a low price.', AMBER);

  // ================= 5. Net worth =================
  startSection('What you own and what you owe');
  h3('What you own');
  donut(x.assets, mShort(x.assets.reduce((s, v) => s + v.value, 0)), 'No savings, investments or property entered.');
  h3('What you owe');
  donut(x.liabilities, mShort(d.totalDebt.value), 'No loans. Debt-free.');
  grid(['Balance sheet item', 'Amount', 'Comment'], [
    ['Cash, bank and FDs', m(liquid), 'Safety money'],
    ['Investments (incl. gold)', m(invested), 'Long-term money'],
    ['Property and business stake', m((a.propertyValue ?? 0) + (a.businessValue ?? 0)), 'Listed, but not added to net worth (slow to sell)'],
    ['Loans still to repay', `-${m(d.totalDebt.value)}`, 'What is owed'],
    ['Net worth (financial)', m(d.netWorth.value), d.netWorth.value >= 0 ? 'Positive: you own more than you owe' : 'Negative: you owe more than you own'],
  ], [2.4, 1.5, 3.3], ['left', 'right', 'left']);
  const pf = loadPortfolio();
  const pfs = pf.holdings.length ? summarise(pf, profile.age) : null;
  if (pfs) {
    h3('Portfolio detail');
    grid(['Asset class', 'Share of portfolio'], pfs.byClass.map((c) => [c.cls, pct(c.share)]), [3, 1.5], ['left', 'right']);
    para(`Current value ${m(pfs.assets)}, gain ${m(pfs.gain)}${pfs.xirr != null ? `, yearly return (XIRR, the annual rate that matches your money in and out) ${pct(pfs.xirr)}` : ''}. Past returns do not guarantee future returns.`);
  } else {
    para('No portfolio holdings are recorded in the workspace yet. Adding them (Portfolio page) gives a precise picture of returns and risk.', 10, MUTED);
  }

  // ================= 6. Loans and debt plan =================
  startSection('Loans and a debt plan');
  const emiShare = takeHome > 0 ? emi / takeHome : 0;
  para(`EMIs take ${pct(emiShare)} of take-home pay. Comfortable is below 30 to 40%. An EMI is the fixed amount paid to a lender each month, and it is made of interest plus repayment of the loan.`);
  if (d.loans.length) {
    grid(['Loan', 'EMI', 'Left to repay', 'Interest rate', 'Next due'], d.loans.map((l) => [l.name, m(l.emi), m(l.outstanding), l.rate != null ? `${l.rate}% a year` : 'Not entered', l.nextDue ? new Date(l.nextDue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-']), [2.2, 1.2, 1.4, 1.2, 1.3], ['left', 'right', 'right', 'right', 'right']);
    h3('Order to repay (highest interest first)');
    [...d.loans].sort((p, q) => (q.rate ?? 0) - (p.rate ?? 0)).forEach((l, i) => bullet(`${i + 1}. ${l.name}${l.rate != null ? ` at ${l.rate}% a year` : ''}: paying extra here saves the most interest.`));
  } else {
    para(`No individual loans are recorded. The total EMI of ${m(emi)} a month and the balance of ${m(d.totalDebt.value)} come from the setup answers. Adding each loan on the EMI page gives due dates and a repayment order.`);
  }
  if (a.creditCardDue) callout('Credit card balance', `${m(a.creditCardDue)} unpaid on a credit card is charged at roughly 36 to 42% a year. This is the most expensive debt. Pay it in full before any investing, and pay the full bill every month from now on.`, RED);
  if (a.highestRate) para(`The costliest loan charges ${a.highestRate}% a year. Paying it off early earns the same ${a.highestRate}% as a guaranteed return, which is hard to find elsewhere without risk.`);
  h3('Interest rate risk (illustrative)');
  para(`If interest rates on floating-rate loans rose by 2 percentage points, the extra cost would be about ${m(d.totalDebt.value * 0.02 / 12)} a month (a rough estimate on the outstanding balance). Keep an EMI buffer of at least 10 to 15% of take-home pay for this.`, 10);

  // ================= 7. Income tax =================
  startSection('Income tax, old and new regime');
  para('India has two ways to work out income tax for an individual. The new regime has lower slab rates but fewer deductions. The old regime has higher rates but lets you deduct certain savings and expenses (such as 80C and 80D). The better choice depends on how much you can deduct.');
  grid(['Measure', 'Old regime', 'New regime'], [
    ['Estimated tax this year', m(r.tax.oldRegimeTax), m(r.tax.newRegimeTax)],
    ['Effective tax rate (on income before tax)', pct(d.effectiveTaxRate), r.tax.newRegimeTax > 0 && gross > 0 ? pct(r.tax.newRegimeTax / (gross * 12)) : '-'],
    ['Better for you', r.tax.better === 'old' ? 'Yes' : '-', r.tax.better === 'new' ? 'Yes' : r.tax.better === 'same' ? 'Same cost' : '-'],
  ], [2.6, 1.4, 1.4], ['left', 'right', 'right']);
  callout('Result', r.tax.better === 'same' ? 'Both regimes cost about the same this year.' : `The ${r.tax.better} regime is cheaper by ${m(r.tax.saving)} this year on the numbers entered.`);
  h3('Deductions entered');
  table([
    ['80C (PF, PPF, ELSS, insurance premiums, tuition, up to Rs 1,50,000)', a.section80C !== undefined ? m(a.section80C) : 'Not entered'],
    ['Regime you said you use', a.taxRegime === 'new' ? 'New' : a.taxRegime === 'old' ? 'Old' : 'Not sure'],
    ['Health insurance premium (80D)', 'Not entered'],
  ]);
  if (a.taxRegime && a.taxRegime !== 'unsure' && r.tax.better !== 'same' && a.taxRegime !== r.tax.better) callout('Check before filing', `You said you use the ${a.taxRegime} regime, but the ${r.tax.better} regime is cheaper on these numbers. Confirm with a CA before you file. The choice can usually be made again each year for salaried people.`, RED);
  if (r.tax.warnings.length) r.tax.warnings.slice(0, 4).forEach((w) => bullet(w, MUTED));
  para('Notes: this is an estimate for salaried income under the rules for this financial year, with the deductions entered. Business income, capital gains, surcharge and the exact employer withholding are not fully modelled. A CA should confirm the final figure.', 9.5, MUTED);

  // ================= 8. Insurance =================
  startSection('Insurance and protection');
  para('Insurance does not grow money. It protects the plan. Term life insurance pays your family if you die during the policy term. Health insurance pays hospital bills. Both should be sized from the family\'s needs, not from the price of the policy.');
  grid(['Cover', 'Held', 'Suggested', 'Gap', 'Covered'], [
    ['Emergency fund (cash)', m(liquid), m(r.emergency.target), r.emergency.gap > 0 ? m(r.emergency.gap) : '-', pct(Math.min(1, liquid / Math.max(1, r.emergency.target)))],
    ['Health insurance (family)', m(healthCover), m(r.protection.healthCoverSuggested), r.protection.healthGap > 0 ? m(r.protection.healthGap) : '-', pct(Math.min(1, healthCover / Math.max(1, r.protection.healthCoverSuggested)))],
    ['Life (term) insurance', m(termCover), m(r.protection.termCoverNeeded), r.protection.termGap > 0 ? m(r.protection.termGap) : '-', pct(Math.min(1, termCover / Math.max(1, r.protection.termCoverNeeded)))],
  ], [2.3, 1.3, 1.3, 1.2, 1], ['left', 'right', 'right', 'right', 'right']);
  picture(haveNeedPng(x.protection, mShort), maxW, ((10 + x.protection.length * 46) / 500) * maxW);
  h3('Illustrative hospital bill');
  para(`A hospital stay of Rs 3,00,000 (a planning figure, not a forecast) would leave ${m(Math.max(0, 300000 - healthCover))} to pay from savings with your current health cover of ${m(healthCover)}.`);
  h3('Nominees and the will');
  para(`Nominees: ${a.nominees === 'all' ? 'added on all accounts, which is correct' : a.nominees === 'some' ? 'added on some accounts; add the rest' : 'not added, or not answered'}. Will: ${a.will === 'yes' ? 'written' : a.will === 'no' ? 'not yet written' : 'not answered'}. ${profile.dependants > 0 ? 'Because others depend on you, a simple will and guardian nomination for children are important.' : ''}`);

  // ================= 9. Goals =================
  startSection('Goals');
  if (goals.length) para(`Goals in order of importance: ${goals.map((g, i) => `${i + 1}. ${g}`).join('  ')}.`);
  if (r.goal) {
    grid(['Goal', 'Cost in today\'s money', 'Cost when needed (with 6% price rises)', 'Monthly saving needed'], [[
      a.goal ? (GOAL_OPTIONS.find((o) => o.value === a.goal)?.label ?? 'Top goal') : 'Top goal',
      m(a.goalAmount ?? 0), mShort(r.goal.futureCost), m(r.goal.monthlySip),
    ]], [2.3, 1.5, 2.2, 1.7], ['left', 'right', 'right', 'right']);
    para(`Saving ${m(r.goal.monthlySip)} a month, growing at about ${a.goalYears && a.goalYears <= 3 ? '7' : '10'}% a year, reaches the goal in ${a.goalYears ?? '-'} years. ${surplus >= r.goal.monthlySip ? 'The current surplus covers this.' : `The current surplus of ${m(Math.max(0, surplus))} does not yet cover it, so the goal needs more time, a smaller target or more income.`}`);
  } else {
    para('No single goal with a cost and a date has been entered. Adding one (on the Goals or planner pages) shows the monthly saving it needs.');
  }
  h3('Retirement goal');
  grid(['Retirement measure', 'Value'], [
    ['Stop working at age', `${profile.retireAge ?? 60}`],
    ['Years to retirement', `${r.freedom.yearsToRetire}`],
    ['Money needed at retirement (freedom number)', m(r.freedom.corpusNeeded)],
    ['Your investments grown to that age (at 10% a year)', m(r.freedom.projectedFromInvestments)],
    ['Monthly investment needed to close the gap', m(r.freedom.monthlySipNeeded)],
    ['Financially free by age (investing the full surplus)', r.freedom.freedomAge ? `${r.freedom.freedomAge}` : 'Not on this plan'],
  ], [3.6, 2.2], ['left', 'right']);

  // ================= 10. Where to invest =================
  startSection('Where to invest, by your profile');
  para('The monthly surplus is split by two rules: how soon the money is needed, and how much risk the answers say is acceptable. The funds below are official AMFI schemes that fit each part of the split. They are a starting point to check, not a recommendation to buy.');
  if (plan) {
    para(`${plan.headline}. Monthly to invest: ${m(plan.monthlyToInvest)}.`, 11, INK, true);
    if (plan.fixFirst) callout('First', plan.fixFirst, AMBER);
    grid(['Part of the plan', 'Share', 'Per month', 'Why'], plan.allocation.map((r) => [r.label, `${r.percent}%`, m(r.monthly), r.reason]), [2.3, 0.9, 1.2, 3.6], ['left', 'right', 'right', 'left']);
    if (plan.funds.length) {
      h3('Funds that match this split');
      grid(['Fund', 'House', 'NAV (date)', '1-year', '3-year (yearly)'], plan.funds.map((f) => [f.name, f.house, `Rs ${f.nav.toFixed(2)} (${f.navDate})`, f.oneYear == null ? '-' : pct(f.oneYear), f.threeYear == null ? '-' : pct(f.threeYear)]), [3.4, 1.6, 1.8, 0.9, 1.1], ['left', 'left', 'right', 'right', 'right']);
    }
    if (plan.sectors.length) {
      h3('Sectors to research first');
      plan.sectors.forEach((sec) => bullet(`${sec.name}: ${sec.why}${sec.check.length ? ` Check: ${sec.check.join('; ')}.` : ''}`));
      para('These are starting points for your own research, not stock picks. Ask a SEBI-registered adviser before buying any single company.', 9.5, MUTED);
    }
    h3('Rules to follow');
    plan.notes.forEach((t) => bullet(t));
    para(`Sources: ${plan.sources.join('; ')}. Generated ${new Date(plan.generatedAt).toLocaleDateString('en-IN')}.`, 9, MUTED);
  } else {
    para('Live fund data could not be fetched when this report was made, so the funds are not listed. The split above is set by the rules; download the report again while online to add them.', 10, MUTED);
  }

  // ================= 11. Retirement road =================
  startSection('The road to retirement');
  para('This chart projects the investments forward, assuming the current monthly surplus is invested each month and grows at about 10% a year before retirement. The dashed line is the money needed at retirement, which assumes spending rises with inflation and lasts to age 85.');
  if (x.retirementPath.length > 1) {
    picture(pathPng(x.retirementPath, mShort), maxW, (230 / 500) * maxW);
    grid(['Age', 'Your investments (projected)', 'Money needed', 'Covered'], x.retirementPath.map((p) => [`${p.age}`, m(p.projected), m(p.needed), pct(Math.min(1, p.projected / Math.max(1, p.needed)))]), [1, 2.2, 2.2, 1], ['left', 'right', 'right', 'right']);
  } else {
    para('You are at or past the planned retirement age, so the plan now focuses on making savings last.');
  }
  callout('What raises the chance of reaching the goal', 'Investing a fixed amount every month, starting early, increasing the monthly amount each year as income grows, and keeping costs from rising faster than income. Each 1,000 rupees added to the monthly investment matters more the earlier it starts.');

  // ================= 11. Stress tests =================
  startSection('What if: stress tests');
  para('A stress test asks: if one thing goes wrong, what happens? Each row below changes one input and recalculates the result. These are simple, transparent estimates for planning, not forecasts.');
  const stressRows: string[][] = [
    ['Income stops tomorrow', Number.isFinite(bankMonths) ? `Bank savings last ${bankMonths.toFixed(1)} months` : 'No monthly costs entered', 'Build the safety fund (section 4)'],
    ['Investments fall 30%', `Value falls by ${m(invested * 0.3)} to ${m(invested * 0.7)}`, 'Do not sell in a fall; keep the plan'],
    ['Day-to-day spending rises 10%', `Left to save becomes ${m(surplus - 0.1 * (a.variableExpenses ?? spend))} a month`, 'Track spending; keep a limit on fun spending'],
    ['Take-home falls 20% (pay cut)', `Left to save becomes ${m(surplus - 0.2 * takeHome)} a month`, 'Cut fixed costs first, then build the fund'],
    ['Loan interest rises 2 points', `Extra cost about ${m(d.totalDebt.value * 0.02 / 12)} a month`, 'Prepay the costliest loan'],
    ['Illustrative Rs 3 lakh hospital bill', `Uncovered: ${m(Math.max(0, 300000 - healthCover))}`, 'Raise health cover (section 8)'],
  ];
  grid(['Scenario', 'What happens (calculated)', 'What to do'], stressRows, [2.2, 2.9, 2.5], ['left', 'left', 'left']);
  h3('Reading the results');
  para('A plan that survives the first two rows without debt is resilient. If the bank money lasts less than three months, the first priority is the safety fund, before any extra investing.');

  // ================= 12. Health score and mindset =================
  startSection('Health score and money mindset');
  para(`The ArthaMind health score (${r.health.score} out of 100, status: ${r.health.status}) combines three things: how much of take-home pay is saved, how heavy the EMIs are, and how many months the safety fund covers. Each part is scored against the benchmark in brackets below.`);
  grid(['Part of the score', 'Your figure', 'Benchmark', 'Reading'], [
    ['Savings rate', pct(Math.max(0, r.cashflow.savingsRate)), '20% or more', r.cashflow.savingsRate >= 0.2 ? 'On target' : 'Below target'],
    ['EMI load (EMI / take-home)', pct(emiShare), 'Under 30 to 40%', emiShare <= 0.3 ? 'Comfortable' : emiShare <= 0.4 ? 'Watch' : 'Too high'],
    ['Safety fund (months covered)', Number.isFinite(bankMonths) ? `${bankMonths.toFixed(1)} months` : '-', '6 months', bankMonths >= 6 ? 'Covered' : 'Build it'],
  ], [2.5, 1.5, 1.6, 1.6], ['left', 'right', 'right', 'left']);
  h3('Money mindset (from the scenario answers)');
  if (record) {
    para(`${record.result.riskLabel}.`);
    para(`${record.result.habitLabel}.`);
    para('These two labels come from six short "what would you do?" answers. They are a simple rule-based summary, not a psychological test. They are used to pick ideas and risk levels that fit the person, and they can be changed by answering the questions again.', 9.5, MUTED);
  } else {
    para('The mindset questions were skipped, so no label is shown. They can be answered any time from Edit my answers.');
  }

  // ================= 13. Advisor analysis =================
  startSection('The advisor analysis');
  para('This section is the written advisory produced for this person by ArthaMind\'s advisor. It uses the calculated figures above together with live market, news and web sources gathered on the report date. It is education and a structured view, not personal investment advice.', 10, MUTED);
  if (analysis) {
    h3('Verdict');
    para(analysis.directAnswer, 11, INK, true);
    (analysis.steps ?? []).forEach((s, i) => { h3(`${i + 1}. ${s.title}`, TEAL, 60); para(s.explanation, 10.5); });
    if (analysis.example?.result) { h3('An illustration with your own numbers'); para(analysis.example.title ? `${analysis.example.title}: ${analysis.example.result}` : analysis.example.result); }
    if (analysis.interpretation?.length) { h3('What the numbers mean in everyday terms'); analysis.interpretation.forEach((t) => bullet(t)); }
    if (analysis.risks?.length) { h3('Risks to watch', RED); analysis.risks.forEach((t) => bullet(t, INK)); }
    if (analysis.keyTakeaways?.length) { h3('Recommended actions', GREEN); analysis.keyTakeaways.forEach((t) => bullet(t)); }
    if (analysis.sources?.length) { h3('Sources the advisor used'); grid(['Source', 'Date of data', 'Freshness'], analysis.sources.slice(0, 10).map((s) => [s.name, s.dataDate || '-', s.freshness || '-']), [3.4, 1.4, 1.6], ['left', 'left', 'left']); }
    h3('Strengths of this analysis');
    bullet('It uses the person\'s own numbers, not averages, and every amount in it can be traced to section 3, 4, 5 or 6.');
    bullet('It explains each recommendation in plain words and ranks the actions by urgency.');
    h3('Limits of this analysis', AMBER);
    bullet('It can only use what the person entered. Wrong or rounded answers produce a less precise result.');
    bullet('It does not know future markets, tax changes after the report date or the person\'s private circumstances (for example, pending family support or a planned job change).');
    bullet('Written text is produced by computer language models. Each number was checked against the calculated figures, but read the analysis as guidance and confirm big decisions with a SEBI-registered adviser or a CA.');
  } else {
    callout('Advisor analysis not available', 'The written advisor analysis could not be fetched when this report was made, because the live advisory service did not respond. Every calculated section of this report is complete. Open the dashboard while online and download the report again to include the written analysis.', AMBER);
  }

  // ================= 14. Action plan =================
  startSection('Your action plan');
  const path = buildPath({ ...a, monthlyIncome: a.monthlyIncome ?? profile.annualSalary / 12, monthlyEmi: a.monthlyEmi ?? profile.monthlyEmi, liquidSavings: a.liquidSavings ?? profile.liquidSavings, dependants: a.dependants ?? profile.dependants, healthCover: a.healthCover ?? profile.healthCover, termCover: a.termCover ?? profile.termCover, ...(totalSpend(a) === undefined ? { monthlyExpenses: profile.monthlyExpenses } : {}) }, m);
  para('The steps are ordered the way a careful adviser would order them: stop any monthly gap, clear costly debt, build the safety fund, protect the family, then grow money for goals. Tick each one off as you finish it.');
  const groups: Array<[string, RGB, string, typeof path.steps]> = [
    ['Next 30 days', RED, 'Urgent: these protect you this month', path.steps.filter((s) => s.tone === 'urgent')],
    ['Next 60 to 90 days', TEAL, 'Important: build on the urgent steps', path.steps.filter((s) => s.tone === 'next')],
    ['Ongoing and beyond', GREEN, 'Keep these going', path.steps.filter((s) => s.tone === 'good')],
  ];
  groups.forEach(([label, col, sub, list]) => {
    if (!list.length) return;
    h3(label, col, 60);
    para(sub, 9.5, MUTED);
    list.forEach((s, i) => { h3(`${i + 1}. ${s.title}`, INK, 40); para(s.text, 10.5, INK, false, 6); });
  });
  h3('Checklist');
  grid(['Done', 'Action', 'Target'], path.steps.map((s) => ['[   ]', s.title, s.tone === 'urgent' ? '30 days' : s.tone === 'next' ? '60-90 days' : 'Ongoing']), [0.8, 4.4, 1.4], ['left', 'left', 'left']);

  // ================= 15. Markets, method, sources, glossary =================
  startSection('Markets on the report date');
  if (markets.length) {
    grid(['Index or asset', 'Level', 'Change on the day'], markets.map((q) => [q.label, q.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }), q.ch != null ? `${q.ch >= 0 ? '+' : ''}${q.ch.toFixed(2)}%` : '-']), [2.6, 1.6, 1.6], ['left', 'right', 'right']);
    para('Delayed quotes from market data providers. Markets rise and fall; past moves do not predict the future. These figures are shown for context only and are not used in the calculations above.', 9.5, MUTED);
  } else {
    para('Live market quotes were not available when this report was made.', 10, MUTED);
  }

  startSection('Method, assumptions and limitations');
  para('How the figures are worked out, in plain words. No step uses a black box: each conclusion comes from one of these rules.');
  grid(['Assumption', 'Value used', 'Why this value'], [
    ['Price rises (inflation)', `${Math.round(MONEY_CHECK_ASSUMPTIONS.inflation * 100)}% a year`, 'Long-run planning figure; costs in the future are higher'],
    ['Investment growth before retirement', `${Math.round(MONEY_CHECK_ASSUMPTIONS.preRetirementReturn * 100)}% a year`, 'Planning figure for long-term equity-style investments; not guaranteed'],
    ['Investment growth after retirement', `${Math.round(MONEY_CHECK_ASSUMPTIONS.postRetirementReturn * 100)}% a year`, 'Lower, because money is used and risk is reduced'],
    ['Life expectancy used', `${MONEY_CHECK_ASSUMPTIONS.lifeExpectancy} years`, 'Plans money to last to this age'],
    ['Safety fund target', `${MONEY_CHECK_ASSUMPTIONS.emergencyMonths} months of spending and EMIs`, 'The common planning guideline'],
    ['Term cover needed', 'Expenses replaced to retirement, plus loans, minus savings', 'What the family would need, net of what already exists'],
    ['Health cover suggested', 'Rs 10 to 20 lakh by family size', 'Typical cover for hospital costs in Indian cities'],
    ['Income tax', 'Slabs and rebates for this financial year', 'As published; check the current year before filing'],
  ], [2.4, 2.2, 2.6], ['left', 'left', 'left']);
  h3('Limitations');
  x.limitations.forEach((t) => bullet(t));
  h3('Stress test method');
  para('Each stress test changes one input and keeps everything else the same. Percentages are applied to the current figure. Interest effects use the outstanding balance and a simple monthly estimate, so they are approximate.');

  startSection('Sources');
  para('Every figure in this report comes from one of the sources below. Figures from the person\'s own answers are shown as given.');
  grid(['Source', 'What it is used for'], x.sources.map((s) => [s.name, s.use]), [3.4, 2.4], ['left', 'left']);
  para('Income tax rules: as published for the financial year covered. Market and news data: as of the report date, from the providers shown on the Markets page. AI-written text: produced by computer language models and checked against the calculated numbers above.', 9.5, MUTED);

  startSection('Glossary');
  x.glossary.forEach((g) => { ensure(32); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(clean(g.term), X, y); y += 14; para(g.meaning, 10, MUTED); });

  // ================= Sign-off =================
  startSection('Sign-off and important notice');
  if (avatar) { ensure(130); doc.addImage(avatar, 'PNG', X, y, 110, 110); y += 122; }
  para(`This report was prepared for ${name} on ${today}, report ID ${reportId}. It is based only on the answers given and the workspace records at the time.`);
  callout('Important notice', 'Investments are subject to market risks. Read all related documents carefully. ArthaMind provides financial information and planning tools for learning and planning. It is not a SEBI-registered investment adviser and this report is not personal investment, tax or legal advice. Confirm important decisions with a SEBI-registered adviser, a qualified CA or your bank.', AMBER);
  para('To check this report: each figure can be recalculated from the inputs in sections 2 to 6. If an input is wrong, correct it on the Edit my answers page and download the report again; the new report replaces this one.', 10, MUTED);

  // ================= Contents page (page 2) =================
  doc.setPage(contentsPage);
  pageHeader();
  y = 110;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...INK); doc.text('Contents', X, y); y += 26;
  sections.forEach((sec) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(clean(sec.title), X, y, { maxWidth: maxW - 60 });
    doc.setTextColor(...MUTED); doc.text(`${sec.page}`, X + maxW, y, { align: 'right' });
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4); doc.setLineDashPattern([1, 2], 0); doc.line(X + 260, y + 2, X + maxW - 24, y + 2); doc.setLineDashPattern([], 0);
    y += 22;
  });

  // ---- footer on every page ----
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
