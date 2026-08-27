export type FinancialYear = 'FY2025-26' | 'FY2026-27';
export type TaxRegime = 'new' | 'old' | 'compare';
export type TaxpayerType = 'individual' | 'huf' | 'other';
export type ResidentialStatus = 'resident' | 'rnor' | 'non-resident';
export type AgeCategory = 'below-60' | '60-79' | '80-plus';
export type EmploymentProfile = 'salaried' | 'professional' | 'business' | 'multiple';
export type GstStatus = 'not-registered' | 'registered' | 'composition';
export type TaxCalculationMode = 'estimate' | 'ca-reviewed';
export type DocumentStatus = 'not-added' | 'added' | 'verified' | 'needs-review';
export type TaxRegimeResolved = Exclude<TaxRegime, 'compare'>;

export interface IndianTaxProfile {
  financialYear: FinancialYear;
  taxpayerType: TaxpayerType;
  residentialStatus: ResidentialStatus;
  ageCategory: AgeCategory;
  taxRegime: TaxRegime;
  employmentProfile: EmploymentProfile;
  panAvailable: boolean;
  gstStatus: GstStatus;
  calculationMode: TaxCalculationMode;
  updatedAt: string;
}

export type InvestmentSubtype =
  | 'listed-equity'
  | 'equity-mutual-fund'
  | 'debt-mutual-fund'
  | 'bonds'
  | 'fixed-deposit'
  | 'savings-interest'
  | 'dividend'
  | 'reit-invit'
  | 'gold-sgb'
  | 'vda'
  | 'foreign-stock'
  | 'other-capital-asset';

export interface IncomeTaxDetails {
  amountBasis?: 'gross' | 'net';
  employerName?: string;
  basicSalary?: number;
  hra?: number;
  hraExemption?: number;
  specialAllowance?: number;
  bonus?: number;
  employerNps?: number;
  employerPf?: number;
  professionalTax?: number;
  perquisites?: number;
  tdsDeducted?: number;
  clientName?: string;
  clientType?: 'indian' | 'foreign';
  grossReceipts?: number;
  invoiceDate?: string;
  paymentDate?: string;
  tdsSection?: string;
  businessExpenses?: number;
  gstTreatment?: 'not-applicable' | 'included' | 'excluded';
  presumptiveEligible?: boolean;
  propertyName?: string;
  propertyUse?: 'self-occupied' | 'let-out';
  coOwnedPercent?: number;
  vacancyMonths?: number;
  municipalTaxes?: number;
  homeLoanInterest?: number;
  tenantTds?: number;
  businessName?: string;
  revenue?: number;
  costOfGoods?: number;
  operatingExpenses?: number;
  depreciation?: number;
  gstCollected?: number;
  gstPaid?: number;
  advanceTaxPaid?: number;
  tcsCollected?: number;
  businessLoss?: number;
  investmentSubtype?: InvestmentSubtype;
  symbol?: string;
  buyDate?: string;
  sellDate?: string;
  quantity?: number;
  purchasePrice?: number;
  salePrice?: number;
  transactionCharges?: number;
  stt?: number;
  assetMarket?: 'indian' | 'foreign';
  latestQuote?: number;
  quoteCurrency?: string;
  quoteProvider?: string;
  quoteFreshness?: string;
  quoteTimestamp?: string;
  otherIncomeSubtype?: string;
  taxability?: 'slab' | 'exempt' | 'special' | 'partly-taxable' | 'review';
  specialRatePercent?: number;
  documentStatus?: DocumentStatus;
}

export type DeductionType =
  | '80c'
  | 'health-insurance'
  | 'nps'
  | 'education-loan-interest'
  | 'donations'
  | 'savings-interest'
  | 'home-loan'
  | 'hra'
  | 'other';

export interface TaxDeductionEntry {
  id: string;
  type: DeductionType;
  amount: number;
  description: string;
  status: DocumentStatus;
  createdAt: string;
}

export type TaxCreditType = 'tds' | 'tcs' | 'advance-tax' | 'self-assessment';
export interface TaxCreditEntry {
  id: string;
  type: TaxCreditType;
  source: string;
  amount: number;
  reportedIncome?: number;
  status: 'matched' | 'unmatched' | 'needs-review';
  confidence: 'high' | 'medium' | 'low';
  confirmed: boolean;
  createdAt: string;
}

export interface TaxAuditEvent {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
}

export interface TaxWorkspaceState {
  version: 1;
  profile: IndianTaxProfile;
  deductions: TaxDeductionEntry[];
  credits: TaxCreditEntry[];
  audit: TaxAuditEvent[];
  documents: Record<'form16' | 'form26as' | 'ais' | 'broker' | 'bank', DocumentStatus>;
}

export interface TaxSlab {
  upTo: number | null;
  rate: number;
}

export interface DeductionRule {
  type: DeductionType;
  label: string;
  oldRegime: boolean;
  newRegime: boolean;
  cap: number | null;
  requiresReview?: boolean;
  note: string;
}

export interface IndiaTaxRuleConfig {
  financialYear: FinancialYear;
  assessmentYear: string;
  effectiveFrom: string;
  ruleVersion: string;
  lastVerifiedAt: string;
  verified: boolean;
  officialSourceUrls: string[];
  slabs: {
    new: TaxSlab[];
    old: Record<AgeCategory, TaxSlab[]>;
  };
  rebate: {
    new: { residentOnly: boolean; incomeLimit: number; maximum: number; marginalRelief: boolean };
    old: { residentOnly: boolean; incomeLimit: number; maximum: number };
  };
  standardDeduction: { new: number; old: number };
  housePropertyStandardDeductionRate: number;
  deductions: DeductionRule[];
  surcharge: Array<{ above: number; rate: number; newRate?: number }>;
  cessRate: number;
  capitalGains: {
    listedEquityStcgRate: number;
    listedEquityLtcgRate: number;
    listedEquityLtcgExemption: number;
    listedEquityLongTermMonths: number;
    generalLongTermMonths: number;
    vdaRate: number;
  };
  advanceTaxDueDates: Array<{ date: string; cumulativePercent: number }>;
  notes: string[];
}

export interface TaxCalculationResult {
  financialYear: FinancialYear;
  assessmentYear: string;
  selectedRegime: TaxRegimeResolved;
  grossIncome: string;
  incomeByHead: {
    salary: string;
    houseProperty: string;
    businessProfession: string;
    capitalGains: string;
    otherSources: string;
  };
  exemptions: string;
  deductions: string;
  deductionBreakdown: Array<{
    id: string;
    label: string;
    entered: string;
    eligible: string;
    allowed: string;
    disallowed: string;
    reason: string;
  }>;
  taxableIncome: string;
  slabTax: string;
  rebate: string;
  specialRateTax: string;
  surcharge: string;
  cess: string;
  totalTaxLiability: string;
  tdsCredit: string;
  tcsCredit: string;
  advanceTaxPaid: string;
  selfAssessmentTaxPaid: string;
  remainingTaxPayable: string;
  estimatedRefund: string;
  effectiveTaxRate: string;
  monthlyTaxSetAside: string;
  confidenceScore: number;
  assumptions: string[];
  warnings: string[];
  rulesVersion: string;
  lastVerifiedAt: string;
  officialSourceUrls: string[];
}

export interface TaxRegimeComparison {
  old: TaxCalculationResult;
  new: TaxCalculationResult;
  lowerEstimatedRegime: TaxRegimeResolved | 'same';
  estimatedDifference: string;
}
