/**
 * ArthaMind formula book: the reference knowledge the AI Tutor retrieves before answering.
 *
 * Every worked example is computed by the functions in FORMULAS (not typed in by hand), and
 * tests/financeKnowledge.test.ts checks those functions against textbook values, the app's own
 * calculators and the tax engine. Indian tax rules are for FY 2025-26 (AY 2026-27) as enacted by
 * the Finance Act 2025; scheme rates change quarterly and are marked as such.
 */

const inr = (v: number, d = 0) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;

export const FORMULAS = {
  simpleInterest: (p: number, r: number, t: number) => p * r * t,
  compound: (p: number, r: number, n: number, t: number) => p * (1 + r / n) ** (n * t),
  effectiveAnnualRate: (r: number, n: number) => (1 + r / n) ** n - 1,
  cagr: (start: number, end: number, years: number) => (end / start) ** (1 / years) - 1,
  ruleOf72: (ratePct: number) => 72 / ratePct,
  doublingYearsExact: (r: number) => Math.log(2) / Math.log(1 + r),
  realReturn: (nominal: number, inflation: number) => (1 + nominal) / (1 + inflation) - 1,
  futureCost: (today: number, inflation: number, years: number) => today * (1 + inflation) ** years,
  presentValue: (fv: number, r: number, years: number) => fv / (1 + r) ** years,
  /** SIP paid at the start of each month (annuity due), monthly compounding at annual/12. */
  sipFutureValue: (monthly: number, annual: number, months: number) => { const i = annual / 12; return monthly * (((1 + i) ** months - 1) / i) * (1 + i); },
  sipForTarget: (target: number, annual: number, months: number) => { const i = annual / 12; return target / ((((1 + i) ** months - 1) / i) * (1 + i)); },
  emi: (p: number, annual: number, months: number) => { const i = annual / 12; return (p * i * (1 + i) ** months) / ((1 + i) ** months - 1); },
  npv: (rate: number, flows: number[]) => flows.reduce((s, cf, t) => s + cf / (1 + rate) ** t, 0),
  /** IRR by bisection; flows[0] is the initial outflow (negative). */
  irr: (flows: number[]) => { let lo = -0.99, hi = 10; for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; const v = flows.reduce((s, cf, t) => s + cf / (1 + mid) ** t, 0); if (v > 0) lo = mid; else hi = mid; } return (lo + hi) / 2; },
  annuityPv: (pmt: number, r: number, n: number) => (pmt * (1 - (1 + r) ** -n)) / r,
  gordon: (d1: number, r: number, g: number) => d1 / (r - g),
  bondPrice: (face: number, couponRate: number, yieldRate: number, years: number) => { let p = 0; for (let t = 1; t <= years; t++) p += (face * couponRate) / (1 + yieldRate) ** t; return p + face / (1 + yieldRate) ** years; },
  currentYield: (annualCoupon: number, price: number) => annualCoupon / price,
  capm: (rf: number, beta: number, rm: number) => rf + beta * (rm - rf),
  sharpe: (rp: number, rf: number, sd: number) => (rp - rf) / sd,
  keynesMultiplier: (mpc: number) => 1 / (1 - mpc),
  breakEvenUnits: (fixed: number, price: number, variable: number) => fixed / (price - variable),
  /** Income-tax slabs: [upper limit, rate] pairs; returns tax before rebate and cess. */
  slabTax: (taxable: number, slabs: Array<[number, number]>) => { let prev = 0, tax = 0; for (const [lim, r] of slabs) { if (taxable > prev) tax += (Math.min(taxable, lim) - prev) * r; prev = lim; } return tax; },
  hraExemption: (hra: number, rent: number, basicDa: number, metro: boolean) => Math.max(0, Math.min(hra, rent - 0.1 * basicDa, (metro ? 0.5 : 0.4) * basicDa)),
} as const;

/** FY 2025-26 slabs (Finance Act 2025). */
export const NEW_REGIME_SLABS: Array<[number, number]> = [[400_000, 0], [800_000, 0.05], [1_200_000, 0.1], [1_600_000, 0.15], [2_000_000, 0.2], [2_400_000, 0.25], [Infinity, 0.3]];
export const OLD_REGIME_SLABS: Array<[number, number]> = [[250_000, 0], [500_000, 0.05], [1_000_000, 0.2], [Infinity, 0.3]];

export interface KnowledgeEntry {
  id: string;
  chapter: string;
  title: string;
  summary: string;
  formula?: string;
  variables?: Array<[string, string]>;
  example?: { inputs: string; working?: string; result: string; value: number };
  notes?: string[];
  keywords: string[];
  reference: string;
}

