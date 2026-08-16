import { z } from 'zod';

export const EvaluateQuerySchema = z.object({
  query: z.string().min(1, 'Query is required').max(2000, 'Query maximum length is 2000 characters'),
});

export const FormulaItemSchema = z.object({
  name: z.string().default('Financial Calculation'),
  expression: z.string().default(''),
  inputs: z.record(z.string(), z.number()).default({}),
  result: z.number().default(0),
  unit: z.string().optional(),
});

export const ClaimItemSchema = z.object({
  statement: z.string(),
  sourceUrl: z.string().optional(),
});

export const StructuredEvaluatorOutputSchema = z.object({
  answer: z.string().default(''),
  assumptions: z.array(z.string()).default([]),
  formulas: z.array(FormulaItemSchema).default([]),
  risks: z.array(z.string()).default([]),
  claims: z.array(ClaimItemSchema).default([]),
  safetyFlags: z.array(z.string()).default([]),
});

export type StructuredEvaluatorOutput = z.infer<typeof StructuredEvaluatorOutputSchema>;
