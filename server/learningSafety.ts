/**
 * Artha Bench - Financial Safety & Prompt-Injection Defense Engine
 */

export interface SafetyCheckResult {
  isSafe: boolean;
  requiresReview: boolean;
  refusalReason?: string;
  detectedCategories: string[];
}

const HIGH_RISK_KEYWORDS = [
  'buy now',
  'sell now',
  'guaranteed return',
  'insider trading',
  'pump and dump',
  'target price $',
  'entry signal',
  'exit signal',
  'options call',
  'options put',
  '100x gem',
  'tax evasion',
  'money laundering',
  'seed phrase',
  'private key',
  'otp',
  'cvv',
  'broker login',
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore (all )?previous instructions/i,
  /system prompt/i,
  /you are now a/i,
  /override safety/i,
  /reveal secret/i,
  /print environment/i,
];

/**
 * Validates text inputs against prompt injection and financial safety violations.
 */
export function inspectInputSafety(input: string): SafetyCheckResult {
  const detectedCategories: string[] = [];
  const lower = input.toLowerCase();

  // Check Prompt Injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isSafe: false,
        requiresReview: false,
        refusalReason: 'Prompt injection or unauthorized system instruction detected.',
        detectedCategories: ['PROMPT_INJECTION'],
      };
    }
  }

  // Check High Risk Keywords
  for (const kw of HIGH_RISK_KEYWORDS) {
    if (lower.includes(kw)) {
      detectedCategories.push(kw);
    }
  }

  // Refuse specific illegal / dangerous requests
  if (
    lower.includes('insider trading') ||
    lower.includes('tax evasion') ||
    lower.includes('seed phrase') ||
    lower.includes('private key')
  ) {
    return {
      isSafe: false,
      requiresReview: false,
      refusalReason:
        'Refused: Request touches prohibited illegal activities, credentials, or private keys.',
      detectedCategories,
    };
  }

  // High risk trading/options/crypto requires safety framing/review
  const requiresReview =
    lower.includes('options') ||
    lower.includes('futures') ||
    lower.includes('leverage') ||
    lower.includes('short sell') ||
    lower.includes('crypto');

  return {
    isSafe: true,
    requiresReview,
    detectedCategories,
  };
}

/**
 * Ensures AI responses do not contain explicit buy/sell calls or guaranteed profit claims.
 */
export function sanitizeAIOutput(output: string): string {
  let sanitized = output;

  // Append educational disclaimers if trading or signals are mentioned
  if (/buy|sell|target price|call option|put option/i.test(sanitized)) {
    if (!sanitized.includes('EDUCATIONAL DISCLAIMER')) {
      sanitized +=
        '\n\n[EDUCATIONAL DISCLAIMER: This content is for educational purposes only. Artha Bench does not provide personalized investment advice or trading signals. Past performance does not guarantee future results.]';
    }
  }

  return sanitized;
}
