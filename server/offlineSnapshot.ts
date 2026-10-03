/**
 * When the AI models are unavailable, work out what we can from the numbers in the question itself,
 * with plain arithmetic only: monthly income, spending, EMI, surplus, savings rate and EMI load.
 * Nothing is guessed; if a figure is not in the question it is not used.
 */
const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;

/** Reads "12,00,000", "85000", "85k", "1.2 lakh", "1 cr" (with or without ₹). */
export function readAmount(raw: string): number | null {
  const m = raw.replace(/[₹,\s]/g, '').toLowerCase().match(/^(\d+(?:\.\d+)?)(k|l|lakh|lakhs|lac|cr|crore|crores)?$/);
  if (!m) return null;
  const unit = m[2];
  return Number(m[1]) * (unit === 'k' ? 1e3 : unit?.startsWith('l') ? 1e5 : unit?.startsWith('c') ? 1e7 : 1);
}

const AMOUNT = String.raw`₹?\s?(\d[\d,]*(?:\.\d+)?\s?(?:k|lakhs?|lac|l|crores?|cr)?)\b`;
function find(prompt: string, words: string): { value: number; yearly: boolean } | null {
  // "<word> ... <amount> ... a year|month" or "<amount> ... <word>"
  const after = new RegExp(`(?:${words})[^.\\d₹]{0,25}${AMOUNT}([^.]{0,18})`, 'i').exec(prompt);
  const before = new RegExp(`${AMOUNT}([^.\\d]{0,18})(?:${words})`, 'i').exec(prompt);
  const m = after || before;
  if (!m) return null;
  const value = readAmount(m[1]);
  if (value === null || value <= 0) return null;
  const tail = `${m[2] || ''} ${m[0]}`.toLowerCase();
  return { value, yearly: /\b(a|per|every|each)\s+(year|annum)|yearly|annual|p\.?a\.?|\/\s?yr|ctc|lpa|सालाना|साल/.test(tail) };
}

export interface OfflineSnapshot { lines: string[]; takeaways: string[] }

export function offlineSnapshot(prompt: string): OfflineSnapshot | null {
  const income = find(prompt, 'earn|earning|salary|income|ctc|take[- ]home|make|सैलरी|वेतन|तनख्वाह|कमाई|आय|पगार');
  const spend = find(prompt, 'spend|spending|expenses?|expenditure|खर्च|खर्चा');
  const emi = find(prompt, 'emis?|loan repayment|ईएमआई|किस्त');
  if (!income) return null;
  const monthlyIncome = income.yearly ? income.value / 12 : income.value;
  const monthlySpend = spend ? (spend.yearly ? spend.value / 12 : spend.value) : null;
  const monthlyEmi = emi ? (emi.yearly ? emi.value / 12 : emi.value) : 0;
  const lines = [`Monthly income: ${inr(monthlyIncome)}${income.yearly ? ` (${inr(income.value)} a year ÷ 12, before tax)` : ''}.`];
  const takeaways: string[] = [];
  if (monthlyEmi) {
    const load = monthlyEmi / monthlyIncome;
    lines.push(`EMI load: ${inr(monthlyEmi)} is ${(load * 100).toFixed(1)}% of monthly income (a common comfort limit is 40% of take-home).`);
    if (load > 0.4) takeaways.push('Bring EMIs under 40% of take-home before taking any new loan; prepay the costliest loan first.');
  }
  if (monthlySpend !== null) {
    const surplus = monthlyIncome - monthlySpend - monthlyEmi;
    const rate = surplus / monthlyIncome;
    lines.push(`Monthly surplus: ${inr(monthlyIncome)} − ${inr(monthlySpend)} spending${monthlyEmi ? ` − ${inr(monthlyEmi)} EMI` : ''} = ${inr(surplus)} (savings rate ${(rate * 100).toFixed(1)}%, before tax).`);
    const buffer = (monthlySpend + monthlyEmi) * 6;
    lines.push(`Emergency fund target: 6 × ${inr(monthlySpend + monthlyEmi)} monthly outgo = ${inr(buffer)}.`);
    if (surplus > 0) {
      takeaways.push(`Build the emergency fund of ${inr(buffer)} first, in a savings account, FD or liquid fund.`);
      takeaways.push('Get term life cover if anyone depends on you, and health cover for the family.');
      takeaways.push(`Then automate a monthly SIP from the surplus of ${inr(surplus)}, after setting aside tax.`);
    } else {
      takeaways.push('Spending and EMIs exceed income: list every expense and cut until the surplus is positive.');
    }
  }
  return { lines, takeaways };
}
