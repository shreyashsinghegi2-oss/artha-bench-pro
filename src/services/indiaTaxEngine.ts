import Decimal from 'decimal.js';
import { getIndiaTaxRules } from '../config/taxRules/india';
import { IncomeSource } from './incomeStorage';
import {
  IndiaTaxRuleConfig,
  IndianTaxProfile,
  TaxCalculationResult,
  TaxCreditEntry,
  TaxDeductionEntry,
  TaxRegimeComparison,
  TaxRegimeResolved,
  TaxSlab,
} from '../types/taxTypes';

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

const ZERO = new Decimal(0);
const money = (value: Decimal.Value | undefined | null) => new Decimal(value ?? 0);
const nonNegative = (value: Decimal) => Decimal.max(ZERO, value);
const output = (value: Decimal) => value.toDecimalPlaces(0).toFixed(0);

function annualAmount(source: IncomeSource): Decimal {
  const amount = money(source.amount);
  switch (source.frequency) {
    case 'Monthly': return amount.times(12);
    case 'Quarterly': return amount.times(4);
    case 'Annually': return amount;
    case 'One-time': return amount;
  }
}

function monthsBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate < startDate) return null;
  return (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + endDate.getUTCMonth() - startDate.getUTCMonth();
}

export function calculateGrossIncome(sources: IncomeSource[]): Decimal {
  return sources
    .filter((source) => source.currency.toUpperCase() === 'INR')
    .reduce((total, source) => total.plus(annualAmount(source)), ZERO);
}

export function calculateIncomeFromSalary(
  sources: IncomeSource[],
  regime: TaxRegimeResolved,
  rules: IndiaTaxRuleConfig,
): { gross: Decimal; taxable: Decimal; exemptions: Decimal; tds: Decimal } {
  const salarySources = sources.filter((source) => source.type === 'Salary' && source.currency.toUpperCase() === 'INR' && source.taxStatus !== 'Tax-free');
  const gross = salarySources.reduce((sum, source) => sum.plus(annualAmount(source)), ZERO);
  const hraExemption = regime === 'old'
    ? salarySources.reduce((sum, source) => sum.plus(money(source.taxDetails?.hraExemption)), ZERO)
    : ZERO;
  const professionalTax = regime === 'old'
    ? salarySources.reduce((sum, source) => sum.plus(money(source.taxDetails?.professionalTax)), ZERO)
    : ZERO;
  const standardDeduction = Decimal.min(gross, money(rules.standardDeduction[regime]));
  const tds = salarySources.reduce((sum, source) => sum.plus(money(source.taxDetails?.tdsDeducted)), ZERO);
  return {
    gross,
    taxable: nonNegative(gross.minus(hraExemption).minus(professionalTax).minus(standardDeduction)),
    exemptions: hraExemption.plus(standardDeduction).plus(professionalTax),
    tds,
  };
}

export function calculateIncomeFromHouseProperty(
  sources: IncomeSource[],
  rules: IndiaTaxRuleConfig,
  regime: TaxRegimeResolved = 'old',
): { taxable: Decimal; tds: Decimal; warnings: string[] } {
  let taxable = ZERO;
  let tds = ZERO;
  const warnings: string[] = [];
  for (const source of sources.filter((item) => item.type === 'Rental' && item.currency.toUpperCase() === 'INR' && item.taxStatus !== 'Tax-free')) {
    if (source.taxDetails?.propertyUse === 'self-occupied') {
      if (money(source.taxDetails.homeLoanInterest).gt(0)) warnings.push('Self-occupied home-loan interest needs regime-specific professional review.');
      continue;
    }
    const ownership = Decimal.min(100, Decimal.max(0, money(source.taxDetails?.coOwnedPercent ?? 100))).div(100);
    const rent = annualAmount(source);
    const municipalTaxes = money(source.taxDetails?.municipalTaxes);
    const netAnnualValue = nonNegative(rent.minus(municipalTaxes));
    const statutoryDeduction = netAnnualValue.times(rules.housePropertyStandardDeductionRate);
    const interest = money(source.taxDetails?.homeLoanInterest);
    taxable = taxable.plus(netAnnualValue.minus(statutoryDeduction).minus(interest).times(ownership));
    tds = tds.plus(money(source.taxDetails?.tenantTds).times(ownership));
  }
  if (regime === 'new' && taxable.lt(0)) {
    warnings.push('House-property loss is not set off against other income under the new regime in this estimate.');
    taxable = ZERO;
  }
  return { taxable, tds, warnings };
}

