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
    keyTakeaways: z.array(z.string().min(1).max(500)).min(1).max(8),
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
  const responseLength = options.detail === 'short' ? '250 to 400' : '450 to 750';
  const audienceGuidance =
    options.audience === 'dashboard'
      ? 'Explain the selected dashboard evidence and show the calculation behind the most important measured change.'
      : 'Teach the concept from first principles, then demonstrate it with a complete worked calculation.';

  return `
ARTHA ANSWER STANDARD — REQUIRED OUTPUT BEHAVIOR
${audienceGuidance}

Content requirements:
1. Give a direct answer first, without filler.
2. Provide 3 to 6 ordered steps. Each step must have a short title and a clear explanation.
3. Always complete the formula object. Use a real formula when the topic is quantitative. If no equation is relevant, write "No calculation is required for this concept" and explain the decision method in whenToUse.
4. Always complete the worked example. Show inputs, substitution/calculation steps, and a final result.
5. Verified current or latest-available data may be used only when it appears in the supplied context. If it is not supplied, set dataStatus to "illustrative", leave dataAsOf empty, and explicitly call it an illustrative example. Never invent a current price, rate, date, provider, or source.
6. Separate observation from interpretation. State important assumptions, limitations, and risks.
7. Finish with concise key takeaways and source/freshness records. Do not invent source links or citations.
8. Use plain text inside every JSON field. Do not include Markdown markers, HTML, pipe tables, LaTeX delimiters, or <br> tags.
9. Use ${options.language || 'English'} at a ${options.level || 'beginner'} learning level. Target ${responseLength} words, while prioritizing correctness.
10. Current-data context is ${options.hasVerifiedCurrentData ? 'available; use it only with its exact provider/date/freshness label' : 'not available; examples must be labelled illustrative'}.
11. Remain educational and non-advisory. Never provide personalized buy/sell/hold instructions, target prices, or guaranteed returns.`;
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
    directAnswer: firstUsefulParagraph(rawText),
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
    '## Direct Answer',
    answer.directAnswer,
    '',
    '## Step-by-Step',
    ...answer.steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}: ${step.explanation}`,
    ]),
    '',
    '## Formula or Method',
    answer.formula.expression,
    ...answer.formula.variables.map((variable) => `- ${variable.symbol}: ${variable.meaning}`),
    answer.formula.whenToUse,
    '',
    `## ${answer.example.title}`,
    ...answer.example.inputs.map((input) => `- Input: ${input}`),
    ...answer.example.calculation.map((item, index) => `${index + 1}. ${item}`),
    `Result: ${answer.example.result}`,
    '',
    '## Key Takeaways',
    ...answer.keyTakeaways.map((item) => `- ${item}`),
  ];
  return lines.join('\n').trim();
}
