/**
 * Reads amounts out of financial documents on the user's device. Nothing is uploaded.
 *
 * - Text PDFs (payslips, Form 16, statements) are read with pdf.js, loaded only when needed.
 * - CSV bank statements are summarised into average monthly income, spending and likely EMIs.
 * - Pasted text uses the same payslip / Form 16 patterns.
 *
 * Every suggestion carries the line it came from so the user can confirm it before it is used.
 */
import type { MoneyCheckInputs } from './moneyCheck';

export type ScanField = 'annualSalary' | 'monthlyExpenses' | 'monthlyEmi' | 'section80C' | 'section80D';
export interface ScanSuggestion { field: ScanField; value: number; label: string; evidence: string }
export interface ScanResult { kind: 'payslip' | 'form16' | 'statement' | 'unknown'; suggestions: ScanSuggestion[]; notes: string[] }

const AMOUNT = String.raw`(?:rs\.?|inr|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)`;
const toNumber = (raw: string) => Number(raw.replace(/,/g, ''));

/** First amount that follows one of the labels on the same line. */
function findAmount(lines: string[], labels: RegExp): { value: number; line: string } | null {
  for (const line of lines) {
    const label = line.match(labels);
    if (!label || label.index === undefined) continue;
    // Read only what follows the label, so digits inside it (the 80 in "80C") are never taken as the amount.
    const after = line.slice(label.index + label[0].length);
    const match = after.match(new RegExp(AMOUNT, 'i'));
    if (match) {
      const value = toNumber(match[1]);
      if (Number.isFinite(value) && value > 0) return { value, line: line.trim().slice(0, 140) };
    }
  }
  return null;
}

/** Payslip / Form 16 / free text. */
export function scanText(text: string): ScanResult {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const isForm16 = /form\s*no\.?\s*16|form\s*16|part\s*b/.test(lower) && /(gross salary|section 17)/.test(lower);
  const isPayslip = !isForm16 && /(pay\s*slip|salary slip|earnings|net pay|take home)/.test(lower);
  const suggestions: ScanSuggestion[] = [];
  const notes: string[] = [];

  if (isForm16) {
    const gross = findAmount(lines, /gross salary|total amount of salary received|salary as per provisions contained in section 17\(1\)/i);
    if (gross) suggestions.push({ field: 'annualSalary', value: gross.value, label: 'Annual gross salary', evidence: gross.line });
    const c80 = findAmount(lines, /80\s*c(?!cd)|section 80c\b/i);
    if (c80) suggestions.push({ field: 'section80C', value: Math.min(c80.value, 150_000), label: '80C deductions', evidence: c80.line });
    const d80 = findAmount(lines, /80\s*d\b|section 80d\b/i);
    if (d80) suggestions.push({ field: 'section80D', value: Math.min(d80.value, 100_000), label: '80D health premium', evidence: d80.line });
  } else {
    const gross = findAmount(lines, /gross (earnings|salary|pay)|total earnings|gross total/i);
    if (gross) {
      // A payslip is monthly; a figure above ₹20,00,000 is almost certainly already annual.
      const annual = gross.value > 2_000_000 ? gross.value : gross.value * 12;
      suggestions.push({ field: 'annualSalary', value: annual, label: gross.value > 2_000_000 ? 'Annual gross salary' : 'Annual salary (monthly gross × 12)', evidence: gross.line });
    }
    const loan = findAmount(lines, /loan (recovery|emi|deduction)|emi\b/i);
    if (loan) suggestions.push({ field: 'monthlyEmi', value: loan.value, label: 'EMI deducted from salary', evidence: loan.line });
  }
  if (!suggestions.length) notes.push('No salary figures were found. If this is a scanned image or photo, type the amounts in instead.');
  return { kind: isForm16 ? 'form16' : isPayslip ? 'payslip' : 'unknown', suggestions, notes };
}

interface Txn { date: Date | null; description: string; debit: number; credit: number }

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i += 1; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((cell) => cell.trim());
}

function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) { const y = Number(m[3].length === 2 ? `20${m[3]}` : m[3]); return new Date(y, Number(m[2]) - 1, Number(m[1])); }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const TRANSFER = /self|own a\/?c|transfer to (my|self)|sweep|fd (booked|creation)|mutual fund|sip|zerodha|groww|upstox|ppf|nps/i;
const EMI = /\bemi\b|loan|nach|ecs|ach d|mandate/i;
const SALARY = /salary|sal cr|payroll|neft.*(pvt|ltd|limited|technologies|services)/i;