export function calculateBusinessOrProfessionalIncome(
  sources: IncomeSource[],
): { taxable: Decimal; tds: Decimal; tcs: Decimal; advanceTax: Decimal; warnings: string[] } {
  let taxable = ZERO;
  let tds = ZERO;
  let tcs = ZERO;
  let advanceTax = ZERO;
  const warnings: string[] = [];
  for (const source of sources.filter((item) => ['Freelance', 'Business'].includes(item.type) && item.currency.toUpperCase() === 'INR' && item.taxStatus !== 'Tax-free')) {
    const details = source.taxDetails;
    const gross = source.type === 'Business'
      ? money(details?.revenue || annualAmount(source))
      : money(details?.grossReceipts || annualAmount(source));
    const expenses = source.type === 'Business'
      ? money(details?.costOfGoods).plus(money(details?.operatingExpenses)).plus(money(details?.depreciation))
      : money(details?.businessExpenses);
    taxable = taxable.plus(gross.minus(expenses));
    tds = tds.plus(money(details?.tdsDeducted));
    tcs = tcs.plus(money(details?.tcsCollected));
    advanceTax = advanceTax.plus(money(details?.advanceTaxPaid));
    if (details?.presumptiveEligible) warnings.push('Presumptive-tax eligibility is recorded but not automatically applied; verify conditions with a CA.');
    if (details?.gstTreatment === 'included' || money(details?.gstCollected).gt(0)) warnings.push('GST is shown separately and is not deducted automatically from income-tax gross receipts.');
  }
  return { taxable, tds, tcs, advanceTax, warnings };
}

export function calculateCapitalGains(
  sources: IncomeSource[],
  rules: IndiaTaxRuleConfig,
): { normalRateGain: Decimal; totalGain: Decimal; specialRateTax: Decimal; warnings: string[] } {
  let normalRateGain = ZERO;
  let totalGain = ZERO;
  let listedEquityLtcg = ZERO;
  let listedEquityStcg = ZERO;
  let vdaGain = ZERO;
  let otherSpecialTax = ZERO;
  const warnings: string[] = [];

  for (const source of sources.filter((item) => item.type === 'Investment Returns' && item.currency.toUpperCase() === 'INR' && item.taxStatus !== 'Tax-free')) {
    const details = source.taxDetails;
    const subtype = details?.investmentSubtype;
    if (['fixed-deposit', 'savings-interest', 'dividend', 'bonds'].includes(subtype ?? '')) continue;
    const hasTransaction = money(details?.quantity).gt(0) && money(details?.salePrice).gt(0);
    const gain = hasTransaction
      ? money(details?.salePrice).minus(money(details?.purchasePrice)).times(money(details?.quantity)).minus(money(details?.transactionCharges))
      : annualAmount(source);
    if (gain.lte(0)) {
      warnings.push('Capital loss set-off and carry-forward are not automated; the loss is excluded from this estimate.');
      continue;
    }
    totalGain = totalGain.plus(gain);

    if (subtype === 'vda') {
      vdaGain = vdaGain.plus(gain);
      warnings.push('VDA income uses the configured 30% rate; VDA loss set-off is not permitted in this estimate.');
      continue;
    }
    if (subtype === 'listed-equity' || subtype === 'equity-mutual-fund' || subtype === 'reit-invit') {
      const heldMonths = monthsBetween(details?.buyDate, details?.sellDate);
      if (heldMonths === null) {
        warnings.push('Listed-equity holding period is missing; the gain is marked for review and taxed at the short-term configured rate.');
        listedEquityStcg = listedEquityStcg.plus(gain);
      } else if (heldMonths >= rules.capitalGains.listedEquityLongTermMonths) {
        listedEquityLtcg = listedEquityLtcg.plus(gain);
      } else {
        listedEquityStcg = listedEquityStcg.plus(gain);
      }
      continue;
    }
    if (details?.taxability === 'special' && money(details.specialRatePercent).gt(0)) {
      otherSpecialTax = otherSpecialTax.plus(gain.times(money(details.specialRatePercent).div(100)));
      warnings.push('A user-entered special rate was used; confirm the classification before filing.');
    } else {
      normalRateGain = normalRateGain.plus(gain);
      if (['foreign-stock', 'gold-sgb', 'debt-mutual-fund', 'other-capital-asset'].includes(subtype ?? '')) {
        warnings.push('Foreign, gold/SGB, debt-fund and other-asset classifications require professional review.');
      }
    }
  }

  const taxableLtcg = nonNegative(listedEquityLtcg.minus(rules.capitalGains.listedEquityLtcgExemption));
  const specialRateTax = listedEquityStcg.times(rules.capitalGains.listedEquityStcgRate)
    .plus(taxableLtcg.times(rules.capitalGains.listedEquityLtcgRate))
    .plus(vdaGain.times(rules.capitalGains.vdaRate))
    .plus(otherSpecialTax);
  return { normalRateGain, totalGain, specialRateTax, warnings };
}

