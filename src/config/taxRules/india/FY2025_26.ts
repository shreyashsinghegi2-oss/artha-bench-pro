import { IndiaTaxRuleConfig } from '../../../types/taxTypes';

const newSlabs = [
  { upTo: 400_000, rate: 0 },
  { upTo: 800_000, rate: 0.05 },
  { upTo: 1_200_000, rate: 0.1 },
  { upTo: 1_600_000, rate: 0.15 },
  { upTo: 2_000_000, rate: 0.2 },
  { upTo: 2_400_000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
] as const;

const oldBelow60 = [
  { upTo: 250_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
] as const;

export const FY2025_26_RULES: IndiaTaxRuleConfig = {
  financialYear: 'FY2025-26',
  assessmentYear: 'AY 2026-27',
  effectiveFrom: '2025-04-01',
  ruleVersion: 'india-fy2025-26-v1.0.0',
  lastVerifiedAt: '2026-08-27',
  verified: true,
  officialSourceUrls: [
    'https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1',
    'https://www.incometaxindia.gov.in/w/tax-rates%E2%80%8B',
    'https://www.incometaxindia.gov.in/w/deductions-allowable-to-tax-payer',
    'https://www.incometaxindia.gov.in/w/tax-on-short-term-capital-gains%E2%80%8B',
    'https://www.incometaxindia.gov.in/w/tax-on-long-term-capital-gains%E2%80%8B',
    'https://www.incometaxindia.gov.in/w/schedule_vda',
  ],
  slabs: {
    new: [...newSlabs],
    old: {
      'below-60': [...oldBelow60],
      '60-79': [
        { upTo: 300_000, rate: 0 },
        { upTo: 500_000, rate: 0.05 },
        { upTo: 1_000_000, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ],
      '80-plus': [
        { upTo: 500_000, rate: 0 },
        { upTo: 1_000_000, rate: 0.2 },
        { upTo: null, rate: 0.3 },
      ],
    },
  },
  rebate: {
    new: { residentOnly: true, incomeLimit: 1_200_000, maximum: 60_000, marginalRelief: true },
    old: { residentOnly: true, incomeLimit: 500_000, maximum: 12_500 },
  },
  standardDeduction: { new: 75_000, old: 50_000 },
  housePropertyStandardDeductionRate: 0.3,
  deductions: [
    { type: '80c', label: 'Section 80C-type investments', oldRegime: true, newRegime: false, cap: 150_000, note: 'Subject to the combined statutory limit and evidence.' },
    { type: 'health-insurance', label: 'Health insurance', oldRegime: true, newRegime: false, cap: 25_000, note: 'Base cap; age and insured-person conditions can change eligibility.' },
    { type: 'nps', label: 'Additional NPS contribution', oldRegime: true, newRegime: false, cap: 50_000, note: 'Self-contribution entry; employer contribution is handled separately.' },
    { type: 'education-loan-interest', label: 'Education-loan interest', oldRegime: true, newRegime: false, cap: null, requiresReview: true, note: 'Allowed amount depends on statutory period and evidence.' },
    { type: 'savings-interest', label: 'Savings/deposit interest deduction', oldRegime: true, newRegime: false, cap: 10_000, note: 'Senior-citizen provisions may permit a different cap.' },
    { type: 'donations', label: 'Eligible donations', oldRegime: true, newRegime: false, cap: null, requiresReview: true, note: 'Percentage and qualifying-limit rules require evidence review.' },
    { type: 'home-loan', label: 'Home-loan deduction', oldRegime: true, newRegime: false, cap: null, requiresReview: true, note: 'Property use and loss-set-off rules require review.' },
    { type: 'hra', label: 'HRA exemption', oldRegime: true, newRegime: false, cap: null, requiresReview: true, note: 'Requires rent, salary and metro/non-metro inputs.' },
    { type: 'other', label: 'Other deduction', oldRegime: true, newRegime: false, cap: null, requiresReview: true, note: 'Not included until a supported rule is selected.' },
  ],
  surcharge: [
    { above: 50_000_000, rate: 0.37, newRate: 0.25 },
    { above: 20_000_000, rate: 0.25 },
    { above: 10_000_000, rate: 0.15 },
    { above: 5_000_000, rate: 0.1 },
  ],
  cessRate: 0.04,
  capitalGains: {
    listedEquityStcgRate: 0.2,
    listedEquityLtcgRate: 0.125,
    listedEquityLtcgExemption: 125_000,
    listedEquityLongTermMonths: 12,
    generalLongTermMonths: 24,
    vdaRate: 0.3,
  },
  advanceTaxDueDates: [
    { date: '15 June', cumulativePercent: 15 },
    { date: '15 September', cumulativePercent: 45 },
    { date: '15 December', cumulativePercent: 75 },
    { date: '15 March', cumulativePercent: 100 },
  ],
  notes: [
    'GST is excluded from this income-tax estimate.',
    'Marginal relief for surcharge is not automated and requires review.',
    'Special-rate income can restrict rebate and deduction benefits.',
  ],
};
