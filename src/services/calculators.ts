/**
 * India-focused planning calculators. Pure, deterministic functions with the formula each one uses,
 * so results can be tested and explained. Scheme rates are editable defaults, not live rates.
 */
import { sipFutureValue, sipForTarget } from './moneyCheck';

/** Default small-savings and market assumptions. Government scheme rates are reset every quarter. */
export const DEFAULT_RATES = { ppf: 0.071, ssy: 0.082, nsc: 0.077, fd: 0.07, equity: 0.12, annuity: 0.06 } as const;
export const RATES_NOTE = 'Scheme rates are editable defaults (PPF 7.1%, SSY 8.2%, NSC 7.7%). The government resets them every quarter, so check the current rate.';

const r2 = (value: number) => Math.round(value * 100) / 100;

/** Lumpsum growing at an annual rate for `years`. */
export const lumpsumFutureValue = (amount: number, annual: number, years: number) => amount * (1 + annual) ** years;

/** Bank FD with quarterly compounding (the common convention for cumulative FDs). */
export function fdMaturity(principal: number, annual: number, years: number, perYear = 4): number {
  return r2(principal * (1 + annual / perYear) ** (perYear * years));
}

/** Recurring deposit: each monthly instalment compounds quarterly until maturity (Indian bank convention). */
export function rdMaturity(monthly: number, annual: number, months: number): number {
  let total = 0;
  for (let k = 1; k <= months; k += 1) total += monthly * (1 + annual / 4) ** (4 * (k / 12));
  return r2(total);
}

/** Equal yearly deposits made at the start of each year, compounded yearly (PPF, SSY deposit phase). */
export function annualDepositFutureValue(yearly: number, annual: number, years: number): number {
  if (years <= 0) return 0;
  return r2(yearly * (((1 + annual) ** years - 1) / annual) * (1 + annual));
}

/** PPF: 15-year lock-in, deposits capped at ₹1,50,000 a year. */
export function ppfMaturity(yearly: number, annual: number = DEFAULT_RATES.ppf, years = 15) {
  const deposit = Math.min(Math.max(0, yearly), 150_000);
  const maturity = annualDepositFutureValue(deposit, annual, years);
  return { maturity, invested: deposit * years, interest: r2(maturity - deposit * years) };
}

/** Sukanya Samriddhi: deposits for 15 years, the account matures 21 years after opening. */
export function ssyMaturity(yearly: number, annual: number = DEFAULT_RATES.ssy) {
  const deposit = Math.min(Math.max(250, yearly), 150_000);
  const after15 = annualDepositFutureValue(deposit, annual, 15);
  const maturity = r2(after15 * (1 + annual) ** 6);
  return { maturity, invested: deposit * 15, interest: r2(maturity - deposit * 15) };
}

/** NSC: 5 years, interest compounded yearly and paid at maturity. */
export const nscMaturity = (amount: number, annual: number = DEFAULT_RATES.nsc) => r2(amount * (1 + annual) ** 5);

/** Loan EMI (reducing balance). */
export function emi(principal: number, annual: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const m = annual / 12;
  if (m === 0) return r2(principal / months);
  return r2(principal * m * (1 + m) ** months / ((1 + m) ** months - 1));
}

/** Compound annual growth rate between two values. */
export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || end <= 0 || years <= 0) return Number.NaN;
  return (end / start) ** (1 / years) - 1;
}

/**
 * HRA exemption, section 10(13A), old regime: the least of actual HRA, rent paid minus 10% of salary
 * (basic + DA), and 50% of salary in Delhi, Mumbai, Kolkata or Chennai (40% elsewhere). Monthly figures.
 */
export function hraExemption(basicPlusDa: number, hraReceived: number, rentPaid: number, metro: boolean) {
  const rentLessTenPercent = Math.max(0, rentPaid - 0.1 * basicPlusDa);
  const salaryShare = (metro ? 0.5 : 0.4) * basicPlusDa;
  const exempt = Math.max(0, Math.min(hraReceived, rentLessTenPercent, salaryShare));
  return { exempt: r2(exempt), taxable: r2(Math.max(0, hraReceived - exempt)), limits: { hraReceived, rentLessTenPercent: r2(rentLessTenPercent), salaryShare: r2(salaryShare) } };
}

/**
 * NPS at 60: corpus from monthly contributions; at least 40% must buy an annuity,
 * which pays a monthly pension. The rest can be withdrawn tax-free.
 */
export function npsAtSixty(monthly: number, age: number, annual: number, annuityShare = 0.4, annuityRate: number = DEFAULT_RATES.annuity) {
  const months = Math.max(0, (60 - age) * 12);
  const corpus = r2(sipFutureValue(monthly, annual, months));
  const annuity = corpus * Math.max(0.4, Math.min(1, annuityShare));
  return { corpus, lumpsum: r2(corpus - annuity), monthlyPension: r2((annuity * annuityRate) / 12), invested: monthly * months };
}

export { sipFutureValue, sipForTarget };