export function calculateIncomeFromOtherSources(sources: IncomeSource[]): { taxable: Decimal; exempt: Decimal; specialRateTax: Decimal; warnings: string[] } {
  let taxable = ZERO;
  let exempt = ZERO;
  let specialRateTax = ZERO;
  const warnings: string[] = [];
  for (const source of sources.filter((item) => ['Other', 'Investment Returns'].includes(item.type) && item.currency.toUpperCase() === 'INR')) {
    const details = source.taxDetails;
    const investmentInterest = source.type === 'Investment Returns' && ['fixed-deposit', 'savings-interest', 'dividend', 'bonds'].includes(details?.investmentSubtype ?? '');
    if (source.type === 'Investment Returns' && !investmentInterest) continue;
    const value = annualAmount(source);
    if (source.taxStatus === 'Tax-free' || details?.taxability === 'exempt') exempt = exempt.plus(value);
    else if (details?.taxability === 'special' && money(details.specialRatePercent).gt(0)) specialRateTax = specialRateTax.plus(value.times(money(details.specialRatePercent).div(100)));
    else if (details?.taxability === 'review' || details?.taxability === 'partly-taxable') {
      warnings.push(`${source.description} needs taxability review and is conservatively included at slab rate.`);
      taxable = taxable.plus(value);
    } else taxable = taxable.plus(value);
  }
  return { taxable, exempt, specialRateTax, warnings };
}

export function calculateDeductions(
  entries: TaxDeductionEntry[],
  profile: IndianTaxProfile,
  regime: TaxRegimeResolved,
  rules: IndiaTaxRuleConfig,
): { total: Decimal; breakdown: TaxCalculationResult['deductionBreakdown']; warnings: string[] } {
  let total = ZERO;
  const warnings: string[] = [];
  const breakdown = entries.map((entry) => {
    const rule = rules.deductions.find((item) => item.type === entry.type);
    const entered = nonNegative(money(entry.amount));
    const regimeAllowed = rule ? (regime === 'old' ? rule.oldRegime : rule.newRegime) : false;
    let cap = rule?.cap === null || rule?.cap === undefined ? entered : money(rule.cap);
    if (entry.type === 'health-insurance' && profile.ageCategory !== 'below-60') cap = money(50_000);
    if (entry.type === 'savings-interest' && profile.ageCategory !== 'below-60') cap = money(50_000);
    const evidenceReady = entry.status === 'verified' || entry.status === 'added';
    const allowed = regimeAllowed && evidenceReady && !rule?.requiresReview ? Decimal.min(entered, cap) : ZERO;
    const reason = !rule
      ? 'No configured rule.'
      : !regimeAllowed
        ? `Not configured as available under the ${regime} regime.`
        : !evidenceReady
          ? 'Document/evidence status is not added.'
          : rule.requiresReview
            ? 'Needs professional review before it can reduce the estimate.'
            : rule.note;
    if (rule?.requiresReview && entered.gt(0)) warnings.push(`${rule.label} is recorded but not deducted because its eligibility needs review.`);
    total = total.plus(allowed);
    return {
      id: entry.id,
      label: rule?.label ?? entry.description,
      entered: output(entered),
      eligible: output(regimeAllowed ? entered : ZERO),
      allowed: output(allowed),
      disallowed: output(entered.minus(allowed)),
      reason,
    };
  });
  return { total, breakdown, warnings };
}