const F = FORMULAS;
const newTax15L = F.slabTax(1_500_000 - 75_000, NEW_REGIME_SLABS);
const oldTax15L = F.slabTax(1_500_000 - 50_000 - 150_000 - 25_000, OLD_REGIME_SLABS);

export const KNOWLEDGE: KnowledgeEntry[] = [
  // ---------------- Interest & growth ----------------
  { id: 'simple-interest', chapter: 'Interest & growth', title: 'Simple interest', summary: 'Interest is earned only on the original principal, so it grows in a straight line.',
    formula: 'SI = P × r × t', variables: [['P', 'principal'], ['r', 'annual rate (decimal)'], ['t', 'years']],
    example: { inputs: '₹1,00,000 at 8% for 3 years', result: `${inr(F.simpleInterest(100_000, 0.08, 3))} interest; maturity ₹1,24,000`, value: F.simpleInterest(100_000, 0.08, 3) },
    keywords: ['simple interest', 'si', 'flat interest'], reference: 'Standard time-value-of-money definition (NCERT Class 8 Mathematics, Comparing Quantities).' },
  { id: 'compound-interest', chapter: 'Interest & growth', title: 'Compound interest', summary: 'Interest is added to the principal each period, so later interest is earned on earlier interest.',
    formula: 'A = P × (1 + r/n)^(n × t);  CI = A − P', variables: [['A', 'maturity amount'], ['P', 'principal'], ['r', 'annual rate'], ['n', 'compounding periods per year (4 = quarterly)'], ['t', 'years']],
    example: { inputs: '₹1,00,000 at 8% compounded quarterly for 5 years', result: `${inr(F.compound(100_000, 0.08, 4, 5))} (interest ${inr(F.compound(100_000, 0.08, 4, 5) - 100_000)})`, value: F.compound(100_000, 0.08, 4, 5) },
    notes: ['Bank FDs in India usually compound quarterly.', 'More frequent compounding gives a slightly higher amount for the same stated rate.'],
    keywords: ['compound interest', 'compounding', 'ci', 'fd maturity', 'fixed deposit'], reference: 'Standard TVM formula; RBI and bank FD calculators use quarterly compounding.' },
  { id: 'effective-rate', chapter: 'Interest & growth', title: 'Effective annual rate (EAR)', summary: 'The true yearly rate once compounding is included; use it to compare products quoted with different compounding.',
    formula: 'EAR = (1 + r/n)^n − 1',
    example: { inputs: '12% a year compounded monthly', result: pct(F.effectiveAnnualRate(0.12, 12)), value: F.effectiveAnnualRate(0.12, 12) },
    keywords: ['effective annual rate', 'ear', 'apy', 'annualised yield', 'nominal vs effective'], reference: 'Standard finance definition.' },
  { id: 'cagr', chapter: 'Interest & growth', title: 'CAGR (compound annual growth rate)', summary: 'The steady yearly rate that takes a starting value to an ending value, ignoring the ups and downs in between.',
    formula: 'CAGR = (End ÷ Start)^(1/years) − 1',
    example: { inputs: '₹1,00,000 grows to ₹2,00,000 in 6 years', result: pct(F.cagr(1, 2, 6)), value: F.cagr(1, 2, 6) },
    notes: ['CAGR suits a single lump sum. For SIPs or irregular cash flows use XIRR.'],
    keywords: ['cagr', 'compound annual growth rate', 'annualised return', 'growth rate'], reference: 'Standard definition used by AMFI and fund factsheets for point-to-point returns.' },
  { id: 'rule-of-72', chapter: 'Interest & growth', title: 'Rule of 72', summary: 'A quick estimate of how many years money takes to double.',
    formula: 'Years to double ≈ 72 ÷ rate (%);  exact = ln 2 ÷ ln(1 + r)',
    example: { inputs: '8% a year', result: `${F.ruleOf72(8)} years by the rule; ${F.doublingYearsExact(0.08).toFixed(2)} years exactly`, value: F.ruleOf72(8) },
    keywords: ['rule of 72', 'double money', 'doubling time'], reference: 'Standard approximation; accurate for rates of roughly 6–10%.' },
  { id: 'real-return', chapter: 'Interest & growth', title: 'Real return (after inflation)', summary: 'What your money actually gains in buying power once inflation is removed.',
    formula: 'Real return = (1 + nominal) ÷ (1 + inflation) − 1   (Fisher equation)',
    example: { inputs: '10% nominal return, 6% inflation', result: `${pct(F.realReturn(0.1, 0.06))} (not simply 4%)`, value: F.realReturn(0.1, 0.06) },
    keywords: ['real return', 'inflation adjusted return', 'fisher', 'purchasing power'], reference: 'Fisher equation (Irving Fisher, The Theory of Interest, 1930).' },
  { id: 'future-cost', chapter: 'Interest & growth', title: 'Future cost of a goal (inflation)', summary: 'Today’s price grown by inflation to the year you need it.',
    formula: 'Future cost = Cost today × (1 + inflation)^years',
    example: { inputs: '₹10,00,000 goal, 6% inflation, 10 years', result: inr(F.futureCost(1_000_000, 0.06, 10)), value: F.futureCost(1_000_000, 0.06, 10) },
    keywords: ['inflation', 'future value of goal', 'goal planning', 'cost in future'], reference: 'Standard compounding applied to prices.' },
  { id: 'present-value', chapter: 'Interest & growth', title: 'Present value', summary: 'What a future amount is worth today at a given rate.',
    formula: 'PV = FV ÷ (1 + r)^t',
    example: { inputs: '₹10,00,000 received in 10 years, 8% rate', result: inr(F.presentValue(1_000_000, 0.08, 10)), value: F.presentValue(1_000_000, 0.08, 10) },
    keywords: ['present value', 'pv', 'discounting', 'time value of money'], reference: 'Standard TVM formula.' },
  { id: 'annuity-pv', chapter: 'Interest & growth', title: 'Present value of an annuity', summary: 'Today’s value of a fixed payment received every period.',
    formula: 'PV = PMT × [1 − (1 + r)^−n] ÷ r',
    example: { inputs: '₹10,000 a year for 10 years at 8%', result: inr(F.annuityPv(10_000, 0.08, 10)), value: F.annuityPv(10_000, 0.08, 10) },
    keywords: ['annuity', 'present value of annuity', 'pension value'], reference: 'Standard TVM formula.' },

  // ---------------- Investing ----------------
  { id: 'sip-fv', chapter: 'Investing', title: 'SIP future value', summary: 'What a fixed monthly investment grows to, assuming a steady return.',
    formula: 'FV = P × [((1 + i)^n − 1) ÷ i] × (1 + i),  i = annual rate ÷ 12, n = months', variables: [['P', 'monthly SIP'], ['i', 'monthly rate'], ['n', 'number of instalments']],
    example: { inputs: '₹10,000 a month for 10 years at 12%', result: inr(F.sipFutureValue(10_000, 0.12, 120)), value: F.sipFutureValue(10_000, 0.12, 120) },
    notes: ['Assumes each instalment is invested at the start of the month (the convention most AMC calculators use).', 'Real returns vary; equity funds do not grow at a fixed rate.'],
    keywords: ['sip', 'systematic investment plan', 'sip calculator', 'monthly investment'], reference: 'Future value of an annuity due; matches AMFI-style SIP calculators.' },
  { id: 'sip-target', chapter: 'Investing', title: 'SIP needed for a target', summary: 'The monthly amount required to reach a goal by a date.',
    formula: 'P = Target ÷ ([((1 + i)^n − 1) ÷ i] × (1 + i))',
    example: { inputs: '₹1,00,00,000 in 15 years at 12%', result: `${inr(F.sipForTarget(10_000_000, 0.12, 180))} a month`, value: F.sipForTarget(10_000_000, 0.12, 180) },
    keywords: ['sip needed', 'goal sip', 'how much to invest monthly', 'target corpus'], reference: 'Rearranged SIP future-value formula.' },
  { id: 'xirr', chapter: 'Investing', title: 'XIRR', summary: 'The annual return for cash flows on different dates (SIPs, top-ups, withdrawals). It is the rate that makes the present value of all flows zero, using exact dates.',
    formula: 'Find r such that Σ CFₖ ÷ (1 + r)^((dₖ − d₀)/365) = 0',
    notes: ['Solved numerically (spreadsheets: =XIRR(values, dates)).', 'Use XIRR, not CAGR, to judge a SIP.'],
    keywords: ['xirr', 'irr for sip', 'money weighted return'], reference: 'Standard money-weighted return; AMFI and SEBI require XIRR-style returns for SIP illustrations.' },
  { id: 'asset-allocation', chapter: 'Investing', title: 'Asset allocation by goal horizon', summary: 'Money needed soon belongs in stable assets; money for 5+ years can take equity risk.',
    notes: ['Under 1 year: liquid funds, FDs, savings.', '1–3 years: mostly debt (short-duration funds, FDs).', '3–5 years: a mix, for example 40% equity and 60% debt.', '5+ years: equity-heavy, for example 60–75% equity, with some debt and gold.', 'Rebalance once a year back to your target mix.'],
    keywords: ['asset allocation', 'equity debt gold mix', 'where to invest', 'portfolio mix', 'rebalancing'], reference: 'SEBI investor education material on risk and time horizon; widely used planning practice.' },
  { id: 'capital-gains', chapter: 'Tax (India)', title: 'Capital gains tax on equity and mutual funds', summary: 'Tax on profit when you sell investments, from 23 July 2024.',
    notes: ['Listed equity and equity mutual funds: short-term (held 12 months or less) taxed at 20%.', 'Long-term (held more than 12 months) taxed at 12.5% on gains above ₹1,25,000 a year.', 'Debt mutual funds bought on or after 1 April 2023: gains added to income and taxed at your slab rate.', 'Add 4% health and education cess (and surcharge where it applies).'],
    example: { inputs: '₹3,00,000 long-term equity gain in a year', result: `${inr(((300_000 - 125_000) * 0.125))} before cess (12.5% of ₹1,75,000)`, value: (300_000 - 125_000) * 0.125 },
    keywords: ['capital gains', 'ltcg', 'stcg', 'tax on mutual funds', 'tax on shares', 'equity tax'], reference: 'Income-tax Act sections 111A and 112A as amended by the Finance (No. 2) Act 2024.' },

  // ---------------- Loans ----------------
  { id: 'emi', chapter: 'Loans', title: 'EMI (equated monthly instalment)', summary: 'The fixed monthly payment that repays a loan with interest over its tenure.',
    formula: 'EMI = P × i × (1 + i)^n ÷ [(1 + i)^n − 1],  i = annual rate ÷ 12, n = months',
    example: { inputs: '₹10,00,000 at 9% for 20 years', result: `${inr(F.emi(1_000_000, 0.09, 240))} a month; total interest ${inr(F.emi(1_000_000, 0.09, 240) * 240 - 1_000_000)}`, value: F.emi(1_000_000, 0.09, 240) },
    notes: ['In month 1 of this loan, interest is ₹7,500 (₹10,00,000 × 0.75%) and only about ₹1,497 repays principal; the split shifts towards principal over time.', 'Keep total EMIs under 30–40% of take-home pay.'],
    keywords: ['emi', 'loan emi', 'home loan', 'car loan', 'personal loan', 'instalment'], reference: 'Standard reducing-balance annuity formula used by Indian banks.' },
  { id: 'prepayment', chapter: 'Loans', title: 'Loan prepayment', summary: 'Paying extra reduces the balance, so every later month carries less interest.',
    notes: ['Prepaying a loan earns you its interest rate, risk-free and tax-free.', 'RBI rules bar prepayment penalties on floating-rate loans taken by individuals.', 'Choose "reduce tenure" to save the most interest, or "reduce EMI" for cash-flow relief.'],
    keywords: ['prepayment', 'prepay loan', 'foreclosure', 'part payment', 'reduce tenure'], reference: 'RBI circular on foreclosure charges for floating-rate term loans to individuals.' },
  { id: 'debt-methods', chapter: 'Loans', title: 'Debt avalanche and snowball', summary: 'Two ways to clear several debts.',
    notes: ['Avalanche: pay minimums on all, put extra on the highest interest rate first. Saves the most interest.', 'Snowball: put extra on the smallest balance first. Quick wins help motivation.', 'Credit cards (often 36–42% a year) come first under either method.'],
    keywords: ['debt avalanche', 'debt snowball', 'multiple loans', 'credit card debt'], reference: 'Widely used personal-finance methods.' },

  // ---------------- Tax (India) ----------------
  { id: 'new-regime', chapter: 'Tax (India)', title: 'New tax regime, FY 2025-26', summary: 'The default regime: lower slab rates, few deductions.',
    formula: 'Slabs on taxable income: ₹0–4,00,000 nil; ₹4,00,001–8,00,000 5%; ₹8,00,001–12,00,000 10%; ₹12,00,001–16,00,000 15%; ₹16,00,001–20,00,000 20%; ₹20,00,001–24,00,000 25%; above ₹24,00,000 30%',
    example: { inputs: '₹15,00,000 salary', working: 'Taxable = 15,00,000 − 75,000 standard deduction = 14,25,000', result: `${inr(newTax15L)} + 4% cess = ${inr(newTax15L * 1.04)}`, value: newTax15L },
    notes: ['Standard deduction ₹75,000 for salaried and pensioners.', 'Section 87A rebate up to ₹60,000 when taxable income is ₹12,00,000 or less, so salary up to ₹12,75,000 pays no tax (marginal relief just above).', 'Employer NPS contribution up to 14% of basic + DA is deductible (80CCD(2)).'],
    keywords: ['new regime', 'new tax regime', 'tax slabs', 'income tax', '87a rebate', 'tax calculation'], reference: 'Finance Act 2025, section 115BAC; Income Tax Department FY 2025-26 guidance.' },
  { id: 'old-regime', chapter: 'Tax (India)', title: 'Old tax regime, FY 2025-26', summary: 'Higher slab rates but allows deductions such as 80C, 80D, HRA and home-loan interest.',
    formula: 'Slabs (below 60): ₹0–2,50,000 nil; ₹2,50,001–5,00,000 5%; ₹5,00,001–10,00,000 20%; above ₹10,00,000 30%',
    example: { inputs: '₹15,00,000 salary, ₹1,50,000 80C, ₹25,000 80D', working: 'Taxable = 15,00,000 − 50,000 − 1,50,000 − 25,000 = 12,75,000', result: `${inr(oldTax15L)} + 4% cess = ${inr(oldTax15L * 1.04)}`, value: oldTax15L },
    notes: ['Standard deduction ₹50,000.', 'Section 87A rebate up to ₹12,500 when taxable income is ₹5,00,000 or less.', 'Seniors (60+) have a ₹3,00,000 nil slab; super seniors (80+) ₹5,00,000.', 'Compare both regimes every year; the ArthaMind tax tool does this for you.'],
    keywords: ['old regime', 'old tax regime', '80c', 'deductions', 'hra', 'tax comparison'], reference: 'Income-tax Act first schedule; Finance Act 2025.' },
  { id: 'deductions', chapter: 'Tax (India)', title: 'Main deductions (old regime)', summary: 'Limits most salaried people use.',
    notes: ['80C: up to ₹1,50,000 (EPF, PPF, ELSS, life premium, principal on home loan, children’s tuition).', '80D: health insurance up to ₹25,000 for self and family (₹50,000 if 60+), plus up to ₹25,000 / ₹50,000 for parents.', '80CCD(1B): extra ₹50,000 for your own NPS contribution.', 'Section 24(b): up to ₹2,00,000 home-loan interest on a self-occupied house.', 'Most of these are not available in the new regime.'],
    keywords: ['80c', '80d', '80ccd', 'nps deduction', 'home loan interest', 'section 24', 'deductions'], reference: 'Income-tax Act chapter VI-A and section 24(b).' },
  { id: 'hra', chapter: 'Tax (India)', title: 'HRA exemption', summary: 'Part of house rent allowance is tax-free if you pay rent (old regime).',
    formula: 'Exempt HRA = least of: actual HRA; rent − 10% of (basic + DA); 50% of (basic + DA) in Delhi, Mumbai, Kolkata, Chennai, else 40%',
    example: { inputs: 'Basic + DA ₹6,00,000, HRA ₹2,40,000, rent ₹3,00,000, metro', result: `${inr(F.hraExemption(240_000, 300_000, 600_000, true))} exempt`, value: F.hraExemption(240_000, 300_000, 600_000, true) },
    keywords: ['hra', 'house rent allowance', 'rent exemption'], reference: 'Section 10(13A) and rule 2A of the Income-tax Rules.' },

  // ---------------- Company analysis ----------------
  { id: 'pe', chapter: 'Company analysis', title: 'P/E ratio', summary: 'How many rupees investors pay for one rupee of yearly earnings.',
    formula: 'P/E = Share price ÷ EPS;  EPS = Net profit ÷ Shares outstanding',
    example: { inputs: 'Price ₹1,500, EPS ₹75', result: '20×', value: 1500 / 75 },
    notes: ['Compare within the same industry; a high P/E can mean expected growth or over-valuation.'],
    keywords: ['pe ratio', 'p/e', 'price to earnings', 'eps', 'valuation'], reference: 'Standard equity-analysis ratio.' },
  { id: 'pb', chapter: 'Company analysis', title: 'P/B ratio', summary: 'Price compared with the accounting net worth per share; common for banks.',
    formula: 'P/B = Share price ÷ Book value per share', example: { inputs: 'Price ₹450, book value ₹300', result: '1.5×', value: 450 / 300 },
    keywords: ['pb ratio', 'price to book', 'book value'], reference: 'Standard equity-analysis ratio.' },
  { id: 'roe', chapter: 'Company analysis', title: 'Return on equity (ROE)', summary: 'Profit generated for each rupee of shareholders’ money.',
    formula: 'ROE = Net profit ÷ Average shareholders’ equity', example: { inputs: 'Net profit ₹1,80,00,00,000, equity ₹12,00,00,00,000', result: '15%', value: 180 / 1200 },
    keywords: ['roe', 'return on equity', 'profitability'], reference: 'Standard ratio (DuPont analysis).' },
  { id: 'dividend-yield', chapter: 'Company analysis', title: 'Dividend yield', summary: 'Yearly dividend as a percentage of the share price.',
    formula: 'Dividend yield = Dividend per share ÷ Share price', example: { inputs: 'Dividend ₹12, price ₹600', result: '2.00%', value: 12 / 600 },
    keywords: ['dividend yield', 'dividend'], reference: 'Standard ratio.' },
  { id: 'debt-equity', chapter: 'Company analysis', title: 'Debt-to-equity', summary: 'How much the company borrows compared with its own capital.',
    formula: 'D/E = Total debt ÷ Shareholders’ equity', example: { inputs: 'Debt ₹8,00,00,00,000, equity ₹10,00,00,00,000', result: '0.8', value: 0.8 },
    keywords: ['debt to equity', 'd/e', 'leverage'], reference: 'Standard ratio.' },
  { id: 'liquidity-ratios', chapter: 'Company analysis', title: 'Current and quick ratio', summary: 'Whether short-term assets cover short-term bills.',
    formula: 'Current ratio = Current assets ÷ Current liabilities;  Quick ratio = (Current assets − Inventory) ÷ Current liabilities',
    example: { inputs: 'Current assets ₹500, inventory ₹150, current liabilities ₹250 (crore)', result: 'Current 2.0, quick 1.4', value: 350 / 250 },
    keywords: ['current ratio', 'quick ratio', 'acid test', 'liquidity'], reference: 'Standard ratios.' },
  { id: 'interest-coverage', chapter: 'Company analysis', title: 'Interest coverage', summary: 'How many times operating profit covers interest cost.',
    formula: 'Interest coverage = EBIT ÷ Interest expense', example: { inputs: 'EBIT ₹2,40,00,00,000, interest ₹60,00,00,000', result: '4.0×', value: 4 },
    keywords: ['interest coverage', 'ebit', 'solvency'], reference: 'Standard ratio.' },
  { id: 'break-even', chapter: 'Company analysis', title: 'Break-even point', summary: 'Units to sell before a business stops losing money.',
    formula: 'Break-even units = Fixed costs ÷ (Price − Variable cost per unit)',
    example: { inputs: 'Fixed ₹5,00,000, price ₹250, variable ₹150', result: `${F.breakEvenUnits(500_000, 250, 150).toLocaleString('en-IN')} units`, value: F.breakEvenUnits(500_000, 250, 150) },
    keywords: ['break even', 'contribution margin', 'fixed cost'], reference: 'Standard cost-volume-profit analysis.' },

  // ---------------- Valuation ----------------
  { id: 'npv', chapter: 'Valuation', title: 'Net present value (NPV)', summary: 'Present value of future cash flows minus the cost today; positive NPV creates value at that rate.',
    formula: 'NPV = Σ CFₜ ÷ (1 + r)^t − Initial investment',
    example: { inputs: 'Invest ₹1,00,000; receive ₹40,000 a year for 3 years; 10% rate', result: `${inr(F.npv(0.1, [-100_000, 40_000, 40_000, 40_000]))} (negative, so it falls short of 10%)`, value: F.npv(0.1, [-100_000, 40_000, 40_000, 40_000]) },
    keywords: ['npv', 'net present value', 'discounted cash flow', 'dcf'], reference: 'Standard capital-budgeting method.' },
  { id: 'irr', chapter: 'Valuation', title: 'Internal rate of return (IRR)', summary: 'The discount rate at which NPV is zero.',
    formula: 'Find r such that Σ CFₜ ÷ (1 + r)^t = 0',
    example: { inputs: '−₹1,00,000 then ₹40,000 a year for 3 years', result: pct(F.irr([-100_000, 40_000, 40_000, 40_000])), value: F.irr([-100_000, 40_000, 40_000, 40_000]) },
    keywords: ['irr', 'internal rate of return'], reference: 'Standard capital-budgeting method.' },
  { id: 'bond-price', chapter: 'Valuation', title: 'Bond price and yield', summary: 'A bond is worth its coupons and face value discounted at the market yield; prices fall when yields rise.',
    formula: 'Price = Σ C ÷ (1 + y)^t + F ÷ (1 + y)^T;  Current yield = Annual coupon ÷ Price',
    example: { inputs: '₹1,000 face, 8% annual coupon, 3 years, market yield 7%', result: `${inr(F.bondPrice(1000, 0.08, 0.07, 3), 2)} (above face because coupon > yield)`, value: F.bondPrice(1000, 0.08, 0.07, 3) },
    keywords: ['bond price', 'yield to maturity', 'ytm', 'current yield', 'coupon', 'g-sec'], reference: 'Standard fixed-income pricing.' },
  { id: 'gordon', chapter: 'Valuation', title: 'Dividend discount (Gordon growth) model', summary: 'Value of a share whose dividend grows at a steady rate forever.',
    formula: 'Price = D₁ ÷ (r − g)', example: { inputs: 'Next dividend ₹10, required return 12%, growth 5%', result: inr(F.gordon(10, 0.12, 0.05), 2), value: F.gordon(10, 0.12, 0.05) },
    notes: ['Only valid when r > g.'], keywords: ['gordon growth', 'dividend discount model', 'ddm', 'intrinsic value'], reference: 'Gordon & Shapiro (1956).' },

  // ---------------- Risk & return ----------------
  { id: 'capm', chapter: 'Risk & return', title: 'CAPM (expected return)', summary: 'Return an investor should require for a stock’s market risk.',
    formula: 'E(R) = Rf + β × (Rm − Rf)', example: { inputs: 'Risk-free 7%, beta 1.2, market return 12%', result: pct(F.capm(0.07, 1.2, 0.12)), value: F.capm(0.07, 1.2, 0.12) },
    keywords: ['capm', 'beta', 'expected return', 'cost of equity'], reference: 'Sharpe (1964), Lintner (1965).' },
  { id: 'sharpe', chapter: 'Risk & return', title: 'Sharpe ratio', summary: 'Extra return earned per unit of volatility.',
    formula: 'Sharpe = (Rp − Rf) ÷ σp', example: { inputs: 'Portfolio 14%, risk-free 7%, volatility 15%', result: F.sharpe(0.14, 0.07, 0.15).toFixed(2), value: F.sharpe(0.14, 0.07, 0.15) },
    keywords: ['sharpe ratio', 'risk adjusted return', 'volatility', 'standard deviation'], reference: 'Sharpe (1966).' },
  { id: 'emergency-fund', chapter: 'Personal finance rules', title: 'Emergency fund', summary: 'Cash kept aside for job loss or medical emergencies.',
    formula: 'Emergency fund = 6 × (monthly expenses + EMIs)', example: { inputs: 'Expenses ₹50,000, EMIs ₹15,000', result: '₹3,90,000', value: 6 * 65_000 },
    notes: ['Keep it in a savings account, sweep FD or liquid fund.', 'Use 9–12 months if income is irregular or one person earns for the family.'],
    keywords: ['emergency fund', 'contingency fund', 'safety net', 'runway'], reference: 'Common planning guideline (SEBI and RBI financial-education material).' },
  { id: 'insurance-cover', chapter: 'Personal finance rules', title: 'Term and health cover', summary: 'Protect the family before investing for growth.',
    notes: ['Term cover: roughly 10–15× annual income, or enough to fund family expenses to your retirement age plus loans, minus existing savings.', 'Health cover: at least ₹10,00,000 for a family in a metro; a super top-up adds cover cheaply.', 'Avoid mixing insurance and investment (endowment/ULIP) unless you understand the costs.'],
    keywords: ['term insurance', 'life cover', 'health insurance', 'human life value', 'hlv'], reference: 'IRDAI consumer education; common planning practice.' },
  { id: 'savings-rate', chapter: 'Personal finance rules', title: 'Savings rate and EMI load', summary: 'Two quick health checks for monthly cash flow.',
    formula: 'Savings rate = (Take-home − Expenses − EMIs) ÷ Take-home;  EMI load = EMIs ÷ Take-home',
    notes: ['Aim for a savings rate of 20% or more.', 'Keep EMI load under 30–40%.'],
    keywords: ['savings rate', 'emi to income', 'foir', 'budget', '50 30 20'], reference: 'Common planning benchmarks; banks use FOIR limits near 40–50%.' },

  // ---------------- Economics ----------------
  { id: 'gdp', chapter: 'Economics', title: 'GDP (expenditure method)', summary: 'The value of all final goods and services produced in a year.',
    formula: 'GDP = C + I + G + (X − M)', variables: [['C', 'private consumption'], ['I', 'investment'], ['G', 'government spending'], ['X − M', 'net exports']],
    notes: ['Real GDP removes inflation; nominal GDP does not.', 'India’s GDP data is published by NSO (MoSPI).'],
    keywords: ['gdp', 'gross domestic product', 'economic growth', 'national income'], reference: 'NCERT Class 12 Introductory Macroeconomics, chapter on national income accounting.' },
  { id: 'inflation', chapter: 'Economics', title: 'Inflation (CPI)', summary: 'The rate at which the general price level rises.',
    formula: 'Inflation = (CPIₜ − CPIₜ₋₁) ÷ CPIₜ₋₁ × 100', example: { inputs: 'CPI 190 last year, 199.5 now', result: '5.0%', value: (199.5 - 190) / 190 },
    notes: ['RBI targets CPI inflation of 4% within a 2–6% band.', 'CPI is published monthly by NSO.'],
    keywords: ['inflation', 'cpi', 'wpi', 'price rise', 'inflation target'], reference: 'RBI Act section 45ZA (flexible inflation targeting); NSO CPI releases.' },
  { id: 'repo-rate', chapter: 'Economics', title: 'Repo rate and monetary policy', summary: 'The rate at which RBI lends to banks overnight; it steers loan and deposit rates.',
    notes: ['Set by RBI’s Monetary Policy Committee, which meets about every two months.', 'A cut usually lowers floating-rate EMIs (EBLR-linked loans reset quickly) and FD rates.', 'Check the current rate on rbi.org.in; do not rely on remembered values.'],
    keywords: ['repo rate', 'reverse repo', 'monetary policy', 'mpc', 'rbi policy', 'interest rates'], reference: 'RBI Monetary Policy Framework.' },
  { id: 'fiscal-deficit', chapter: 'Economics', title: 'Fiscal deficit', summary: 'How much the government borrows in a year.',
    formula: 'Fiscal deficit = Total expenditure − (Revenue receipts + non-debt capital receipts)', notes: ['Usually quoted as a % of GDP in the Union Budget.'],
    keywords: ['fiscal deficit', 'budget deficit', 'government borrowing'], reference: 'NCERT Class 12 Macroeconomics, Government Budget and the Economy.' },
  { id: 'elasticity', chapter: 'Economics', title: 'Price elasticity of demand', summary: 'How strongly quantity demanded responds to a price change.',
    formula: 'Eₚ = % change in quantity ÷ % change in price', example: { inputs: 'Price up 10%, quantity down 15%', result: '−1.5 (elastic)', value: -0.15 / 0.1 },
    keywords: ['elasticity', 'price elasticity', 'demand'], reference: 'NCERT Class 12 Introductory Microeconomics.' },
  { id: 'multiplier', chapter: 'Economics', title: 'Keynesian multiplier', summary: 'How much total income rises for each rupee of new spending.',
    formula: 'k = 1 ÷ (1 − MPC)', example: { inputs: 'MPC 0.8', result: `${F.keynesMultiplier(0.8).toFixed(1)}`, value: F.keynesMultiplier(0.8) },
    keywords: ['multiplier', 'mpc', 'marginal propensity to consume', 'keynes'], reference: 'NCERT Class 12 Macroeconomics, Determination of Income and Employment.' },
];

