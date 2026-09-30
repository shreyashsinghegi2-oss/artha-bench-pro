/**
 * Registry of the public calculator endpoints (GET /api/v1/calculators/:slug).
 *
 * Each entry declares its query parameters (used for validation AND the OpenAPI spec), the formula it uses,
 * where the rules come from, and a pure compute function. All results are deterministic: the same inputs
 * always give the same output.
 */
import { emi as emiMonthly, ppfMaturity } from '../../src/services/calculators';
import { getEngine, TaxInputError } from '../../src/tax-engines';
import { indiaEngine } from '../../src/tax-engines/india';
import { money, pct } from './envelope';
import { n, num, oneOf, s, type ParamDef, type ParamValues } from './params';

export class CalcError extends Error {}

export interface CalculatorDef {
  slug: string;
  summary: string;
  formula: string;
  source: string;
  params: ParamDef[];
  /** Params whose default is an assumed (changeable) scheme rate: using the default lowers reliability to 90. */
  assumedDefaults?: string[];
  compute(values: ParamValues): object;
}

const MAX_MONEY = 1e12;
const principal = (name = 'principal', description = 'Amount in rupees (or any currency)') =>
  num(name, description, { min: 0.01, max: MAX_MONEY, example: 1000000 });
const ratePct = (description = 'Annual interest rate in percent, e.g. 8.5', example = 8.5) => num('rate', description, { min: 0, max: 100, example });
const yesNo = (name: string, description: string, def: 'yes' | 'no') => oneOf(name, description, ['yes', 'no'], { default: def });
const TAX_YEAR = (years: readonly string[]) => oneOf('year', `Tax year (rules available: ${years.join(', ')})`, years, { default: years[0] });

function futureValueAnnuityDue(payment: number, ratePerPeriod: number, periods: number): number {
  if (periods <= 0) return 0;
  if (ratePerPeriod === 0) return payment * periods;
  return payment * (((1 + ratePerPeriod) ** periods - 1) / ratePerPeriod) * (1 + ratePerPeriod);
}

function withTaxErrors<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof TaxInputError) throw new CalcError(e.message);
    throw e;
  }
}

const US_STATES = [
  'al',
  'ak',
  'az',
  'ar',
  'ca',
  'co',
  'ct',
  'de',
  'dc',
  'fl',
  'ga',
  'hi',
  'id',
  'il',
  'in',
  'ia',
  'ks',
  'ky',
  'la',
  'me',
  'md',
  'ma',
  'mi',
  'mn',
  'ms',
  'mo',
  'mt',
  'ne',
  'nv',
  'nh',
  'nj',
  'nm',
  'ny',
  'nc',
  'nd',
  'oh',
  'ok',
  'or',
  'pa',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'ut',
  'vt',
  'va',
  'wa',
  'wv',
  'wi',
  'wy',
] as const;

function foreignTax(slug: string, country: string, label: string, extra: ParamDef[] = []): CalculatorDef {
  const engine = getEngine(country);
  if (!engine) throw new Error(`No tax engine for ${country}`);
  return {
    slug,
    summary: `${label} income tax`,
    formula: 'taxable = income − allowance − deductions; tax = Σ (income in each bracket × bracket rate) − credits',
    source: `ArthaBench tax engine · ${engine.name} · rules in src/tax-engines/config`,
    params: [
      num('income', `Annual income in ${label} currency`, { min: 0, max: MAX_MONEY, example: 60000 }),
      num('deductions', 'Other deductions to subtract before tax (optional)', { min: 0, max: MAX_MONEY, required: false, default: 0, example: 0 }),
      ...extra,
      TAX_YEAR(engine.years),
    ],
    compute: (v) =>
      withTaxErrors(() => {
        const result = engine.calculate(n(v, 'income'), s(v, 'year'), {
          deductions: n(v, 'deductions'),
          filing_status: typeof v.filing_status === 'string' ? v.filing_status : undefined,
        });
        if (typeof v.state === 'string') {
          return { ...result, notes: [...result.notes, `State tax for ${v.state.toUpperCase()} is not included (federal only).`] };
        }
        return result;
      }),
  };
}