export function calculateTaxableIncome(normalIncome: Decimal, deductions: Decimal): Decimal {
  return nonNegative(normalIncome.minus(deductions));
}

export function calculateSlabTax(taxableIncome: Decimal, slabs: TaxSlab[]): Decimal {
  let tax = ZERO;
  let lower = ZERO;
  for (const slab of slabs) {
    const upper = slab.upTo === null ? taxableIncome : Decimal.min(taxableIncome, slab.upTo);
    const band = nonNegative(upper.minus(lower));
    tax = tax.plus(band.times(slab.rate));
    if (slab.upTo === null || taxableIncome.lte(slab.upTo)) break;
    lower = money(slab.upTo);
  }
  return tax;
}

export function calculateSpecialRateTax(value: Decimal): Decimal { return nonNegative(value); }

export function calculateSurcharge(
  totalIncome: Decimal,
  taxAfterRebate: Decimal,
  regime: TaxRegimeResolved,
  rules: IndiaTaxRuleConfig,
): Decimal {
  const bracket = rules.surcharge.find((item) => totalIncome.gt(item.above));
  if (!bracket) return ZERO;
  return taxAfterRebate.times(regime === 'new' && bracket.newRate !== undefined ? bracket.newRate : bracket.rate);
}

export function calculateCess(taxAndSurcharge: Decimal, rules: IndiaTaxRuleConfig): Decimal {
  return taxAndSurcharge.times(rules.cessRate);
}

export function calculateTdsTcsCredit(credits: TaxCreditEntry[], type: 'tds' | 'tcs'): Decimal {
  return credits.filter((credit) => credit.confirmed && credit.type === type).reduce((sum, credit) => sum.plus(money(credit.amount)), ZERO);
}

export function calculateAdvanceTaxPaid(credits: TaxCreditEntry[]): Decimal {
  return credits.filter((credit) => credit.confirmed && credit.type === 'advance-tax').reduce((sum, credit) => sum.plus(money(credit.amount)), ZERO);
}

export function calculateFinalEstimatedTax(totalLiability: Decimal, credits: Decimal): { payable: Decimal; refund: Decimal } {
  const balance = totalLiability.minus(credits);
  return { payable: nonNegative(balance), refund: nonNegative(balance.negated()) };
}

