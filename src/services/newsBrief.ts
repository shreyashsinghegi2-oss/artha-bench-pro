/**
 * Research brief for a business-news item. The rule-based builder works from the headline and summary
 * alone (no network), so a brief is always available; the server can enrich it with an AI pass that is
 * validated against the same shape. Nothing here invents facts: figures and names are lifted verbatim
 * from the supplied text, and every judgement is labelled with its confidence.
 */

export type BriefDirection = 'positive' | 'negative' | 'mixed' | 'unclear';
export type BriefEntityType = 'company' | 'index' | 'regulator' | 'sector' | 'economy' | 'commodity' | 'currency';

export interface NewsBriefInput {
  title: string;
  summary?: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt?: string | null;
}

export interface NewsResearchBrief {
  headline: string;
  summary: string;
  keyPoints: string[];
  whyItMatters: string;
  sentiment: BriefDirection;
  confidence: 'low' | 'medium' | 'high';
  topics: string[];
  entities: Array<{ name: string; type: BriefEntityType; symbol?: string }>;
  figures: Array<{ label: string; value: string }>;
  impact: Array<{ area: string; direction: BriefDirection; note: string }>;
  whatToWatch: string[];
  verify: string[];
  source: { name: string; url?: string; publishedAt?: string | null };
  coverage: string;
  generatedBy: 'ai' | 'rules';
  asOf: string;
}

