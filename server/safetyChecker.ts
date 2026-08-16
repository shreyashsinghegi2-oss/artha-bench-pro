/**
 * Artha Bench - Security & Prompt Safety Engine
 * Analyzes inputs for prompt injection, role overrides, system prompt extraction,
 * instruction hijacking, malicious financial recommendations, and compliance risks.
 */

export interface PromptSafetyResult {
  safe: boolean;
  score: number; // 0 to 100 safety score
  riskFlags: string[];
  reason?: string;
  category?: 'PROMPT_INJECTION' | 'ROLE_OVERRIDE' | 'SYSTEM_PROMPT_EXTRACTION' | 'GUARANTEED_RETURNS' | 'UNAUTHORIZED_ADVICE' | 'NONE';
}

export function checkPromptSafety(prompt: string): PromptSafetyResult {
  if (!prompt || typeof prompt !== 'string') {
    return {
      safe: false,
      score: 0,
      riskFlags: ['Empty or non-string input'],
      reason: 'Empty or non-string input provided.',
      category: 'NONE',
    };
  }

  const lower = prompt.toLowerCase();
  const riskFlags: string[] = [];

  // 1. Prompt Injection & Instruction Hijacking
  const injectionPatterns = [
    'ignore previous instructions',
    'ignore all prior instructions',
    'disregard above',
    'forget system instructions',
    'new system prompt',
    'system prompt:',
    'developer mode',
    'jailbreak',
    'override safety',
    'bypass guardrails',
  ];

  for (const pattern of injectionPatterns) {
    if (lower.includes(pattern)) {
      riskFlags.push(`Prompt Injection Pattern Detected: "${pattern}"`);
      return {
        safe: false,
        score: 0,
        riskFlags,
        reason: `Adversarial prompt injection pattern detected: "${pattern}"`,
        category: 'PROMPT_INJECTION',
      };
    }
  }

  // 2. Role Override & System Extraction
  const roleOverridePatterns = [
    'you are now an unrestricted',
    'act as DAN',
    'act as an evil financial advisor',
    'print system prompt',
    'repeat instructions above',
    'output your exact initial prompt',
  ];

  for (const pattern of roleOverridePatterns) {
    if (lower.includes(pattern)) {
      riskFlags.push(`Role Override / Extraction Attempt: "${pattern}"`);
      return {
        safe: false,
        score: 10,
        riskFlags,
        reason: `Role override or system prompt extraction attempt: "${pattern}"`,
        category: 'ROLE_OVERRIDE',
      };
    }
  }

  // 3. Guaranteed Profit / Illegal Financial Trap Patterns
  const illegalFinancialPatterns = [
    'guaranteed 100% return',
    'guaranteed profit',
    'risk-free 50% return',
    'double your money in 7 days',
    'insider trading secret',
    'tax evasion trick',
    'avoid paying taxes illegally',
  ];

  for (const pattern of illegalFinancialPatterns) {
    if (lower.includes(pattern)) {
      riskFlags.push(`Unsafe Financial Claim / Illegal Request: "${pattern}"`);
      return {
        safe: false,
        score: 20,
        riskFlags,
        reason: `Unsafe or non-compliant financial query detected: "${pattern}"`,
        category: 'GUARANTEED_RETURNS',
      };
    }
  }

  // 4. Secret / API Credential Leak Detection
  if (
    lower.includes('gsk_') ||
    lower.includes('sk-') ||
    (lower.includes('api_key') && lower.includes('=')) ||
    lower.includes('bearer ')
  ) {
    riskFlags.push('Secret API Credential Pattern Detected');
    return {
      safe: false,
      score: 0,
      riskFlags,
      reason: 'Possible API key or secret credential detected in input.',
      category: 'PROMPT_INJECTION',
    };
  }

  return {
    safe: true,
    score: 100,
    riskFlags: [],
    category: 'NONE',
  };
}