function calculateForRegime(
  sources: IncomeSource[],
  profile: IndianTaxProfile,
  deductions: TaxDeductionEntry[],
  credits: TaxCreditEntry[],
  regime: TaxRegimeResolved,
): TaxCalculationResult {
  const rules = getIndiaTaxRules(profile.financialYear);
  const warnings: string[] = [];
  const assumptions = [...rules.notes];
  const salary = calculateIncomeFromSalary(sources, regime, rules);
  const house = calculateIncomeFromHouseProperty(sources, rules, regime);
  const business = calculateBusinessOrProfessionalIncome(sources);
  const capital = calculateCapitalGains(sources, rules);
  const other = calculateIncomeFromOtherSources(sources);
  const deduction = calculateDeductions(deductions, profile, regime, rules);
  const taxFreeSources = sources
    .filter((source) => source.taxStatus === 'Tax-free' && source.currency.toUpperCase() === 'INR')
    .filter((source) => {
      if (source.type === 'Other') return false;
      if (source.type !== 'Investment Returns') return true;
      return !['fixed-deposit', 'savings-interest', 'dividend', 'bonds'].includes(source.taxDetails?.investmentSubtype ?? '');
    })
    .reduce((sum, source) => sum.plus(annualAmount(source)), ZERO);
  const exemptions = salary.exemptions.plus(other.exempt).plus(taxFreeSources);
  const normalIncome = salary.taxable.plus(house.taxable).plus(business.taxable).plus(capital.normalRateGain).plus(other.taxable);
  const taxableIncome = calculateTaxableIncome(normalIncome, deduction.total);
  const oldRegimeAgeCategory = profile.taxpayerType === 'individual' ? profile.ageCategory : 'below-60';
  const slabs = regime === 'new' ? rules.slabs.new : rules.slabs.old[oldRegimeAgeCategory];
  const slabTaxBeforeRebate = calculateSlabTax(taxableIncome, slabs);
  const specialRateTax = calculateSpecialRateTax(capital.specialRateTax.plus(other.specialRateTax));
  const specialRateCapitalGain = nonNegative(capital.totalGain.minus(capital.normalRateGain));
  const taxableTotal = taxableIncome.plus(specialRateCapitalGain);
  const residentIndividual = profile.taxpayerType === 'individual' && profile.residentialStatus === 'resident';
  const rebateRule = rules.rebate[regime];
  let rebate = ZERO;
  if (residentIndividual && taxableTotal.lte(rebateRule.incomeLimit)) {
    rebate = Decimal.min(slabTaxBeforeRebate, rebateRule.maximum);
  } else if (regime === 'new' && residentIndividual && rules.rebate.new.marginalRelief && taxableTotal.gt(rules.rebate.new.incomeLimit)) {
    const excess = taxableTotal.minus(rules.rebate.new.incomeLimit);
    rebate = nonNegative(slabTaxBeforeRebate.minus(excess));
  }
  const slabTax = nonNegative(slabTaxBeforeRebate.minus(rebate));
  const taxBeforeSurcharge = slabTax.plus(specialRateTax);
  const surcharge = calculateSurcharge(taxableTotal, taxBeforeSurcharge, regime, rules);
  const cess = calculateCess(taxBeforeSurcharge.plus(surcharge), rules);
  const totalTaxLiability = taxBeforeSurcharge.plus(surcharge).plus(cess);

  const manualTds = calculateTdsTcsCredit(credits, 'tds');
  const manualTcs = calculateTdsTcsCredit(credits, 'tcs');
  const embeddedTds = salary.tds.plus(house.tds).plus(business.tds);
  const tdsCredit = manualTds.plus(embeddedTds);
  const tcsCredit = manualTcs.plus(business.tcs);
  const advanceTaxPaid = calculateAdvanceTaxPaid(credits).plus(business.advanceTax);
  const selfAssessmentTaxPaid = credits.filter((credit) => credit.confirmed && credit.type === 'self-assessment').reduce((sum, credit) => sum.plus(money(credit.amount)), ZERO);
  const totalCredits = tdsCredit.plus(tcsCredit).plus(advanceTaxPaid).plus(selfAssessmentTaxPaid);
  const finalTax = calculateFinalEstimatedTax(totalTaxLiability, totalCredits);
  const grossIncome = calculateGrossIncome(sources);
  const effectiveRate = grossIncome.gt(0) ? totalTaxLiability.div(grossIncome).times(100) : ZERO;

  warnings.push(...house.warnings, ...business.warnings, ...capital.warnings, ...other.warnings, ...deduction.warnings);
  if (!sources.length) warnings.push('Add at least one income source to calculate an estimate.');
  if (sources.some((source) => source.currency.toUpperCase() !== 'INR')) warnings.push('Non-INR sources are excluded until an evidenced FX conversion is available.');
  if (!profile.panAvailable) warnings.push('PAN is marked unavailable; higher withholding or other consequences may apply.');
  if (profile.taxpayerType === 'other') warnings.push('Taxpayer type “Other” may follow different rules; this estimate is not filing-ready.');
  if (profile.residentialStatus !== 'resident') warnings.push('RNOR/non-resident scope and foreign-income rules require professional review.');
  if (surcharge.gt(0)) warnings.push('Surcharge is estimated without automated marginal relief; verify professionally.');
  if (specialRateTax.gt(0)) warnings.push('Special-rate income is separated from slab-rate income; rebate interaction may require review.');
  if (embeddedTds.plus(business.tcs).gt(0)) assumptions.push('TDS/TCS entered inside an income record is treated as user-confirmed tax credit.');

  let confidenceScore = 100;
  if (!sources.length) confidenceScore -= 45;
  if (warnings.some((warning) => warning.includes('review'))) confidenceScore -= 15;
  if (profile.residentialStatus !== 'resident' || profile.taxpayerType === 'other') confidenceScore -= 20;
  if (credits.some((credit) => !credit.confirmed)) confidenceScore -= 10;
  if (deductions.some((entry) => entry.status === 'not-added')) confidenceScore -= 10;

  return {
    financialYear: profile.financialYear,
    assessmentYear: rules.assessmentYear,
    selectedRegime: regime,
    grossIncome: output(grossIncome),
    incomeByHead: {
      salary: output(salary.taxable),
      houseProperty: output(house.taxable),
      businessProfession: output(business.taxable),
      capitalGains: output(capital.totalGain),
      otherSources: output(other.taxable),
    },
    exemptions: output(exemptions),
    deductions: output(deduction.total),
    deductionBreakdown: deduction.breakdown,
    taxableIncome: output(taxableTotal),
    slabTax: output(slabTax),
    rebate: output(rebate),
    specialRateTax: output(specialRateTax),
    surcharge: output(surcharge),
    cess: output(cess),
    totalTaxLiability: output(totalTaxLiability),
    tdsCredit: output(tdsCredit),
    tcsCredit: output(tcsCredit),
    advanceTaxPaid: output(advanceTaxPaid),
    selfAssessmentTaxPaid: output(selfAssessmentTaxPaid),
    remainingTaxPayable: output(finalTax.payable),
    estimatedRefund: output(finalTax.refund),
    effectiveTaxRate: effectiveRate.toDecimalPlaces(2).toFixed(2),
    monthlyTaxSetAside: output(finalTax.payable.div(12)),
    confidenceScore: Math.max(0, confidenceScore),
    assumptions,
    warnings: [...new Set(warnings)],
    rulesVersion: rules.ruleVersion,
    lastVerifiedAt: rules.lastVerifiedAt,
    officialSourceUrls: rules.officialSourceUrls,
  };
}

export function compareTaxRegimes(
  sources: IncomeSource[],
  profile: IndianTaxProfile,
  deductions: TaxDeductionEntry[],
  credits: TaxCreditEntry[],
): TaxRegimeComparison {
  const oldResult = calculateForRegime(sources, profile, deductions, credits, 'old');
  const newResult = calculateForRegime(sources, profile, deductions, credits, 'new');
  const oldTax = money(oldResult.totalTaxLiability);
  const newTax = money(newResult.totalTaxLiability);
  return {
    old: oldResult,
    new: newResult,
    lowerEstimatedRegime: oldTax.eq(newTax) ? 'same' : oldTax.lt(newTax) ? 'old' : 'new',
    estimatedDifference: output(oldTax.minus(newTax).abs()),
  };
}

export function calculateIndiaTaxEstimate(
  sources: IncomeSource[],
  profile: IndianTaxProfile,
  deductions: TaxDeductionEntry[],
  credits: TaxCreditEntry[],
): TaxCalculationResult {
  const selected = profile.taxRegime === 'old' ? 'old' : 'new';
  return calculateForRegime(sources, profile, deductions, credits, selected);
}