const clean = (v: string) => v.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const sentences = (v: string) => clean(v).split(/(?<=[.!?])\s+(?=[A-Z0-9“"'‘])/).map((s) => s.trim()).filter((s) => s.length > 25);
const uniq = <T,>(list: T[], key: (t: T) => string = (t) => String(t)) => list.filter((t, i) => list.findIndex((o) => key(o) === key(t)) === i);

// Known names → entity. Symbols match the CompanyLogo registry so the UI can show logos.
const ENTITIES: Array<{ re: RegExp; name: string; type: BriefEntityType; symbol?: string }> = [
  { re: /\bReliance\b/i, name: 'Reliance Industries', type: 'company', symbol: 'RELIANCE' },
  { re: /\bTCS\b|Tata Consultancy/i, name: 'TCS', type: 'company', symbol: 'TCS' },
  { re: /\bHDFC Bank\b/i, name: 'HDFC Bank', type: 'company', symbol: 'HDFCBANK' },
  { re: /\bInfosys\b/i, name: 'Infosys', type: 'company', symbol: 'INFY' },
  { re: /\bICICI Bank\b/i, name: 'ICICI Bank', type: 'company', symbol: 'ICICIBANK' },
  { re: /\bApple\b/, name: 'Apple', type: 'company', symbol: 'AAPL' },
  { re: /\bMicrosoft\b/i, name: 'Microsoft', type: 'company', symbol: 'MSFT' },
  { re: /\bNvidia\b/i, name: 'NVIDIA', type: 'company', symbol: 'NVDA' },
  { re: /\bTesla\b/i, name: 'Tesla', type: 'company', symbol: 'TSLA' },
  { re: /\bAmazon\b/i, name: 'Amazon', type: 'company', symbol: 'AMZN' },
  { re: /\bAlphabet\b|\bGoogle\b/i, name: 'Alphabet', type: 'company', symbol: 'GOOGL' },
  { re: /\bMeta\b(?! description)/, name: 'Meta', type: 'company', symbol: 'META' },
  { re: /\bNifty\b/i, name: 'NIFTY 50', type: 'index', symbol: 'NIFTY 50' },
  { re: /\bSensex\b/i, name: 'S&P BSE Sensex', type: 'index', symbol: 'SENSEX' },
  { re: /\bS&P 500\b|\bWall Street\b/i, name: 'S&P 500', type: 'index' },
  { re: /\bNasdaq\b/i, name: 'Nasdaq', type: 'index' },
  { re: /\bDow\b/, name: 'Dow Jones', type: 'index' },
  { re: /\bRBI\b|Reserve Bank of India/i, name: 'Reserve Bank of India', type: 'regulator' },
  { re: /\bSEBI\b/i, name: 'SEBI', type: 'regulator' },
  { re: /\bFed\b|Federal Reserve/i, name: 'US Federal Reserve', type: 'regulator' },
  { re: /\bECB\b|European Central Bank/i, name: 'European Central Bank', type: 'regulator' },
  { re: /\bcrude\b|\bBrent\b|\boil prices?\b/i, name: 'Crude oil', type: 'commodity' },
  { re: /\bgold\b/i, name: 'Gold', type: 'commodity' },
  { re: /\brupee\b|\bINR\b/i, name: 'Indian rupee', type: 'currency' },
  { re: /\bdollar\b|\bUSD\b/i, name: 'US dollar', type: 'currency' },
  { re: /\bbitcoin\b|\bcrypto/i, name: 'Crypto assets', type: 'commodity' },
];

// Topic → how it usually transmits to markets and what a reader should watch next.
const TOPICS: Array<{ id: string; label: string; re: RegExp; area: string; watch: string[]; why: string }> = [
  { id: 'rates', label: 'Interest rates', re: /\b(repo|rate (cut|hike)|interest rates?|monetary policy|yields?|bond)\b/i, area: 'Rates & bonds',
    why: 'Rate decisions change borrowing costs, EMIs, deposit returns and how richly stocks are valued.',
    watch: ['The next policy meeting date and the vote split', 'The 10-year government bond yield', 'Bank lending and deposit rate changes'] },
  { id: 'inflation', label: 'Inflation', re: /\b(inflation|CPI|WPI|prices rose|price rise)\b/i, area: 'Household costs',
    why: 'Inflation erodes the real return on savings and shapes the central bank’s next move.',
    watch: ['The next CPI release', 'Food and fuel price trends', 'Central bank commentary on the inflation outlook'] },
  { id: 'earnings', label: 'Earnings', re: /\b(profit|earnings|revenue|results|quarter|Q[1-4]|net income|margin|guidance)\b/i, area: 'Company fundamentals',
    why: 'Earnings are what share prices ultimately track; the gap between results and expectations moves prices.',
    watch: ['Management guidance for the next quarter', 'Margin trend versus the previous quarter', 'Analyst estimate revisions'] },
  { id: 'deals', label: 'Deals', re: /\b(merger|acquisition|acquire|deal|stake|buyout|IPO|listing|funding|raises?)\b/i, area: 'Corporate actions',
    why: 'Deals change a company’s growth path and balance sheet; the price paid decides whether value is created.',
    watch: ['Regulatory approvals and closing timeline', 'How the deal is funded (cash, debt or shares)', 'Valuation compared with peers'] },
  { id: 'energy', label: 'Energy', re: /\b(oil|crude|OPEC|gas|fuel|energy)\b/i, area: 'Commodities',
    why: 'Oil prices feed into inflation, the rupee and India’s import bill, and into margins for fuel-intensive sectors.',
    watch: ['Brent crude price', 'OPEC+ supply decisions', 'Fuel retailer and airline margins'] },
  { id: 'trade', label: 'Trade & tariffs', re: /\b(tariff|trade|export|import|duty|sanction)\b/i, area: 'Trade & supply chains',
    why: 'Tariffs and trade rules shift costs and demand for exporters, importers and their suppliers.',
    watch: ['Official notifications and effective dates', 'Response from trading partners', 'Export order and shipment data'] },
  { id: 'tech', label: 'Technology & AI', re: /\b(AI|artificial intelligence|chip|semiconductor|software|cloud|data centre|data center)\b/i, area: 'Technology',
    why: 'Technology spending cycles drive revenue for IT services, chipmakers and cloud providers.',
    watch: ['Capital-expenditure plans of large tech firms', 'Order books and deal wins for IT services', 'Chip supply and pricing'] },
  { id: 'banking', label: 'Banking & credit', re: /\b(bank|lender|loan|credit|NPA|deposit|NBFC)\b/i, area: 'Financials',
    why: 'Credit growth and asset quality decide bank profits and how easily households and firms can borrow.',
    watch: ['Credit and deposit growth', 'Asset-quality (NPA) trend', 'Net interest margin'] },
  { id: 'currency', label: 'Currency', re: /\b(rupee|dollar|currency|forex|exchange rate)\b/i, area: 'Currency',
    why: 'Currency moves change import costs, exporters’ earnings and the value of overseas investments.',
    watch: ['USD/INR level', 'Foreign portfolio flows', 'RBI forex intervention'] },
  { id: 'jobs', label: 'Jobs & growth', re: /\b(GDP|growth|jobs|employment|payrolls|layoffs?|recession|PMI)\b/i, area: 'Economy',
    why: 'Growth and jobs data set the backdrop for corporate earnings and policy decisions.',
    watch: ['The next GDP or PMI release', 'Hiring and layoff announcements', 'Consumer demand indicators'] },
  { id: 'regulation', label: 'Regulation', re: /\b(regulator|regulation|rules?|ban|probe|fine|penalty|SEBI|compliance|lawsuit)\b/i, area: 'Regulation',
    why: 'Regulatory action can change costs, restrict business lines or create one-off penalties.',
    watch: ['The final order or rule text', 'Company response and any appeal', 'Wider sector implications'] },
  { id: 'crypto', label: 'Crypto', re: /\b(bitcoin|crypto|ethereum|stablecoin|token)\b/i, area: 'Digital assets',
    why: 'Crypto prices react to liquidity, regulation and flows, and are far more volatile than equities.',
    watch: ['Regulatory statements', 'ETF and exchange flows', 'Stablecoin supply'] },
];

const POSITIVE = /\b(rise|rises|rose|gain|gains|gained|surge|surges|surged|jump|jumps|jumped|rally|rallies|record high|beat|beats|up \d|higher|growth|grew|boost|strong|upgrade|expands?|approval|approved|profit rose|recovers?|eases?|cut rates?)\b/gi;
const NEGATIVE = /\b(fall|falls|fell|drop|drops|dropped|slump|slumps|plunge|plunges|plunged|decline|declines|declined|loss|losses|miss|misses|missed|lower|weak|weaker|cut jobs|layoffs?|downgrade|probe|fine|penalty|ban|lawsuit|default|slowdown|recession|tariff hike|warns?|crash|sell-off|selloff)\b/gi;

// Metric words, most specific first; the nearest one before a number becomes its label.
const METRICS = ['net profit', 'profit', 'net loss', 'loss', 'revenue', 'sales', 'EBITDA', 'margin', 'dividend', 'repo rate', 'interest rate', 'yield', 'CPI inflation', 'inflation', 'GDP', 'growth', 'exports', 'imports', 'valuation', 'funding', 'deal', 'market cap', 'shares', 'stock', 'price', 'jobs', 'unemployment'];

function extractFigures(text: string): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  const re = /((?:₹|Rs\.?|\$|€|£)\s?\d[\d,.]*(?:\s?(?:lakh|crore|million|billion|trillion|bn|mn|cr|k))?|\d[\d,.]*\s?(?:%|per cent|percent|bps|basis points)|\d[\d,.]*\s?(?:lakh|crore|million|billion|trillion)\b)/gi;
  for (const m of text.matchAll(re)) {
    const value = m[0].trim().replace(/[.,]$/, '');
    const before = text.slice(Math.max(0, (m.index ?? 0) - 70), m.index ?? 0).toLowerCase();
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 30).toLowerCase();
    let best = '', at = -1;
    for (const k of METRICS) { const i = before.lastIndexOf(k.toLowerCase()); if (i > at) { at = i; best = k; } }
    if (!best) best = METRICS.find((k) => after.includes(k.toLowerCase())) ?? '';
    const change = /\b(rise|rose|up|gain|grew|jump|surge)/.test(before.slice(-30)) ? ' (up)' : /\b(fall|fell|down|drop|decline|slump)/.test(before.slice(-30)) ? ' (down)' : '';
    const label = best ? best.charAt(0).toUpperCase() + best.slice(1) + change : 'Reported figure';
    out.push({ label, value });
  }
  return uniq(out, (f) => f.value).slice(0, 5);
}

function scoreSentiment(text: string): { sentiment: BriefDirection; strength: number } {
  const pos = (text.match(POSITIVE) || []).length, neg = (text.match(NEGATIVE) || []).length;
  if (!pos && !neg) return { sentiment: 'unclear', strength: 0 };
  if (pos && neg && Math.abs(pos - neg) <= 1) return { sentiment: 'mixed', strength: pos + neg };
  return { sentiment: pos > neg ? 'positive' : 'negative', strength: Math.abs(pos - neg) };
}

const DIRECTION_WORD: Record<BriefDirection, string> = { positive: 'supportive', negative: 'a headwind', mixed: 'mixed', unclear: 'not yet clear' };

/** Deterministic brief from the headline and summary. */
export function buildRuleBasedNewsBrief(input: NewsBriefInput, now: Date = new Date()): NewsResearchBrief {
  const title = clean(input.title || 'Untitled headline');
  const summaryText = clean(input.summary || '');
  const text = `${title}. ${summaryText}`;
  const topics = TOPICS.filter((t) => t.re.test(text));
  const primary = topics[0];
  const entities = uniq(ENTITIES.filter((e) => e.re.test(text)).map(({ name, type, symbol }) => ({ name, type, symbol })), (e) => e.name).slice(0, 6);
  const figures = extractFigures(text);
  const { sentiment, strength } = scoreSentiment(text);
  const body = sentences(summaryText).filter((s) => s.toLowerCase() !== title.toLowerCase());

  const lead = entities.find((e) => e.type === 'company') ?? entities[0];
  const summary = body.length
    ? body.slice(0, 2).join(' ')
    : `${input.sourceName} reports: ${title}${/[.!?]$/.test(title) ? '' : '.'} Only the headline is available, so the detail behind it needs the full article.`;

  const keyPoints = uniq([
    ...body.slice(0, 3),
    ...figures.filter((f) => !body.some((b) => b.includes(f.value))).slice(0, 2).map((f) => `${f.label}: ${f.value} (as reported).`),
    lead ? `Main subject: ${lead.name}${lead.type === 'company' ? '' : ` (${lead.type})`}.` : '',
  ].filter(Boolean)).slice(0, 5);
  if (!keyPoints.length) keyPoints.push(title);

  const impact = topics.slice(0, 3).map((t) => ({
    area: t.area,
    direction: sentiment,
    note: `${t.label} news; on the reported facts the effect looks ${DIRECTION_WORD[sentiment]}. ${t.why}`,
  }));
  if (!impact.length) impact.push({ area: 'Markets', direction: 'unclear', note: 'The headline does not name a clear market channel. Read the full article before drawing a conclusion.' });

  const whyItMatters = primary
    ? `${primary.why}${lead ? ` Here it concerns ${lead.name}.` : ''}`
    : 'The supplied text does not show a direct link to prices, rates or household finances; treat it as context until the full article confirms more.';

  const whatToWatch = uniq(topics.flatMap((t) => t.watch)).slice(0, 4);
  if (!whatToWatch.length) whatToWatch.push('Follow-up reporting with figures and named sources', 'Any official statement or filing');

  const verify = uniq([
    'Read the full article; this brief uses only the headline and summary.',
    entities.some((e) => e.type === 'company') ? 'Check the company’s own exchange filing or press release.' : '',
    topics.some((t) => ['rates', 'inflation', 'jobs', 'currency'].includes(t.id)) ? 'Confirm figures against the official release (RBI, MoSPI, Fed or the relevant agency).' : '',
    figures.length ? 'Check whether reported figures are year-on-year, quarter-on-quarter or absolute.' : '',
  ].filter(Boolean));

  const confidence: NewsResearchBrief['confidence'] = !summaryText ? 'low' : strength >= 2 && figures.length ? 'medium' : 'low';

  return {
    headline: title,
    summary,
    keyPoints,
    whyItMatters,
    sentiment,
    confidence,
    topics: topics.map((t) => t.label).slice(0, 4),
    entities,
    figures,
    impact,
    whatToWatch,
    verify,
    source: { name: input.sourceName, url: input.sourceUrl, publishedAt: input.publishedAt ?? null },
    coverage: summaryText ? 'Headline and publisher summary' : 'Headline only',
    generatedBy: 'rules',
    asOf: now.toISOString(),
  };
}

const DIRS: BriefDirection[] = ['positive', 'negative', 'mixed', 'unclear'];
const str = (v: unknown, max = 600) => (typeof v === 'string' ? clean(v).slice(0, max) : '');
const strList = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => str(x, 280)).filter(Boolean).slice(0, n) : []);

