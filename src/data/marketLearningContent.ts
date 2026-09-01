export type MarketLearningLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type MarketQuiz = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type MarketLearningLesson = {
  slug: string;
  title: string;
  objective: string;
  sections: Array<{ title: string; content: string }>;
  glossary: Array<{ term: string; meaning: string }>;
  example: { title: string; inputs: string[]; logic: string; result: string; limitation: string };
  quiz: MarketQuiz;
  sources?: Array<{ label: string; href: string }>;
};

export type MarketLearningCourse = {
  slug: string;
  title: string;
  level: MarketLearningLevel;
  durationMinutes: number;
  description: string;
  lessons: MarketLearningLesson[];
};

const lesson = (
  slug: string,
  title: string,
  objective: string,
  content: string,
  term: string,
  meaning: string,
  quiz: MarketQuiz,
  example?: Partial<MarketLearningLesson['example']>,
  sources?: MarketLearningLesson['sources'],
): MarketLearningLesson => ({
  slug,
  title,
  objective,
  sections: [
    { title: 'Core idea', content },
    { title: 'How to use this concept', content: 'Separate observed data from assumptions. Check the source, timestamp, units, and limitations before interpreting a number or chart.' },
  ],
  glossary: [{ term, meaning }],
  example: {
    title: example?.title || 'Deterministic learning example',
    inputs: example?.inputs || ['Starting reference: 100', 'Ending reference: 105'],
    logic: example?.logic || 'Percentage change = (ending − starting) ÷ starting × 100.',
    result: example?.result || 'The observed change is +5%. This describes the selected interval only.',
    limitation: example?.limitation || 'The calculation does not predict the next observation and is not a recommendation.',
  },
  quiz,
  sources,
});