/** Recommended reading: real books and official free resources (links go to official sites only). */
export const READING_LIST: Array<{ title: string; author: string; why: string; url?: string; free?: boolean }> = [
  { title: 'Let’s Talk Money', author: 'Monika Halan', why: 'The clearest Indian guide to building a household money system.' },
  { title: 'The Psychology of Money', author: 'Morgan Housel', why: 'Why behaviour matters more than returns.' },
  { title: 'The Intelligent Investor', author: 'Benjamin Graham', why: 'The classic on margin of safety and investor temperament.' },
  { title: 'Coffee Can Investing', author: 'Saurabh Mukherjea, Rakshit Ranjan, Pranab Uniyal', why: 'Long-term quality investing in Indian markets.' },
  { title: 'A Random Walk Down Wall Street', author: 'Burton G. Malkiel', why: 'The case for low-cost index investing.' },
  { title: 'Introductory Macroeconomics and Microeconomics (Class 12)', author: 'NCERT', why: 'Free official textbooks covering GDP, inflation, money and banking.', url: 'https://ncert.nic.in/textbook.php', free: true },
  { title: 'SEBI Investor Education', author: 'Securities and Exchange Board of India', why: 'Free official guides on mutual funds, shares, risk and fraud.', url: 'https://investor.sebi.gov.in/', free: true },
  { title: 'RBI Financial Education', author: 'Reserve Bank of India', why: 'Free official material on banking, credit and digital safety.', url: 'https://www.rbi.org.in/', free: true },
  { title: 'Income Tax Department', author: 'Government of India', why: 'Official slabs, calculators and filing guides.', url: 'https://www.incometax.gov.in/', free: true },
];
