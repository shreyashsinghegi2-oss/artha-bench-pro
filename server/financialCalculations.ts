import { Decimal } from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

function positive(value: number, name: string) { if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be greater than zero.`); return new Decimal(value); }
function nonNegative(value: number, name: string) { if (!Number.isFinite(value) || value < 0) throw new Error(`${name} cannot be negative.`); return new Decimal(value); }
function rounded(value: Decimal) { return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(); }

export function calculateEMI(principal: number, annualRatePercent: number, years: number) {
  const P = positive(principal, 'Loan amount');
  const annual = nonNegative(annualRatePercent, 'Annual interest rate');
  const t = positive(years, 'Loan tenure');
  const n = Math.round(t.toNumber() * 12);
  if (n < 1) throw new Error('Loan tenure must produce at least one monthly payment.');
  const r = annual.div(100).div(12);
  const emi = r.isZero() ? P.div(n) : P.times(r).times(new Decimal(1).plus(r).pow(n)).div(new Decimal(1).plus(r).pow(n).minus(1));
  const monthly = rounded(emi);
  return { principal: P.toNumber(), annualRatePercent: annual.toNumber(), years: t.toNumber(), payments: n, monthlyRatePercent: rounded(r.times(100)), emi: monthly, totalPayments: rounded(new Decimal(monthly).times(n)), totalInterest: rounded(new Decimal(monthly).times(n).minus(P)) };
}

export function calculateEmergencyFund(monthlyExpenses: number, months: number) {
  const expenses = nonNegative(monthlyExpenses, 'Monthly expenses');
  const targetMonths = positive(months, 'Target months');
  return { monthlyExpenses: rounded(expenses), targetMonths: targetMonths.toNumber(), targetAmount: rounded(expenses.times(targetMonths)) };
}

export function calculateBudget503020(monthlyIncome: number) {
  const income = nonNegative(monthlyIncome, 'Monthly income');
  return { monthlyIncome: rounded(income), needs: rounded(income.times('.50')), wants: rounded(income.times('.30')), savingsAndDebt: rounded(income.times('.20')) };
}

export function calculateSavingsTarget(targetAmount: number, months: number) {
  const target = positive(targetAmount, 'Target amount');
  const period = positive(months, 'Target months');
  return { targetAmount: rounded(target), months: period.toNumber(), requiredMonthlySaving: rounded(target.div(period)) };
}