export const CALCULATORS: CalculatorDef[] = [
  {
    slug: 'emi',
    summary: 'Loan EMI (reducing balance)',
    formula: 'EMI = P × r × (1+r)^n ÷ ((1+r)^n − 1), r = annual rate ÷ 12 ÷ 100, n = months',
    source: 'ArthaBench deterministic calculator · reducing-balance EMI formula',
    params: [principal('principal', 'Loan amount'), ratePct(), num('months', 'Loan tenure in months', { min: 1, max: 600, integer: true, example: 240 })],
    compute: (v) => {
      const months = n(v, 'months');
      const emi = emiMonthly(n(v, 'principal'), n(v, 'rate') / 100, months);
      const total = money(emi * months);
      return { emi, total_payment: total, total_interest: money(total - n(v, 'principal')), months };
    },
  },
  {
    slug: 'compound-interest',
    summary: 'Compound interest',
    formula: 'A = P × (1 + r/m)^(m × t); interest = A − P',
    source: 'ArthaBench deterministic calculator · compound interest formula',
    params: [
      principal(),
      ratePct('Annual interest rate in percent', 7),
      num('years', 'Number of years', { min: 0, max: 100, example: 10 }),
      oneOf('compounding', 'How often interest compounds', ['yearly', 'half-yearly', 'quarterly', 'monthly', 'daily'], { default: 'yearly' }),
    ],
    compute: (v) => {
      const m = { yearly: 1, 'half-yearly': 2, quarterly: 4, monthly: 12, daily: 365 }[s(v, 'compounding')] ?? 1;
      const p = n(v, 'principal');
      const final = p * (1 + n(v, 'rate') / 100 / m) ** (m * n(v, 'years'));
      return { final_amount: money(final), interest: money(final - p), periods_per_year: m };
    },
  },
  {
    slug: 'break-even',
    summary: 'Break-even point',
    formula: 'units = fixed cost ÷ (price − variable cost per unit); revenue = units × price',
    source: 'ArthaBench deterministic calculator · contribution-margin break-even formula',
    params: [
      num('fixed_cost', 'Total fixed costs', { min: 0, max: MAX_MONEY, example: 500000 }),
      num('price', 'Selling price per unit', { min: 0.01, max: MAX_MONEY, example: 250 }),
      num('variable_cost', 'Variable cost per unit', { min: 0, max: MAX_MONEY, example: 150 }),
    ],
    compute: (v) => {
      const margin = n(v, 'price') - n(v, 'variable_cost');
      if (margin <= 0)
        throw new CalcError('Price must be higher than the variable cost per unit, otherwise every sale adds to the loss and there is no break-even point.');
      const units = n(v, 'fixed_cost') / margin;
      const whole = Math.ceil(units - 1e-9);
      return {
        units: Math.round(units * 10_000) / 10_000,
        units_whole: whole,
        revenue: money(units * n(v, 'price')),
        revenue_at_whole_units: money(whole * n(v, 'price')),
        contribution_margin_per_unit: money(margin),
        contribution_margin_ratio: pct(margin / n(v, 'price')),
      };
    },
  },
  {
    slug: 'sip',
    summary: 'SIP future value',
    formula: 'FV = A × ((1+i)^n − 1) ÷ i × (1+i), i = (1 + annual rate)^(1/periods per year) − 1, paid at the start of each period',
    source: 'ArthaBench deterministic calculator · annuity-due future value with effective periodic rate',
    params: [
      num('amount', 'Amount invested each period', { min: 1, max: 1e9, example: 10000 }),
      ratePct('Expected annual return in percent', 12),
      num('years', 'Investment period in years', { min: 1, max: 60, example: 15 }),
      oneOf('frequency', 'How often you invest', ['monthly', 'quarterly'], { default: 'monthly' }),
    ],
    compute: (v) => {
      const perYear = s(v, 'frequency') === 'quarterly' ? 4 : 12;
      const periods = Math.round(n(v, 'years') * perYear);
      const i = (1 + n(v, 'rate') / 100) ** (1 / perYear) - 1;
      const fv = futureValueAnnuityDue(n(v, 'amount'), i, periods);
      const invested = n(v, 'amount') * periods;
      return {
        future_value: money(fv),
        invested: money(invested),
        gains: money(fv - invested),
        periods,
        rate_convention: 'effective annual rate converted to an equivalent periodic rate',
      };
    },
  },
  {
    slug: 'ppf',
    summary: 'Public Provident Fund maturity',
    formula: 'FV = D × ((1+r)^n − 1) ÷ r × (1+r); yearly deposit D (₹500 to ₹1,50,000) made before 5 April',
    source: 'ArthaBench deterministic calculator · PPF Scheme 2019 rules; rate is the caller’s or the default',
    params: [
      num('contribution', 'Yearly deposit (₹500 to ₹1,50,000)', { min: 500, max: 150000, example: 150000 }),
      num('years', 'Years (15-year lock-in, extendable in 5-year blocks)', { min: 15, max: 50, integer: true, required: false, default: 15, example: 15 }),
      num('rate', 'Annual interest rate in percent (set by the government every quarter)', { min: 0, max: 20, required: false, default: 7.1, example: 7.1 }),
    ],
    assumedDefaults: ['rate'],
    compute: (v) => {
      const r = ppfMaturity(n(v, 'contribution'), n(v, 'rate') / 100, n(v, 'years'));
      return {
        maturity: r.maturity,
        invested: r.invested,
        interest: r.interest,
        years: n(v, 'years'),
        rate_used_pct: n(v, 'rate'),
        tax_status: 'EEE: deposits (old regime, 80C), interest and maturity are tax-free',
      };
    },
  },
  {
    slug: 'nps',
    summary: 'National Pension System corpus and pension',
    formula: 'corpus = monthly SIP future value; annuity = corpus × annuity share; pension = annuity × annuity rate ÷ 12',
    source: 'ArthaBench deterministic calculator · assumed returns; check current PFRDA exit rules',
    params: [
      num('contribution', 'Monthly contribution', { min: 100, max: 1e8, example: 5000 }),
      num('age', 'Current age', { min: 18, max: 70, integer: true, example: 30 }),
      num('years', 'Years of contribution (default: until age 60)', { min: 1, max: 52, integer: true, required: false, example: 30 }),
      num('rate', 'Expected annual return in percent', { min: 0, max: 30, required: false, default: 10, example: 10 }),
      num('annuity_share', 'Percent of corpus used to buy an annuity', { min: 0, max: 100, required: false, default: 40, example: 40 }),
      num('annuity_rate', 'Annual annuity rate in percent', { min: 0, max: 20, required: false, default: 6, example: 6 }),
    ],
    assumedDefaults: ['rate', 'annuity_rate'],
    compute: (v) => {
      const years = typeof v.years === 'number' ? v.years : 60 - n(v, 'age');
      if (years < 1) throw new CalcError('At age 60 or above, pass "years" for how long you will keep contributing.');
      const months = years * 12;
      const i = (1 + n(v, 'rate') / 100) ** (1 / 12) - 1;
      const corpus = futureValueAnnuityDue(n(v, 'contribution'), i, months);
      const annuity = corpus * (n(v, 'annuity_share') / 100);
      return {
        corpus: money(corpus),
        invested: money(n(v, 'contribution') * months),
        lumpsum: money(corpus - annuity),
        annuity_purchase: money(annuity),
        monthly_pension: money((annuity * n(v, 'annuity_rate')) / 100 / 12),
        years,
        exit_age: n(v, 'age') + years,
      };
    },
  },
  {
    slug: 'epf',
    summary: 'Employees’ Provident Fund corpus',
    formula:
      'Monthly: employee 12% of salary; employer 12% minus EPS (8.33% of min(salary, ₹15,000)). Interest on the monthly running balance at rate ÷ 12, credited once a year',
    source: 'ArthaBench deterministic calculator · EPF Scheme 1952 contribution split; rate is the caller’s or the default',
    params: [
      num('salary', 'Monthly basic salary + DA', { min: 1, max: 1e7, example: 50000 }),
      num('years', 'Years of service', { min: 1, max: 45, integer: true, example: 25 }),
      num('rate', 'EPF interest rate in percent (declared yearly)', { min: 0, max: 20, required: false, default: 8.25, example: 8.25 }),
      num('annual_increase', 'Yearly salary increase in percent', { min: 0, max: 50, required: false, default: 0, example: 5 }),
    ],
    assumedDefaults: ['rate'],
    compute: (v) => {
      let salary = n(v, 'salary');
      let balance = 0;
      let employee = 0;
      let employer = 0;
      let eps = 0;
      let interest = 0;
      for (let y = 0; y < n(v, 'years'); y += 1) {
        let yearInterest = 0;
        for (let m = 0; m < 12; m += 1) {
          const e = salary * 0.12;
          const pension = Math.min(salary, 15000) * 0.0833;
          const er = salary * 0.12 - pension;
          balance += e + er;
          employee += e;
          employer += er;
          eps += pension;
          yearInterest += (balance * n(v, 'rate')) / 100 / 12;
        }
        balance += yearInterest;
        interest += yearInterest;
        salary *= 1 + n(v, 'annual_increase') / 100;
      }
      return {
        corpus: money(balance),
        employee_contribution: money(employee),
        employer_contribution_epf: money(employer),
        eps_contribution: money(eps),
        interest_earned: money(interest),
        note: 'EPS (pension scheme) contributions are not part of the EPF corpus. Assumes contributions on full salary.',
      };
    },
  },
  {
    slug: 'ssy',
    summary: 'Sukanya Samriddhi Yojana maturity',
    formula: 'Deposits at the start of each of the first N years (N ≤ 15); balance compounds yearly until 21 years from opening',
    source: 'ArthaBench deterministic calculator · SSY Scheme 2019 rules; rate is the caller’s or the default',
    params: [
      num('deposit', 'Yearly deposit (₹250 to ₹1,50,000)', { min: 250, max: 150000, example: 150000 }),
      num('years', 'Years you will deposit (at most 15)', { min: 1, max: 15, integer: true, required: false, default: 15, example: 15 }),
      oneOf('gender', 'SSY accounts can be opened only for a girl child', ['girl', 'female', 'boy', 'male'], { required: true, example: 'girl' }),
      num('rate', 'Annual interest rate in percent (set by the government every quarter)', { min: 0, max: 20, required: false, default: 8.2, example: 8.2 }),
    ],
    assumedDefaults: ['rate'],
    compute: (v) => {
      if (['boy', 'male'].includes(s(v, 'gender')))
        throw new CalcError('Sukanya Samriddhi accounts can only be opened for a girl child under 10. For a boy, compare PPF or a children’s fund.');
      const r = n(v, 'rate') / 100;
      let balance = 0;
      for (let year = 1; year <= 21; year += 1) {
        if (year <= n(v, 'years')) balance += n(v, 'deposit');
        balance *= 1 + r;
      }
      const invested = n(v, 'deposit') * n(v, 'years');
      return { maturity: money(balance), invested: money(invested), interest: money(balance - invested), maturity_after_years: 21 };
    },
  },
  {
    slug: 'gst',
    summary: 'GST on a price',
    formula:
      'Exclusive: GST = price × rate. Inclusive: base = price ÷ (1 + rate), GST = price − base. Intra-state splits equally into CGST + SGST; inter-state is IGST',
    source: 'ArthaBench deterministic calculator · CGST/SGST/IGST split',
    params: [
      num('price', 'Price', { min: 0, max: MAX_MONEY, example: 1000 }),
      num('gst_rate', 'GST rate in percent (e.g. 5, 18 or 40 after the September 2025 rate changes)', { min: 0, max: 100, example: 18 }),
      oneOf('mode', 'Is GST already included in the price?', ['exclusive', 'inclusive'], { default: 'exclusive' }),
      oneOf('supply', 'Intra-state (CGST+SGST) or inter-state (IGST)', ['intra', 'inter'], { default: 'intra' }),
    ],
    compute: (v) => {
      const rate = n(v, 'gst_rate') / 100;
      const inclusive = s(v, 'mode') === 'inclusive';
      const base = inclusive ? n(v, 'price') / (1 + rate) : n(v, 'price');
      const gst = base * rate;
      const intra = s(v, 'supply') === 'intra';
      return {
        base_price: money(base),
        gst: money(gst),
        total: money(base + gst),
        cgst: intra ? money(gst / 2) : 0,
        sgst: intra ? money(gst / 2) : 0,
        igst: intra ? 0 : money(gst),
      };
    },
  },
  {
    slug: 'hra',
    summary: 'HRA exemption (section 10(13A), old regime)',
    formula: 'Exempt = least of (HRA received, rent − 10% of basic, 50% of basic in metros or 40% elsewhere)',
    source: 'ArthaBench deterministic calculator · Income-tax rules for HRA; old regime only',
    params: [
      num('basic', 'Monthly basic salary + DA', { min: 0, max: 1e8, example: 50000 }),
      num('rent', 'Monthly rent paid', { min: 0, max: 1e8, example: 20000 }),
      oneOf('city_type', 'Metro (Delhi, Mumbai, Kolkata, Chennai) or non-metro', ['metro', 'non-metro'], { required: true, example: 'metro' }),
      num('hra_received', 'Monthly HRA received (optional; without it only the other two limits are applied)', {
        min: 0,
        max: 1e8,
        required: false,
        example: 25000,
      }),
    ],
    compute: (v) => {
      const rentLimit = Math.max(0, n(v, 'rent') - 0.1 * n(v, 'basic'));
      const salaryLimit = (s(v, 'city_type') === 'metro' ? 0.5 : 0.4) * n(v, 'basic');
      const hra = typeof v.hra_received === 'number' ? v.hra_received : null;
      const exempt = Math.max(0, Math.min(rentLimit, salaryLimit, hra ?? Number.POSITIVE_INFINITY));
      return {
        exempt_monthly: money(exempt),
        exempt_yearly: money(exempt * 12),
        taxable_hra_monthly: hra === null ? null : money(Math.max(0, hra - exempt)),
        limits: { hra_received: hra, rent_minus_10pct_basic: money(rentLimit), pct_of_basic: money(salaryLimit) },
        note:
          hra === null
            ? 'HRA received was not given: the exemption can never be more than the HRA you actually receive.'
            : 'HRA exemption is available only in the old tax regime.',
      };
    },
  },
  {
    slug: '80c',
    summary: 'Section 80C tax saving (old regime)',
    formula: 'deduction = min(investments, ₹1,50,000); saving = old-regime tax without the deduction − with it',
    source: 'ArthaBench India tax engine (FY2026-27 rules)',
    params: [
      num('income', 'Annual gross income', { min: 0, max: MAX_MONEY, example: 1200000 }),
      num('investments', 'Total 80C investments this year (PPF, ELSS, EPF, life insurance, etc.)', { min: 0, max: MAX_MONEY, example: 150000 }),
      num('age', 'Age', { min: 0, max: 120, integer: true, required: false, default: 30, example: 30 }),
      yesNo('salaried', 'Salary income (standard deduction applies)', 'yes'),
    ],
    compute: (v) => {
      const opts = { age: n(v, 'age'), salaried: s(v, 'salaried') === 'yes' };
      const deduction = Math.min(n(v, 'investments'), 150000);
      const without = indiaEngine.calculate(n(v, 'income'), '2026', { ...opts, regime: 'old' });
      const withDed = indiaEngine.calculate(n(v, 'income'), '2026', { ...opts, regime: 'old', deductions: deduction });
      const newRegime = indiaEngine.calculate(n(v, 'income'), '2026', { ...opts, regime: 'new' });
      return {
        eligible_deduction: deduction,
        remaining_room: Math.max(0, 150000 - n(v, 'investments')),
        old_regime_tax_without: without.tax,
        old_regime_tax_with: withDed.tax,
        tax_saved: money(without.tax - withDed.tax),
        new_regime_tax: newRegime.tax,
        lower_regime: withDed.tax < newRegime.tax ? 'old' : withDed.tax > newRegime.tax ? 'new' : 'same',
        note: '80C applies only in the old regime. Other old-regime deductions (80D, HRA, home loan) are not included here.',
      };
    },
  },
  {
    slug: 'ltcg',
    summary: 'Long-term capital gains tax on listed equity',
    formula: 'Held > 12 months: tax = 12.5% × max(0, gain − ₹1,25,000) + 4% cess. Held ≤ 12 months: 20% short-term rate + 4% cess',
    source: 'ArthaBench deterministic calculator · sections 112A / 111A rates for transfers on or after 23 July 2024',
    params: [
      num('purchase', 'Total purchase cost', { min: 0, max: MAX_MONEY, example: 500000 }),
      num('sale', 'Total sale value', { min: 0, max: MAX_MONEY, example: 800000 }),
      num('holding_period', 'Holding period in months', { min: 0, max: 1200, example: 18 }),
      num('exemption_used', 'Part of the ₹1,25,000 yearly LTCG exemption already used', { min: 0, max: 125000, required: false, default: 0, example: 0 }),
    ],
    compute: (v) => {
      const gain = n(v, 'sale') - n(v, 'purchase');
      const longTerm = n(v, 'holding_period') > 12;
      const exemption = longTerm ? Math.max(0, 125000 - n(v, 'exemption_used')) : 0;
      const taxableGain = Math.max(0, gain - exemption);
      const rate = longTerm ? 0.125 : 0.2;
      const base = taxableGain * rate;
      return {
        type: longTerm ? 'long-term' : 'short-term',
        gain: money(gain),
        exemption_applied: money(Math.min(exemption, Math.max(0, gain))),
        taxable_gain: money(taxableGain),
        rate,
        tax: money(base),
        cess: money(base * 0.04),
        total_tax: money(base * 1.04),
        note: 'Listed equity shares and equity mutual funds with STT paid. Surcharge, grandfathering (pre-1 Feb 2018 holdings) and loss set-off are not included.',
      };
    },
  },
  {
    slug: 'stcg',
    summary: 'Short-term capital gains tax on listed equity',
    formula: 'tax = 20% × max(0, gain) + 4% cess (section 111A, transfers on or after 23 July 2024)',
    source: 'ArthaBench deterministic calculator · section 111A rate',
    params: [
      num('purchase', 'Total purchase cost', { min: 0, max: MAX_MONEY, example: 200000 }),
      num('sale', 'Total sale value', { min: 0, max: MAX_MONEY, example: 260000 }),
    ],
    compute: (v) => {
      const gain = n(v, 'sale') - n(v, 'purchase');
      const base = Math.max(0, gain) * 0.2;
      return {
        gain: money(gain),
        rate: 0.2,
        tax: money(base),
        cess: money(base * 0.04),
        total_tax: money(base * 1.04),
        note:
          gain < 0
            ? 'This is a loss: it can be set off against capital gains and carried forward up to 8 years if you file on time.'
            : 'Listed equity with STT paid, held 12 months or less. Surcharge is not included.',
      };
    },
  },
  {
    slug: 'tax-india',
    summary: 'India income tax (resident individual)',
    formula: 'taxable = income − standard deduction − deductions; slab tax − rebate 87A (with marginal relief) + surcharge + 4% cess',
    source: 'ArthaBench India tax engine · Income-tax Act rules in src/config/taxRules/india',
    params: [
      num('income', 'Annual gross income in rupees', { min: 0, max: MAX_MONEY, example: 1500000 }),
      num('age', 'Age (sets the old-regime exemption limit)', { min: 0, max: 120, integer: true, required: false, default: 30, example: 30 }),
      oneOf('regime', 'Tax regime', ['new', 'old'], { default: 'new' }),
      yesNo('salaried', 'Salary income (standard deduction applies)', 'yes'),
      num('deductions', 'Section 80C deductions (old regime only)', { min: 0, max: 150000, required: false, default: 0, example: 0 }),
      TAX_YEAR(['2026', '2025']),
    ],
    compute: (v) =>
      withTaxErrors(() =>
        indiaEngine.calculate(n(v, 'income'), s(v, 'year'), {
          age: n(v, 'age'),
          regime: s(v, 'regime') === 'old' ? 'old' : 'new',
          salaried: s(v, 'salaried') === 'yes',
          deductions: s(v, 'regime') === 'old' ? n(v, 'deductions') : 0,
        }),
      ),
  },
  foreignTax('tax-us', 'US', 'US federal', [
    oneOf('filing_status', 'Filing status', ['single', 'married_joint', 'married_separate', 'head_of_household'], { default: 'single' }),
    oneOf('state', 'Two-letter state code (accepted; state tax is not calculated)', US_STATES, { example: 'ca' }),
  ]),
  foreignTax('tax-uk', 'UK', 'UK'),
  foreignTax('tax-philippines', 'PH', 'Philippines'),
  foreignTax('tax-nigeria', 'NG', 'Nigeria'),
  foreignTax('tax-kenya', 'KE', 'Kenya'),
];

export const calculatorBySlug = (slug: string): CalculatorDef | undefined => CALCULATORS.find((c) => c.slug === slug);
