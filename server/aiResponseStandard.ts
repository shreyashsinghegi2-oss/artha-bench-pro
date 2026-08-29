import { z } from 'zod';
import { StructuredFinancialAnswer } from '../src/types';

const answerStepSchema = z
  .object({
    title: z.string().min(1).max(120),
    explanation: z.string().min(1).max(1200),
  })
  .strict();

const formulaVariableSchema = z
  .object({
    symbol: z.string().min(1).max(40),
    meaning: z.string().min(1).max(240),
  })
  .strict();

const sourceSchema = z
  .object({
    name: z.string().min(1).max(160),
    dataDate: z.string().max(80),
    freshness: z.string().min(1).max(120),
  })
  .strict();

export const structuredFinancialAnswerSchema = z
  .object({
    title: z.string().min(1).max(160),
    directAnswer: z.string().min(1).max(2400),
    steps: z.array(answerStepSchema).min(1).max(7),
    formula: z
      .object({
        expression: z.string().min(1).max(500),
        variables: z.array(formulaVariableSchema).max(10),
        whenToUse: z.string().min(1).max(600),
      })
      .strict(),
    example: z
      .object({
        title: z.string().min(1).max(160),
        dataStatus: z.enum([
          'live',
          'latest_available',
          'delayed',
          'illustrative',
          'not_applicable',
        ]),
        dataAsOf: z.string().max(100),
        inputs: z.array(z.string().min(1).max(300)).max(10),
        calculation: z.array(z.string().min(1).max(500)).max(10),
        result: z.string().min(1).max(800),
      })
      .strict(),
    interpretation: z.array(z.string().min(1).max(600)).max(8),
    risks: z.array(z.string().min(1).max(600)).max(8),
    keyTakeaways: z.array(z.string().min(1).max(500)).max(8),
    sources: z.array(sourceSchema).max(12),
  })
  .strict();

export const STRUCTURED_FINANCIAL_ANSWER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    directAnswer: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['title', 'explanation'],
      },
    },
    formula: {
      type: 'object',
      additionalProperties: false,
      properties: {
        expression: { type: 'string' },
        variables: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              symbol: { type: 'string' },
              meaning: { type: 'string' },
            },
            required: ['symbol', 'meaning'],
          },
        },
        whenToUse: { type: 'string' },
      },
      required: ['expression', 'variables', 'whenToUse'],
    },
    example: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        dataStatus: {
          type: 'string',
          enum: ['live', 'latest_available', 'delayed', 'illustrative', 'not_applicable'],
        },
        dataAsOf: { type: 'string' },
        inputs: { type: 'array', items: { type: 'string' } },
        calculation: { type: 'array', items: { type: 'string' } },
        result: { type: 'string' },
      },
      required: ['title', 'dataStatus', 'dataAsOf', 'inputs', 'calculation', 'result'],
    },
    interpretation: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
    keyTakeaways: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          dataDate: { type: 'string' },
          freshness: { type: 'string' },
        },
        required: ['name', 'dataDate', 'freshness'],
      },
    },
  },
  required: [
    'title',
    'directAnswer',
    'steps',
    'formula',
    'example',
    'interpretation',
    'risks',
    'keyTakeaways',
    'sources',
  ],
} as const;