export const MARKET_LEARNING_COURSES: MarketLearningCourse[] = [
  {
    slug: 'personal-finance-foundations',
    title: 'Personal finance foundations',
    level: 'Beginner',
    durationMinutes: 28,
    description: 'Cash flow, emergency reserves, goals, and the difference between planning and prediction.',
    lessons: [
      lesson('cash-flow-basics','Cash-flow basics','Distinguish income, expenses, surplus, and deficit.','Cash flow is the movement of money into and out of a household or plan. A positive monthly difference can increase flexibility, while a negative difference means spending exceeds recorded income for that period.','Cash flow','Recorded inflows minus recorded outflows over a defined period.',{question:'If recorded income is ₹50,000 and recorded expenses are ₹42,000, what is the monthly surplus?',options:['₹8,000','₹92,000','₹42,000','It cannot be calculated'],correctIndex:0,explanation:'₹50,000 − ₹42,000 = ₹8,000. This is a deterministic arithmetic result for the entered values.'},{inputs:['Recorded income: ₹50,000','Recorded expenses: ₹42,000'],logic:'Surplus = income − expenses.',result:'₹8,000 surplus for the selected period.'}),
      lesson('emergency-reserves','Emergency reserves','Explain why liquidity and time horizon matter.','An emergency reserve is money intentionally kept accessible for unexpected essential expenses. The appropriate amount is a planning decision that depends on household circumstances; Artha Bench does not prescribe a personalised target.','Liquidity','How readily an asset or balance can be used without a large delay or value loss.',{question:'Which statement best describes an emergency reserve?',options:['A guaranteed-return investment','Accessible money for unexpected essential costs','A trading account for short-term signals','A loan repayment penalty'],correctIndex:1,explanation:'An emergency reserve is designed for access and resilience, not guaranteed returns or trading.'}),
    ],
  },
  {
    slug: 'indian-markets-fundamentals',
    title: 'Indian markets fundamentals',
    level: 'Beginner',
    durationMinutes: 32,
    description: 'Exchange identity, quote freshness, delayed/EOD references, and public-market research boundaries.',
    lessons: [
      lesson('exchange-and-symbols','Exchanges and symbols','Understand why provider symbols can differ from exchange-facing identities.','A company identity, an exchange symbol, and a market-data provider symbol are related but not interchangeable. Data providers can use different identifiers, so Artha Bench verifies provider-specific mappings before showing a quote.','Provider symbol','The identifier a specific market-data provider expects for an asset.',{question:'Why should Artha Bench not assume a Yahoo-style .NS symbol works at every provider?',options:['All providers use identical formats','Provider identifiers can differ','NSE symbols are secret','Prices do not need symbols'],correctIndex:1,explanation:'Provider-specific symbol formats can differ, so mappings must be verified rather than inferred.'},{inputs:['Tracked identity: example company','Provider A symbol: verified separately','Provider B symbol: unknown'],logic:'Only request a provider quote after that provider mapping is verified.',result:'Provider B remains searchable but quote status stays unavailable until verified.'}),
      lesson('freshness-labels','Market-data freshness','Interpret live, delayed, end-of-day, cached, stale, and unavailable states.','A page refresh does not make a quote real time. A trustworthy market interface distinguishes the provider timestamp from the app retrieval timestamp and preserves delay or stale metadata.','Freshness','How current a data observation is relative to its source timestamp and provider rules.',{question:'Which condition alone is NOT enough to call a quote live?',options:['The page refreshed just now','Provider supports current data','A valid recent source timestamp exists','No delay notice applies'],correctIndex:0,explanation:'Refreshing the page only changes retrieval time. Live status depends on source capability, timestamp, freshness, and delay conditions.'}),
    ],
  },
  {
    slug: 'investing-basics',
    title: 'Investing basics',
    level: 'Beginner',
    durationMinutes: 30,
    description: 'Diversification, time horizon, return measurement, and uncertainty without personalised allocations.',
    lessons: [
      lesson('return-vs-forecast','Historical return vs forecast','Distinguish measured past return from a future-price prediction.','A historical return measures change between two observed values. It does not establish what will happen next. Forecasts require assumptions and remain uncertain.','Historical return','A calculation based on already observed start and end values.',{question:'A +10% one-year historical return means:',options:['The next year is guaranteed +10%','The selected past interval increased by 10%','The asset is safe','The correct action is to buy'],correctIndex:1,explanation:'Historical return describes the measured past interval only.'}),
      lesson('diversification','Diversification concepts','Explain concentration and diversification without prescribing a portfolio.','Diversification spreads exposure across different assets or risk drivers. It can reduce some concentration risk, but it does not remove market risk or guarantee a positive outcome.','Concentration risk','Risk created when outcomes depend heavily on a small number of exposures.',{question:'Does diversification guarantee a profit?',options:['Yes','Only in equities','No','Only with many holdings'],correctIndex:2,explanation:'Diversification can change risk exposure but cannot guarantee returns.'}),
    ],
  },
  {
    slug: 'forex-fundamentals',
    title: 'Forex fundamentals',
    level: 'Intermediate',
    durationMinutes: 34,
    description: 'Currency pairs, bid/ask/spread, stale-rate safety, and reference conversions.',
    lessons: [
      lesson('currency-pairs','How currency pairs work','Read base and quote currency notation.','In EUR/USD, EUR is the base currency and USD is the quote currency. A displayed reference indicates how many quote-currency units correspond to one base-currency unit at the shown source time.','Base currency','The first currency in a currency pair.',{question:'In USD/INR, which currency is the base?',options:['INR','USD','Both','Neither'],correctIndex:1,explanation:'The first currency in the pair is the base currency.'}),
      lesson('bid-ask-spread','Bid, ask, and spread','Understand why spread must not be invented when bid/ask are missing.','Bid and ask are different sides of a quoted market. Spread can be calculated only when both valid bid and ask values are available from the same relevant source context.','Spread','The difference between a valid ask and bid quote.',{question:'If a provider returns only one reference rate and no bid/ask, Artha Bench should:',options:['Invent a narrow spread','Show bid and ask as zero','Leave bid/ask/spread unavailable','Assume both equal the reference rate'],correctIndex:2,explanation:'Missing bid/ask values stay missing. A spread cannot be derived without them.'}),
    ],
  },
  {
    slug: 'intraday-chart-literacy',
    title: 'Intraday chart literacy',
    level: 'Intermediate',
    durationMinutes: 36,
    description: 'OHLC, intervals, volume context, and why intraday controls require verified data entitlement.',
    lessons: [
      lesson('ohlc','OHLC observations','Read open, high, low, and close without turning them into a signal.','OHLC summarizes prices within a defined interval. Candlestick or indicator calculations require genuine interval data; missing fields should never be synthesized.','OHLC','Open, high, low, and close observations for a defined interval.',{question:'When should a candlestick be drawn?',options:['Whenever a closing price exists','Only when genuine OHLC data exists','Whenever the user asks','Using synthetic values if needed'],correctIndex:1,explanation:'Candlesticks require real OHLC observations for the interval.'}),
      lesson('intraday-entitlement','Intraday entitlement and timestamps','Explain why a timestamp pattern alone does not prove licensed intraday capability.','A robust product checks both data content and provider entitlement/configuration. Unsupported intervals stay disabled with a clear explanation.','Entitlement','Provider/account permission to access a particular data capability under applicable terms.',{question:'What should happen when no verified intraday entitlement is configured?',options:['Generate synthetic candles','Enable all intervals','Disable intraday controls with an explanation','Label EOD data live'],correctIndex:2,explanation:'Unavailable capability must be disabled honestly; no synthetic substitute is appropriate.'}),
    ],
  },
  {
    slug: 'risk-and-volatility',
    title: 'Risk and volatility',
    level: 'Intermediate',
    durationMinutes: 30,
    description: 'Volatility, drawdowns, uncertainty, and risk language without trade calls.',
    lessons: [
      lesson('volatility','Volatility as variation','Interpret variability without equating it with guaranteed loss or opportunity.','Volatility describes the magnitude or dispersion of price changes over time. Higher volatility can mean larger moves in either direction and does not by itself identify a future direction.','Volatility','A measure or description of variability in observed values over time.',{question:'High volatility tells you with certainty that price will:',options:['Rise','Fall','Move in a known direction','None of these'],correctIndex:3,explanation:'Volatility describes variation, not a guaranteed direction.'}),
      lesson('drawdown','Drawdown concepts','Measure a decline from a prior observed peak.','A drawdown compares a later observed value with an earlier peak. It is a historical risk description and not a prediction of recovery time.','Drawdown','Percentage decline from a prior observed peak to a later value.',{question:'A drawdown calculation is primarily:',options:['A guaranteed recovery estimate','A historical decline measure','A buy signal','A stop-loss instruction'],correctIndex:1,explanation:'Drawdown is a historical measurement, not an instruction or forecast.'}),
    ],
  },
  {
    slug: 'debt-emi-understanding',
    title: 'Debt and EMI understanding',
    level: 'Beginner',
    durationMinutes: 29,
    description: 'Principal, interest, tenure, EMI mechanics, and affordability scenario limitations.',
    lessons: [
      lesson('emi-mechanics','EMI mechanics','Understand the variables in a fixed-payment loan calculation.','An EMI calculation uses principal, periodic interest rate, and number of payments. A deterministic result is only as representative as the entered loan terms.','Principal','The amount on which the loan calculation is based before future interest charges.',{question:'Which input is required for a standard EMI calculation?',options:['Principal','Future stock return','FX spread','Market-cap rank'],correctIndex:0,explanation:'Principal is a core loan calculation input.'}),
      lesson('affordability-scenarios','Affordability scenarios','Use scenarios as planning tools rather than lender approvals.','A scenario can compare payment amounts with recorded income or expenses, but it cannot determine lender approval or substitute for actual underwriting criteria.','Scenario','A what-if calculation using explicit assumptions or recorded inputs.',{question:'An EMI affordability scenario is:',options:['A guaranteed loan approval','A planning comparison using inputs','A credit score','A brokerage order'],correctIndex:1,explanation:'It is a planning calculation, not an approval or personalised lending decision.'}),
    ],
  },
  {
    slug: 'tax-basics',
    title: 'Tax basics',
    level: 'Intermediate',
    durationMinutes: 34,
    description: 'Tax-year context, gross vs taxable concepts, and why tax rules require dated official references.',
    lessons: [
      lesson('tax-year-context','Tax-year context','Recognise that tax rules depend on jurisdiction and period.','Tax rates, deductions, definitions, and filing rules can change. Any tax calculation should identify its jurisdiction, tax year, assumptions, and rule source.','Tax year','The period for which a tax rule or return applies.',{question:'Why should a tax calculation show its tax year?',options:['Tax rules can change by period','Prices need a chart','It makes a quote live','It replaces official guidance'],correctIndex:0,explanation:'Tax rules are time-dependent, so the applicable period must be explicit.'}),
      lesson('tax-vs-advice','Tax calculation vs advice','Separate deterministic arithmetic from personalised tax advice.','A calculator can apply encoded rules to entered values, but users should verify eligibility, classifications, and current official guidance for real filing decisions.','Taxable income','Income amount determined under applicable tax rules after relevant inclusions and adjustments.',{question:'A deterministic tax calculator should be presented as:',options:['A substitute for all filing advice','A rule-based estimate with assumptions and limitations','A guaranteed refund','A trading recommendation'],correctIndex:1,explanation:'Rule-based estimates need assumptions, rule dates, and limitations.'}),
    ],
  },
  {
    slug: 'ai-financial-data-literacy',
    title: 'AI and financial-data literacy',
    level: 'Advanced',
    durationMinutes: 38,
    description: 'Evidence grounding, citations, data freshness, model limitations, and safety boundaries.',
    lessons: [
      lesson('evidence-grounding','Evidence-grounded AI','Identify when an AI answer is supported by visible source records.','A grounded explanation separates the model-generated interpretation from source data. It should display evidence records, provider names, timestamps, freshness, and limitations rather than fabricating citations.','Grounding','Constraining an AI response to supplied or retrieved evidence that can be inspected.',{question:'If no verified evidence is available, a grounded assistant should:',options:['Invent a plausible citation','State that evidence is unavailable','Use a random market value','Hide the limitation'],correctIndex:1,explanation:'The assistant should disclose insufficient evidence instead of inventing support.'}),
      lesson('ai-safety-boundaries','AI market-safety boundaries','Understand why educational market explanation is different from personalised trade instruction.','ArthaMind can explain visible data, chart concepts, risk terminology, and research questions. It does not provide personalised buy/sell calls, entries, exits, targets, stop-losses, leverage instructions, or profit guarantees.','Safety redirect','A response that preserves useful educational help while declining unsupported or disallowed personalised instructions.',{question:'Which request should trigger a market-safety redirect?',options:['Explain this timestamp','What does OHLC mean?','Give me an exact stop-loss and target','Why is this quote labelled delayed?'],correctIndex:2,explanation:'Exact personalised trade levels are outside the educational market-explainer scope.'}),
    ],
  },
];

export function findMarketLearningCourse(courseSlug:string){return MARKET_LEARNING_COURSES.find(course=>course.slug===courseSlug)||null;}
export function findMarketLearningLesson(courseSlug:string,lessonSlug:string){const course=findMarketLearningCourse(courseSlug);return {course,lesson:course?.lessons.find(item=>item.slug===lessonSlug)||null};}
