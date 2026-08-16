import { z } from 'zod';

export const CompoundInterestSchema = z.object({
  principal: z.number().min(0, 'Principal must be non-negative'),
  annualRatePercent: z.number().min(0, 'Annual rate must be non-negative').max(500, 'Annual rate exceeds maximum threshold'),
  years: z.number().min(0.01, 'Years must be greater than zero').max(100, 'Years exceeds 100 year horizon'),
  monthlyContribution: z.number().min(0, 'Monthly contribution must be non-negative').optional().default(0),
  compoundingFrequencyPerYear: z.number().int().min(1, 'Compounding frequency must be at least 1').max(365, 'Compounding frequency max 365').optional().default(12),
});

export const QuickRatioSchema = z.object({
  cash: z.number().min(0, 'Cash must be non-negative'),
  marketableSecurities: z.number().min(0, 'Marketable securities must be non-negative'),
  receivables: z.number().min(0, 'Receivables must be non-negative'),
  currentLiabilities: z.number().min(0.0001, 'Current liabilities must be greater than zero'),
});

export const CAGRSchema = z.object({
  initialValue: z.number().min(0.0001, 'Initial value must be greater than zero'),
  finalValue: z.number().min(0, 'Final value must be non-negative'),
  years: z.number().min(0.01, 'Years must be greater than zero').max(100, 'Years max 100'),
});

export const BreakEvenSchema = z.object({
  fixedCosts: z.number().min(0, 'Fixed costs must be non-negative'),
  pricePerUnit: z.number().min(0.0001, 'Price per unit must be greater than zero'),
  variableCostPerUnit: z.number().min(0, 'Variable cost per unit must be non-negative'),
}).refine((data) => data.pricePerUnit > data.variableCostPerUnit, {
  message: 'Price per unit must be greater than variable cost per unit.',
  path: ['pricePerUnit'],
});

export const DTISchema = z.object({
  monthlyGrossIncome: z.number().min(0.0001, 'Monthly gross income must be greater than zero'),
  monthlyDebtPayments: z.number().min(0, 'Monthly debt payments must be non-negative'),
});