export function buildStructuredFinancialAnswerInstructions(options: {
  audience: 'dashboard' | 'tutor';
  language?: string;
  level?: string;
  detail?: 'short' | 'detailed';
  hasVerifiedCurrentData: boolean;
}) {
  const responseLength = options.detail === 'short' ? '220 to 380' : '420 to 750';
  const audienceGuidance =
    options.audience === 'dashboard'
      ? 'Explain the selected dashboard evidence and keep observations, calculations, and interpretation visibly separate.'
      : 'Teach the user clearly enough for a non-expert to understand while keeping every material claim easy to verify.';

  return `
ARTHAMIND FINANCIAL RESPONSE CONTRACT — REQUIRED OUTPUT BEHAVIOR
${audienceGuidance}

Response mode:
- If the user explicitly requests Quick answer, Step-by-step, Detailed, Professional report, or Teach me, honor that mode.
- Otherwise infer the mode: very simple lookup -> Quick answer; short factual/calculation question -> Step-by-step; conceptual/educational question -> Teach me; complex multi-part question -> Detailed.
- Mode changes depth and wording only. It never changes mathematical correctness, evidence standards, or the section order below.

Map the JSON fields to these sections in this exact conceptual order:
A. directAnswer = one sentence in plain language with the key result or conclusion. If a numeric result is supported, include the number and currency/unit here.
B. Assumptions and context: example.inputs = 2 to 6 short assumptions/context items. Include amount or income, rate/percentage, time/compounding, currency, jurisdiction/regime/year, pre/post-tax basis, or simplifications when relevant. If the prompt is ambiguous, state the default assumption here.
C. formula = the formula or governing rule. Put the simple formula/rule matching the assumptions first in expression. Add an optional general formula after "General:" only when it adds clarity. Explain every symbol in variables. For tax/policy/legal topics, state the jurisdiction, applicable year/regime, rule, and important conditions instead of inventing an equation.
D. steps = 2 to 7 ordered calculation/reasoning steps. Each step should contain one main claim, a short explanation, and small readable math where relevant. example.calculation contains concrete substitutions/intermediate arithmetic only; it may be empty for conceptual questions.
E. example.result = an explicit final result line, preferably beginning "Final result:" for quantitative questions. Include currency/units and sensible rounding. interpretation = a concise explanation of what the result means; distinguish measured facts from interpretation.
F. keyTakeaways = optional "If needed" variations, edge cases, alternative regimes/compounding frequencies, or a genuinely necessary clarifying question. Return [] when no variation is useful.
G. risks = 1 to 3 concise limitations and verification notes. State omitted fees, inflation, deductions, taxes, timing, data gaps, or uncertainty where relevant. sources = only supplied/verified sources with exact date/freshness; never fabricate a citation or provider.

Claim and calculation discipline:
1. Keep independent factual claims in separate sentences so automated evaluators can extract them cleanly.
2. Never hide the main numeric answer inside a paragraph. Put it in directAnswer and example.result.
3. Do not omit calculation steps to sound concise. Convert percentages to decimals where relevant, substitute values, show intermediate values, and then compute the result.
4. Use a real formula only when it applies. If no equation is relevant, set expression to "No calculation is required; Rule: ..." and explain the decision method in whenToUse.
5. Never invent a current price, market move, interest rate, tax threshold, policy rule, date, provider, or source. Verified current/latest data may be used only when supplied in context.
6. Current-data context is ${options.hasVerifiedCurrentData ? 'available; use only the exact provider/date/freshness supplied' : 'not verified; do not present current figures or rules as confirmed and label examples illustrative'}.

Risk-sensitive behavior:
- For specific investments, tax filing/compliance, loan/debt restructuring, credit decisions, insurance coverage, or legal/regulatory interpretation, state assumptions and uncertainty explicitly.
- Avoid definitive personalized "you should buy/sell/file/refinance" language. Prefer neutral educational framing such as "a common approach is" or "you may want to verify".
- For consequential decisions, recommend verification with the relevant official source or a suitably qualified professional.
- Never provide guaranteed returns, approval probabilities, fabricated creditworthiness judgments, or unsupported tax/legal conclusions.

Localization and style:
- Use the currency, jurisdiction, fiscal-year terminology, and local concepts clearly indicated by the user/context. If you infer them from a strong cue such as INR/NIFTY/401(k), state that assumption.
- If a local rule is not verified in supplied context, say so instead of guessing.
- Use ${options.language || 'English'} at a ${options.level || 'beginner'} learning level. Use plain professional English, short sentences, and concise but complete explanations. Target ${responseLength} words unless the explicit user mode reasonably requires less or more.
- Use plain text inside every JSON field. Do not include Markdown markers, HTML, pipe tables, LaTeX delimiters, or <br> tags.
- Remain educational and non-advisory. Do not add boilerplate that contradicts the analysis; keep limitations specific and calm.`;
}

function cleanPlainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`{1,3}/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeStructuredFinancialAnswer(
  answer: StructuredFinancialAnswer,
): StructuredFinancialAnswer {
  return {
    title: cleanPlainText(answer.title),
    directAnswer: cleanPlainText(answer.directAnswer),
    steps: answer.steps.map((step) => ({
      title: cleanPlainText(step.title),
      explanation: cleanPlainText(step.explanation),
    })),
    formula: {
      expression: cleanPlainText(answer.formula.expression),
      variables: answer.formula.variables.map((variable) => ({
        symbol: cleanPlainText(variable.symbol),
        meaning: cleanPlainText(variable.meaning),
      })),
      whenToUse: cleanPlainText(answer.formula.whenToUse),
    },
    example: {
      ...answer.example,
      title: cleanPlainText(answer.example.title),
      dataAsOf: cleanPlainText(answer.example.dataAsOf),
      inputs: answer.example.inputs.map(cleanPlainText),
      calculation: answer.example.calculation.map(cleanPlainText),
      result: cleanPlainText(answer.example.result),
    },
    interpretation: answer.interpretation.map(cleanPlainText),
    risks: answer.risks.map(cleanPlainText),
    keyTakeaways: answer.keyTakeaways.map(cleanPlainText),
    sources: answer.sources.map((source) => ({
      name: cleanPlainText(source.name),
      dataDate: cleanPlainText(source.dataDate),
      freshness: cleanPlainText(source.freshness),
    })),
  };
}

function firstUsefulParagraph(rawText: string) {
  const jsonDirectAnswer = rawText.match(
    /"directAnswer"\s*:\s*"((?:\\.|[^"\\])*)"/s,
  );
  if (jsonDirectAnswer) {
    try {
      return cleanPlainText(JSON.parse(`"${jsonDirectAnswer[1]}"`)).slice(0, 2200);
    } catch {
      return cleanPlainText(jsonDirectAnswer[1]).slice(0, 2200);
    }
  }

  const cleaned = cleanPlainText(rawText)
    .replace(/^\|.*\|$/gm, '')
    .replace(/^[-|: ]{3,}$/gm, '')
    .trim();
  if (/^(?:json\s*)?[{[]/i.test(cleaned)) {
    return 'The model response could not be validated, so ArthaBench replaced it with a safe structured explanation.';
  }
  const paragraph = cleaned.split(/\n\s*\n/).find((item) => item.trim());
  return (paragraph || cleaned || 'A structured financial explanation is available.').slice(0, 2200);
}


function oneSentenceDirectAnswer(rawText: string) {
  const text = firstUsefulParagraph(rawText).replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1] || text;
  const normalized = sentence.replace(/[.!?]+$/, '').trim();
  return `${normalized || 'A structured financial explanation is available'}.`.slice(0, 2200);
}

export function createFallbackStructuredFinancialAnswer(
  question: string,
  rawText: string,
): StructuredFinancialAnswer {
  const normalizedQuestion = question.toLowerCase();
  const isCompoundInterest = /compound|future value/.test(normalizedQuestion);
  const isLoan = /\bemi\b|loan|mortgage/.test(normalizedQuestion);
  const isBudget = /budget|50\/30\/20/.test(normalizedQuestion);
  const isRatio = /valuation|p\/?e\b|price[- ]to[- ](earnings|book|sales)|current ratio|quick ratio|return on equity|\broe\b|fundamental ratio/.test(
    normalizedQuestion,
  );
  const isMarketReturn = /\b(range return|market return|price return|performance|market chart|dashboard signal|price change)\b/.test(
    normalizedQuestion,
  );

  let expression = 'No calculation is required for this concept';
  let variables: StructuredFinancialAnswer['formula']['variables'] = [];
  let whenToUse = 'Use the step-by-step decision method when comparing the financial choices described above.';
  let inputs = ['Use the facts and assumptions stated in the question.'];
  let calculation = ['Apply each step in order and check that units and dates are consistent.'];
  let result = 'The result depends on the verified inputs supplied by the learner.';
  let exampleDataStatus: StructuredFinancialAnswer['example']['dataStatus'] = 'illustrative';
  let dataAsOf = '';
  let exampleTitle = 'Illustrative worked example';
  let sources: StructuredFinancialAnswer['sources'] = [
    {
      name: 'ArthaBench educational framework',
      dataDate: '',
      freshness: 'Illustrative — not live market data',
    },
  ];

  if (isCompoundInterest) {
    expression = 'A = P × (1 + r/n)^(n × t)';
    variables = [
      { symbol: 'A', meaning: 'final accumulated amount' },
      { symbol: 'P', meaning: 'starting principal' },
      { symbol: 'r', meaning: 'annual interest rate as a decimal' },
      { symbol: 'n', meaning: 'compounding periods per year' },
      { symbol: 't', meaning: 'number of years' },
    ];
    whenToUse = 'Use this formula when interest is added to the balance and future interest earns interest on that enlarged balance.';
    inputs = ['P = 10,000', 'r = 8% or 0.08', 'n = 1', 't = 5 years'];
    calculation = ['A = 10,000 × (1 + 0.08)^5', 'A = 10,000 × 1.469328'];
    result = 'Final balance = 14,693.28; total interest = 4,693.28.';
  } else if (isLoan) {
    expression = 'EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)';
    variables = [
      { symbol: 'P', meaning: 'loan principal' },
      { symbol: 'r', meaning: 'monthly interest rate' },
      { symbol: 'n', meaning: 'number of monthly payments' },
    ];
    whenToUse = 'Use this formula for a fixed-rate amortizing loan with equal monthly payments.';
    inputs = ['P = 50,000', 'annual rate = 6%', 'r = 0.06 / 12', 'n = 60 months'];
    calculation = ['Substitute P, r, and n into the EMI formula.', 'Calculate the compound factor before the final division.'];
    result = 'The illustrative monthly payment is approximately 966.64.';
  } else if (isBudget) {
    expression = 'Category amount = monthly net income × allocation percentage';
    variables = [
      { symbol: 'Net income', meaning: 'income available after deductions' },
      { symbol: 'Allocation percentage', meaning: 'chosen share for needs, wants, or savings' },
    ];
    whenToUse = 'Use this method to convert a percentage-based budgeting rule into actual monthly amounts.';
    inputs = ['Illustrative monthly net income = 4,000', 'Needs = 50%', 'Wants = 30%', 'Savings/debt = 20%'];
    calculation = ['Needs: 4,000 × 0.50 = 2,000', 'Wants: 4,000 × 0.30 = 1,200', 'Savings/debt: 4,000 × 0.20 = 800'];
    result = 'The three allocations total the full 4,000 monthly net income.';
  } else if (isRatio) {
    expression = 'Valuation multiple = Market value per share ÷ Financial metric per share';
    variables = [
      { symbol: 'Market value per share', meaning: 'the verified market price for one share' },
      { symbol: 'Financial metric per share', meaning: 'earnings, book value, or sales per share for the matching period' },
    ];
    whenToUse = 'Use this relationship to understand P/E, P/B, or P/S after confirming that the price, metric, and period are comparable.';

    const verifiedPrice = normalizedQuestion.match(/"price":\s*(-?[\d.]+)/);
    const verifiedPe = normalizedQuestion.match(/"peratio":\s*(-?[\d.]+)/);
    const retrievedAt = question.match(/"dataRetrievedAt":\s*"([^"]+)"/i)?.[1] || '';
    const quoteFreshness = question.match(/"freshness":\s*"([^"]+)"/i)?.[1] || '';
    const hasFinnhubContext = /finnhub/i.test(question);

    if (verifiedPrice && verifiedPe && Number(verifiedPe[1]) !== 0) {
      const price = Number(verifiedPrice[1]);
      const pe = Number(verifiedPe[1]);
      const impliedEps = price / pe;
      exampleTitle = 'Verified P/E relationship';
      inputs = [
        `Market price = ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `Reported P/E = ${pe.toLocaleString(undefined, { maximumFractionDigits: 2 })}×`,
      ];
      calculation = [
        `Implied earnings per share = ${price.toFixed(2)} ÷ ${pe.toFixed(2)} = ${impliedEps.toFixed(2)}`,
      ];
      result = `The reported P/E implies earnings per share of approximately ${impliedEps.toFixed(2)} for the ratio's measurement basis.`;
      exampleDataStatus = /delayed|end_of_day|stale|demo/i.test(quoteFreshness)
        ? 'delayed'
        : 'latest_available';
      dataAsOf = retrievedAt;
    }

    if (hasFinnhubContext) {
      sources = [
        {
          name: 'Finnhub company fundamentals',
          dataDate: retrievedAt,
          freshness: quoteFreshness
            ? `Company context with ${quoteFreshness.replaceAll('_', ' ')} quote`
            : 'Latest company context supplied to the assistant',
        },
      ];
    }
  } else if (isMarketReturn) {
    expression = 'Range return (%) = (latest price − starting price) / starting price × 100';
    variables = [
      { symbol: 'Latest price', meaning: 'the last verified observation in the selected range' },
      { symbol: 'Starting price', meaning: 'the first verified observation in the selected range' },
    ];
    whenToUse = 'Use this formula to describe the measured price change across a historical chart range. It is not a forecast.';
    const observedPrices = rawText.match(/moved from\s+([\d,.]+)\s+to\s+([\d,.]+)/i);
    const observedReturn = rawText.match(/range return is\s+(-?[\d.]+)%/i);
    const observedDates = rawText.match(/\(([^()]+)\s+to\s+([^()]+)\)/i);
    if (observedPrices) {
      inputs = [
        `Starting price = ${observedPrices[1]}`,
        `Latest price = ${observedPrices[2]}`,
      ];
      calculation = [
        `(${observedPrices[2]} − ${observedPrices[1]}) / ${observedPrices[1]} × 100`,
      ];
      result = observedReturn
        ? `Measured range return = ${observedReturn[1]}%.`
        : 'Calculate the measured percentage change from the two displayed observations.';
      exampleDataStatus = /\b(delayed|demo|stale|end-of-day)\b/i.test(rawText)
        ? 'delayed'
        : 'latest_available';
      dataAsOf = observedDates?.[2]?.trim() || '';
      exampleTitle = 'Verified dashboard range calculation';
    }
  }

  return {
    title: 'Structured Financial Explanation',
    directAnswer: oneSentenceDirectAnswer(rawText),
    steps: [
      { title: 'Identify the objective', explanation: 'Define exactly what must be explained, calculated, or compared.' },
      { title: 'List verified inputs', explanation: 'Record the amounts, rates, dates, units, and assumptions before calculating.' },
      { title: 'Apply the method', explanation: 'Use the relevant formula or decision framework and show each substitution.' },
      { title: 'Interpret the result', explanation: 'Explain what the output means and which assumptions could change it.' },
    ],
    formula: { expression, variables, whenToUse },
    example: {
      title: exampleTitle,
      dataStatus: exampleDataStatus,
      dataAsOf,
      inputs,
      calculation,
      result,
    },
    interpretation: ['Use the result as an educational estimate, not as a guaranteed outcome.'],
    risks: ['Actual outcomes can change when rates, fees, taxes, timing, or market conditions differ from the assumptions.'],
    keyTakeaways: ['Verify the inputs, show the formula, and interpret the result together.'],
    sources,
  };
}

