import {
  DocumentStatus,
  IndianTaxProfile,
  TaxAuditEvent,
  TaxCreditEntry,
  TaxDeductionEntry,
  TaxWorkspaceState,
} from '../types/taxTypes';

export const TAX_WORKSPACE_STORAGE_KEY = 'artha_india_tax_workspace_v1';

export const createDefaultTaxProfile = (): IndianTaxProfile => ({
  financialYear: 'FY2026-27',
  taxpayerType: 'individual',
  residentialStatus: 'resident',
  ageCategory: 'below-60',
  taxRegime: 'compare',
  employmentProfile: 'multiple',
  panAvailable: true,
  gstStatus: 'not-registered',
  calculationMode: 'estimate',
  updatedAt: new Date().toISOString(),
});

export const createDefaultTaxWorkspace = (): TaxWorkspaceState => ({
  version: 1,
  profile: createDefaultTaxProfile(),
  deductions: [],
  credits: [],
  audit: [],
  documents: {
    form16: 'not-added',
    form26as: 'not-added',
    ais: 'not-added',
    broker: 'not-added',
    bank: 'not-added',
  },
});

const isBrowser = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export function loadTaxWorkspace(): TaxWorkspaceState {
  const fallback = createDefaultTaxWorkspace();
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(TAX_WORKSPACE_STORAGE_KEY);
    if (!raw) return fallback;
    const value = JSON.parse(raw) as Partial<TaxWorkspaceState>;
    if (value.version !== 1 || !value.profile || !Array.isArray(value.deductions) || !Array.isArray(value.credits)) {
      return fallback;
    }
    return {
      ...fallback,
      ...value,
      documents: { ...fallback.documents, ...(value.documents ?? {}) },
      audit: Array.isArray(value.audit) ? value.audit.slice(0, 100) : [],
    };
  } catch {
    return fallback;
  }
}

export function saveTaxWorkspace(workspace: TaxWorkspaceState): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(TAX_WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

export function createAuditEvent(action: string, detail: string): TaxAuditEvent {
  return { id: crypto.randomUUID(), timestamp: new Date().toISOString(), action, detail };
}

export function createDeduction(
  type: TaxDeductionEntry['type'],
  amount: number,
  description: string,
  status: DocumentStatus = 'not-added',
): TaxDeductionEntry {
  return { id: crypto.randomUUID(), type, amount, description, status, createdAt: new Date().toISOString() };
}

export function createTaxCredit(input: Omit<TaxCreditEntry, 'id' | 'createdAt'>): TaxCreditEntry {
  return { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
}
