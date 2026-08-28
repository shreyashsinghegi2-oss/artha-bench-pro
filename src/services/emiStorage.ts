import Decimal from 'decimal.js';

export const EMI_STORAGE_KEY = 'artha_emi_records_v1';

export type EmiStatus = 'active' | 'closed';
export type PaymentFrequency = 'monthly';

export interface EmiPaymentRecord {
  id: string;
  dueDate: string;
  paidAt: string;
  amount: number;
  estimatedPrincipal: number | null;
  estimatedInterest: number | null;
}

export interface EmiRecord {
  id: string;
  name: string;
  lender: string;
  originalLoanAmount: number | null;
  outstandingBalance: number | null;
  annualInterestRate: number | null;
  emiAmount: number | null;
  startDate: string;
  nextDueDate: string;
  tenureMonths: number | null;
  remainingInstallments: number | null;
  paymentFrequency: PaymentFrequency;
  notes: string;
  status: EmiStatus;
  payments: EmiPaymentRecord[];
  createdAt: string;
  updatedAt: string;
}

export type EmiDraft = Omit<EmiRecord, 'id' | 'payments' | 'createdAt' | 'updatedAt'>;

interface EmiEnvelope {
  version: 1;
  records: EmiRecord[];
}

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

function validOptionalNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

export function loadEmiRecords(): EmiRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(EMI_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<EmiEnvelope>;
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) return [];
    return parsed.records.filter((record) =>
      Boolean(record) && typeof record.id === 'string' && typeof record.name === 'string' &&
      validOptionalNumber(record.originalLoanAmount) && validOptionalNumber(record.outstandingBalance) &&
      validOptionalNumber(record.annualInterestRate) && validOptionalNumber(record.emiAmount) &&
      validOptionalNumber(record.tenureMonths) && validOptionalNumber(record.remainingInstallments) &&
      Array.isArray(record.payments)
    );
  } catch {
    return [];
  }
}

export function saveEmiRecords(records: EmiRecord[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(EMI_STORAGE_KEY, JSON.stringify({ version: 1, records } satisfies EmiEnvelope));
}

export function saveEmiDraft(draft: EmiDraft, existing?: EmiRecord): EmiRecord {
  const now = new Date().toISOString();
  return {
    ...draft,
    name: draft.name.trim(),
    lender: draft.lender.trim(),
    notes: draft.notes.trim(),
    id: existing?.id ?? crypto.randomUUID(),
    payments: existing?.payments ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function addMonth(isoDate: string): string {
  const source = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(source.getTime())) return isoDate;
  const day = source.getUTCDate();
  const targetYear = source.getUTCFullYear() + (source.getUTCMonth() === 11 ? 1 : 0);
  const targetMonth = (source.getUTCMonth() + 1) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function estimateEmiSplit(record: EmiRecord): { principal: number | null; interest: number | null } {
  if (record.emiAmount == null || record.outstandingBalance == null || record.annualInterestRate == null) return { principal: null, interest: null };
  const monthlyRate = new Decimal(record.annualInterestRate).div(1200);
  const interest = new Decimal(record.outstandingBalance).times(monthlyRate);
  const principal = Decimal.max(0, new Decimal(record.emiAmount).minus(interest));
  return { principal: principal.toDecimalPlaces(2).toNumber(), interest: interest.toDecimalPlaces(2).toNumber() };
}

export function markNextEmiPaid(record: EmiRecord): EmiRecord {
  if (record.status !== 'active' || !record.nextDueDate || record.emiAmount == null || record.emiAmount <= 0) return record;
  const now = new Date().toISOString();
  const split = estimateEmiSplit(record);
  const nextOutstanding = record.outstandingBalance == null || split.principal == null
    ? record.outstandingBalance
    : Decimal.max(0, new Decimal(record.outstandingBalance).minus(split.principal)).toDecimalPlaces(2).toNumber();
  const nextRemaining = record.remainingInstallments == null ? null : Math.max(0, record.remainingInstallments - 1);
  const closed = nextRemaining === 0 || nextOutstanding === 0;
  const payment: EmiPaymentRecord = {
    id: crypto.randomUUID(),
    dueDate: record.nextDueDate,
    paidAt: now,
    amount: record.emiAmount,
    estimatedPrincipal: split.principal,
    estimatedInterest: split.interest,
  };
  return {
    ...record,
    outstandingBalance: nextOutstanding,
    remainingInstallments: nextRemaining,
    nextDueDate: closed ? record.nextDueDate : addMonth(record.nextDueDate),
    status: closed ? 'closed' : record.status,
    payments: [payment, ...record.payments],
    updatedAt: now,
  };
}

export interface EmiScheduleRow {
  dueDate: string;
  amount: number | null;
  estimatedPrincipal: number | null;
  estimatedInterest: number | null;
}

export function buildEmiSchedule(record: EmiRecord, count = 6): EmiScheduleRow[] {
  if (!record.nextDueDate || record.status !== 'active') return [];
  const rows: EmiScheduleRow[] = [];
  let date = record.nextDueDate;
  let outstanding = record.outstandingBalance;
  const installments = record.remainingInstallments == null ? count : Math.min(count, record.remainingInstallments);
  for (let index = 0; index < Math.max(1, installments); index += 1) {
    const temp = { ...record, outstandingBalance: outstanding };
    const split = estimateEmiSplit(temp);
    rows.push({ dueDate: date, amount: record.emiAmount, estimatedPrincipal: split.principal, estimatedInterest: split.interest });
    if (outstanding != null && split.principal != null) outstanding = Decimal.max(0, new Decimal(outstanding).minus(split.principal)).toDecimalPlaces(2).toNumber();
    date = addMonth(date);
  }
  return rows;
}

export function daysFromToday(isoDate: string): number | null {
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  if (!isoDate || Number.isNaN(target)) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((target - todayUtc) / 86_400_000);
}