export function serializeStructuredFinancialAnswer(answer: StructuredFinancialAnswer) {
  const lines = [
    `# ${answer.title}`,
    '',
    '## Direct answer',
    answer.directAnswer,
    '',
    '## Assumptions and context',
    ...(answer.example.inputs.length
      ? answer.example.inputs.map((input) => `- ${input}`)
      : ['- No additional quantitative assumptions were required beyond the supplied context.']),
    ...(answer.example.dataAsOf ? [`- Data as of: ${answer.example.dataAsOf}`] : []),
    `- Data status: ${answer.example.dataStatus.replaceAll('_', ' ')}`,
    '',
    '## Formula or rule',
    answer.formula.expression,
    ...answer.formula.variables.map((variable) => `- ${variable.symbol}: ${variable.meaning}`),
    answer.formula.whenToUse,
    '',
    '## Step-by-step calculation or reasoning',
    ...answer.steps.map((step, index) => `${index + 1}. ${step.title}: ${step.explanation}`),
    ...(answer.example.calculation.length
      ? ['', 'Calculation details:', ...answer.example.calculation.map((item, index) => `${index + 1}. ${item}`)]
      : []),
    '',
    '## Final result and interpretation',
    answer.example.result,
    ...answer.interpretation.map((item) => `- ${item}`),
    ...(answer.keyTakeaways.length
      ? ['', '## If needed', ...answer.keyTakeaways.map((item) => `- ${item}`)]
      : []),
    '',
    '## Limitations and verification',
    ...(answer.risks.length ? answer.risks.map((item) => `- ${item}`) : ['- No additional limitation was identified from the supplied context.']),
    ...(answer.sources.length
      ? ['', 'Sources and freshness:', ...answer.sources.map((source) => `- ${source.name}${source.dataDate ? ` · ${source.dataDate}` : ''} · ${source.freshness}`)]
      : []),
  ];
  return lines.join('\n').trim();
}