/** Bank statement CSV → average monthly salary credit, spending and recurring EMIs. */
export function scanStatementCsv(csv: string): ScanResult {
  const rows = csv.split(/\r?\n/).filter((line) => line.trim());
  const headerIndex = rows.findIndex((line) => /date/i.test(line) && /(debit|withdrawal|amount)/i.test(line));
  if (headerIndex < 0) return { kind: 'unknown', suggestions: [], notes: ['Could not find Date and Debit/Credit columns in this CSV.'] };
  const header = splitCsvLine(rows[headerIndex]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = col(/date/), iDesc = col(/narration|description|particulars|details|remarks/);
  const iDebit = col(/debit|withdrawal|dr\b/), iCredit = col(/credit|deposit|cr\b/), iAmount = col(/^amount/), iType = col(/type|dr\/cr/);

  const txns: Txn[] = [];
  for (const line of rows.slice(headerIndex + 1)) {
    const cells = splitCsvLine(line);
    const num = (i: number) => (i >= 0 && cells[i] ? Math.abs(toNumber(cells[i].replace(/[^0-9.,-]/g, ''))) || 0 : 0);
    let debit = num(iDebit), credit = num(iCredit);
    if (iDebit < 0 && iAmount >= 0) {
      const amount = toNumber((cells[iAmount] || '').replace(/[^0-9.,-]/g, ''));
      const isDebit = iType >= 0 ? /dr|debit/i.test(cells[iType] || '') : amount < 0;
      if (isDebit) debit = Math.abs(amount); else credit = Math.abs(amount);
    }
    if (!debit && !credit) continue;
    txns.push({ date: iDate >= 0 ? parseDate(cells[iDate] || '') : null, description: iDesc >= 0 ? cells[iDesc] || '' : '', debit, credit });
  }
  if (!txns.length) return { kind: 'statement', suggestions: [], notes: ['No transactions were found in this CSV.'] };

  const months = new Set(txns.map((t) => (t.date ? `${t.date.getFullYear()}-${t.date.getMonth()}` : 'x')));
  const monthCount = Math.max(1, months.size - (months.has('x') ? 1 : 0) || 1);
  const salaryCredits = txns.filter((t) => t.credit > 0 && SALARY.test(t.description));
  const emiDebits = txns.filter((t) => t.debit > 0 && EMI.test(t.description));
  const spend = txns.filter((t) => t.debit > 0 && !EMI.test(t.description) && !TRANSFER.test(t.description));

  const suggestions: ScanSuggestion[] = [];
  const notes: string[] = [`Read ${txns.length} transactions across ${monthCount} month${monthCount === 1 ? '' : 's'}.`];
  const spendTotal = spend.reduce((s, t) => s + t.debit, 0);
  if (spendTotal > 0) suggestions.push({ field: 'monthlyExpenses', value: Math.round(spendTotal / monthCount), label: 'Average monthly spending', evidence: `${spend.length} debits, excluding EMIs, investments and self-transfers` });
  const emiTotal = emiDebits.reduce((s, t) => s + t.debit, 0);
  if (emiTotal > 0) suggestions.push({ field: 'monthlyEmi', value: Math.round(emiTotal / monthCount), label: 'Average monthly EMIs', evidence: `${emiDebits.length} loan / NACH debits` });
  const salaryTotal = salaryCredits.reduce((s, t) => s + t.credit, 0);
  if (salaryTotal > 0) {
    notes.push(`Salary credits average ${Math.round(salaryTotal / monthCount).toLocaleString('en-IN')} a month. That is take-home pay; enter your gross salary from a payslip or Form 16 for tax.`);
  }
  return { kind: 'statement', suggestions, notes };
}

/** Extracts text from a text-based PDF using pdf.js, loaded on demand. */
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, 20); p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Rebuild lines from text items using their vertical position.
    const rows = new Map<number, Array<{ x: number; s: string }>>();
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      const row = rows.get(y) ?? [];
      row.push({ x: item.transform[4], s: item.str });
      rows.set(y, row);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, row]) => pages.push(row.sort((a, b) => a.x - b.x).map((r) => r.s).join(' ')));
  }
  return pages.join('\n');
}

/** Scans any supported file. */
export async function scanFile(file: File): Promise<ScanResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return scanStatementCsv(await file.text());
  if (name.endsWith('.txt')) return scanText(await file.text());
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const text = await pdfToText(file);
    if (!text.trim()) return { kind: 'unknown', suggestions: [], notes: ['This PDF has no readable text (it may be a scanned image). Please type the amounts in.'] };
    return scanText(text);
  }
  return { kind: 'unknown', suggestions: [], notes: ['Upload a PDF payslip or Form 16, or a CSV bank statement.'] };
}

export function applySuggestions(current: Partial<MoneyCheckInputs>, suggestions: ScanSuggestion[]): Partial<MoneyCheckInputs> {
  const next = { ...current };
  for (const s of suggestions) next[s.field] = s.value;
  return next;
}