/**
 * Validate an AI-produced brief (untrusted JSON) and merge it over the rule-based one. Entities, figures
 * and source metadata always come from the rules so the AI cannot introduce names or numbers that are
 * not in the text.
 */
export function mergeAiNewsBrief(rules: NewsResearchBrief, raw: unknown): NewsResearchBrief {
  if (!raw || typeof raw !== 'object') return rules;
  const o = raw as Record<string, unknown>;
  const summary = str(o.summary);
  const keyPoints = strList(o.keyPoints, 5);
  if (!summary || keyPoints.length < 2) return rules;
  const sentiment = DIRS.includes(o.sentiment as BriefDirection) ? (o.sentiment as BriefDirection) : rules.sentiment;
  const impact = Array.isArray(o.impact)
    ? o.impact.flatMap((row) => {
      const r = row as Record<string, unknown>;
      const area = str(r.area, 40), note = str(r.note, 280);
      return area && note ? [{ area, note, direction: DIRS.includes(r.direction as BriefDirection) ? (r.direction as BriefDirection) : 'unclear' as BriefDirection }] : [];
    }).slice(0, 4)
    : [];
  return {
    ...rules,
    summary,
    keyPoints,
    whyItMatters: str(o.whyItMatters) || rules.whyItMatters,
    sentiment,
    impact: impact.length ? impact : rules.impact,
    whatToWatch: strList(o.whatToWatch, 4).length ? strList(o.whatToWatch, 4) : rules.whatToWatch,
    verify: uniq([...strList(o.verify, 3), ...rules.verify]).slice(0, 4),
    confidence: o.confidence === 'high' || o.confidence === 'medium' || o.confidence === 'low' ? o.confidence : rules.confidence,
    generatedBy: 'ai',
  };
}

/** Pull the first JSON object out of a model reply (tolerates code fences and prose around it). */
export function parseJsonObject(text: string): unknown {
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}
