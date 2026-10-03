/**
 * Layer A — query parser. Turns a raw question into structure; it never answers.
 *
 * Two steps:
 *   1. Deterministic parse (always runs): amounts, time horizon, time-sensitivity, entities and intent from
 *      keyword and pattern rules (English, Hindi and Hinglish).
 *   2. Optional AI extraction (Groq, injected by the server): improves intent, entity and amount-type labels.
 *
 * Merge rules (the AI can label, never invent):
 *   - Amounts and horizons come ONLY from the user's text. An AI amount that is not in the question is dropped.
 *   - Entities must belong to the closed vocabulary in ./types.
 *   - The AI may relabel an amount's type only when the rules had to guess it.
 *   - is_novel comes from the answer cache and user_id from the verified session; the AI never sets either.
 *   - If the AI fails, times out or returns junk, the deterministic result is used as is.
 */
import {
  AMOUNT_TYPES,
  ENTITIES,
  INTENTS,
  type AiExtraction,
  type AiExtractor,
  type AmountType,
  type Entity,
  type Intent,
  type ParsedAmount,
  type ParseResult,
  type QueryLanguage,
  type TimeHorizon,
} from './types';

export const MAX_QUESTION_CHARS = 2000;
export const DEFAULT_AI_TIMEOUT_MS = 1500;

/* ------------------------------------------------------------------ */
/* Entities                                                           */
/* ------------------------------------------------------------------ */

const ENTITY_PATTERNS: ReadonlyArray<readonly [Entity, RegExp]> = [
  ['BANKNIFTY', /\bbank\s*nifty\b|\bnifty\s*bank\b/i],
  ['NIFTY', /(?<!\bbank\s*)\bnifty(?!\s*bank)(?:\s*50)?\b|निफ्टी/i],
  ['SENSEX', /\bsensex\b|सेंसेक्स/i],
  ['SP500', /\bs\s*&\s*p\s*500\b|\bsp\s*500\b|\bs and p\b/i],
  ['NASDAQ', /\bnasdaq\b/i],
  ['USDINR', /\busd\s*\/?\s*inr\b|\bdollar\b.*\brupee\b|\brupee\b.*\bdollar\b|डॉलर/i],
  ['FII_DII', /\bfiis?\b|\bdiis?\b|\bfpis?\b|foreign (?:institutional |portfolio )?investors?/i],
  ['REPO_RATE', /\brepo\b|\brbi\b.*\b(?:rate|policy)\b|\binterest rates? (?:cut|hike)/i],
  ['INFLATION', /\binflation\b|\bcpi\b|महंगाई|\bmehngai\b|\bmehangai\b/i],
  ['SIP', /\bsips?\b|systematic investment|एसआईपी/i],
  ['LUMP_SUM', /\blump\s*-?\s*sum\b|\bone[- ]time\b|\bek\s*saath\b|एकमुश्त/i],
  ['FD', /\bfds?\b|fixed deposits?|एफडी|सावधि जमा/i],
  ['RD', /\brds?\b|recurring deposits?/i],
  ['PPF', /\bppf\b|public provident fund/i],
  ['NPS', /\bnps\b|national pension/i],
  ['EPF', /\bepf\b|\bpf\b|employees'? provident fund/i],
  ['SSY', /\bssy\b|sukanya/i],
  ['ELSS', /\belss\b|tax[- ]saver (?:mutual )?funds?|tax[- ]saving (?:mutual )?funds?/i],
  ['MUTUAL_FUND', /mutual funds?|\bmfs?\b|म्यूचुअल फंड/i],
  ['INDEX_FUND', /index funds?|\betfs?\b/i],
  ['DEBT_FUND', /debt funds?|liquid funds?/i],
  ['STOCK', /\bstocks?\b|\bshares?\b|direct equity|शेयर/i],
  ['SGB', /\bsgbs?\b|sovereign gold/i],
  ['GOLD', /\bgold\b|सोना|\bsona\b/i],
  ['BTC', /\bbitcoin\b|\bbtc\b/i],
  ['ETH', /\bethereum\b|\beth\b/i],
  ['CRYPTO', /\bcrypto(?:currency|currencies)?\b|क्रिप्टो/i],
  ['REAL_ESTATE', /real estate|\bproperty\b|\bplot\b|प्रॉपर्टी/i],
  ['HOME_LOAN', /\bhome loan\b|\bhousing loan\b|होम लोन/i],
  ['CAR_LOAN', /\bcar loan\b|\bauto loan\b/i],
  ['PERSONAL_LOAN', /\bpersonal loan\b/i],
  ['EDUCATION_LOAN', /\beducation loan\b|\bstudent loan\b/i],
  ['EMI', /\bemis?\b|ईएमआई|\bkisht\b|किस्त/i],
  ['CREDIT_CARD', /\bcredit cards?\b/i],
  ['INCOME_TAX', /\bincome tax\b|\btax(?:es)?\b|टैक्स|\bitr\b|\b(?:new|old) regime\b/i],
  ['80C', /\b(?:section\s*)?80\s*c\b/i],
  ['80D', /\b(?:section\s*)?80\s*d\b/i],
  ['HRA', /\bhra\b|house rent allowance/i],
  ['LTCG', /\bltcg\b|long[- ]term capital gains?/i],
  ['STCG', /\bstcg\b|short[- ]term capital gains?/i],
  ['GST', /\bgst\b/i],
  ['TERM_INSURANCE', /\bterm (?:life )?(?:insurance|plan|cover|policy)\b/i],
  ['HEALTH_INSURANCE', /\bhealth insurance\b|\bmediclaim\b|\bmedical insurance\b/i],
  ['INSURANCE', /\binsurance\b|बीमा|\bbima\b/i],
  ['EMERGENCY_FUND', /\bemergency (?:fund|corpus|buffer)\b|\brainy day\b/i],
  ['RETIREMENT', /\bretire(?:ment|d)?\b|\bpension\b|रिटायर/i],
  ['EDUCATION', /\b(?:child(?:ren)?'?s?|kids?'?|son'?s?|daughter'?s?)\s+(?:higher\s+)?education\b|\bcollege fees?\b|\bhigher studies\b/i],
  ['HOUSE_PURCHASE', /\bbuy(?:ing)? (?:a |my )?(?:house|home|flat|apartment)\b|\bhome purchase\b|\bdown ?payment\b|घर खरीद/i],
];

const MARKET_ENTITIES = new Set<Entity>([
  'NIFTY',
  'SENSEX',
  'BANKNIFTY',
  'SP500',
  'NASDAQ',
  'USDINR',
  'FII_DII',
  'REPO_RATE',
  'INFLATION',
  'STOCK',
  'BTC',
  'ETH',
  'CRYPTO',
  'GOLD',
]);
const PRODUCT_ENTITIES = new Set<Entity>([
  'SIP',
  'LUMP_SUM',
  'FD',
  'RD',
  'PPF',
  'NPS',
  'EPF',
  'SSY',
  'ELSS',
  'MUTUAL_FUND',
  'INDEX_FUND',
  'DEBT_FUND',
  'STOCK',
  'GOLD',
  'SGB',
  'BTC',
  'ETH',
  'CRYPTO',
  'REAL_ESTATE',
  'HOME_LOAN',
  'TERM_INSURANCE',
  'HEALTH_INSURANCE',
  'NIFTY',
  'SP500',
  'NASDAQ',
]);

export function extractEntities(text: string): Entity[] {
  const found: Entity[] = [];
  for (const [entity, re] of ENTITY_PATTERNS) if (re.test(text)) found.push(entity);
  return found;
}

/* ------------------------------------------------------------------ */
/* Amounts                                                            */
/* ------------------------------------------------------------------ */

const UNIT_MULTIPLIER: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:k|thousand|हज़ार|हजार|hazar|hazaar)$/i, 1e3],
  [/^(?:l|lakh|lakhs|lac|lacs|लाख)$/i, 1e5],
  [/^(?:mn|million|millions)$/i, 1e6],
  [/^(?:cr|crore|crores|करोड़|करोड)$/i, 1e7],
];

const AMOUNT_RE =
  /(?<![\p{L}\p{N}.])(₹|rs\.?|inr|\$|usd)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|lacs?|l|crores?|cr|mn|millions?|हज़ार|हजार|hazaa?r|लाख|करोड़|करोड)?(?![\p{L}\p{N}])/giu;
const TIME_AFTER = /^\s*(?:-|\s)?(?:years?|yrs?|yr|y|months?|mos?|mo|days?|weeks?|saal|sal|mahine|mahina|वर्ष|साल|महीने|महीना|दिन)(?![\p{L}])/iu;
const PERCENT_AFTER = /^\s*(?:%|percent|per cent|प्रतिशत)/iu;
const AGE_BEFORE = /\b(?:age|aged|i am|i'm|im|umar|उम्र)\s*(?:is\s*)?$/i;

function multiplierFor(unit: string | undefined): number {
  if (!unit) return 1;
  for (const [re, m] of UNIT_MULTIPLIER) if (re.test(unit)) return m;
  return 1;
}

interface RuleAmount extends ParsedAmount {
  /** true when the type came from explicit words ("per month", "salary"); false when guessed. */
  explicit: boolean;
  period?: 'monthly' | 'yearly';
}

function classifyAmount(before: string, after: string): { type: AmountType; explicit: boolean; period?: 'monthly' | 'yearly' } {
  const b = before.toLowerCase();
  const a = after.toLowerCase();
  const near = `${b} ${a}`;
  const monthly =
    /(?:per|a|every|each|\/|har)\s*(?:month|mo\b|mahine|mahina)|\bmonthly\b|\bp\.?m\.?\b|प्रति माह|हर महीने|महीने/.test(a) || /\bmonthly\b/.test(b.slice(-25));
  const yearly =
    /(?:per|a|every|each|\/)\s*(?:year|annum|yr)|\byearly\b|\bannual(?:ly)?\b|\bp\.?a\.?\b|\blpa\b|सालाना|प्रति वर्ष/.test(a) ||
    /\b(?:ctc|annual|yearly)\b/.test(b.slice(-25));
  const period = monthly ? 'monthly' : yearly ? 'yearly' : undefined;
  const lastWords = b.slice(-40);
  if (
    /\b(?:salary|earn(?:ing)?s?|income|ctc|take[- ]home|package|lpa|kamata|kamati|kamai)\b|सैलरी|वेतन|कमाई|आय/.test(lastWords) ||
    /\blpa\b/.test(a.slice(0, 6))
  )
    return { type: 'income', explicit: true, period: period ?? (/\b(?:ctc|package|lpa)\b/.test(near) ? 'yearly' : undefined) };
  if (/\bloans?\s*(?:of|amount|for|:)?\s*$/.test(b)) return { type: 'lump_sum', explicit: true };
  if (/\b(?:spend(?:ing)?|expenses?|expenditure|kharch|kharcha|emi|rent)\b|खर्च|किराया/.test(lastWords)) return { type: 'expense', explicit: true, period };
  if (/\bsips?\s*(?:of|amount|:)?\s*$/.test(b)) return { type: 'monthly', explicit: true, period: 'monthly' };
  if (/\b(?:target|goal|corpus|need|want|become|reach|accumulate|build)\b|लक्ष्य/.test(lastWords)) return { type: 'target', explicit: true, period };
  if (monthly) return { type: 'monthly', explicit: true, period: 'monthly' };
  if (yearly) return { type: 'yearly', explicit: true, period: 'yearly' };
  if (/\b(?:lump\s*-?\s*sum|one[- ]time|bonus)\b/.test(near)) return { type: 'lump_sum', explicit: true };
  if (/\b(?:invest|investing|put|deposit|park|have|savings|saved|corpus of|lagana|lagau|lagaun)\b|निवेश/.test(lastWords))
    return { type: 'lump_sum', explicit: false };
  return { type: 'unknown', explicit: false };
}

export function extractAmounts(text: string): RuleAmount[] {
  const out: RuleAmount[] = [];
  for (const m of text.matchAll(AMOUNT_RE)) {
    const [raw, currencySign, digits, unit] = m;
    const index = m.index ?? 0;
    const after = text.slice(index + raw.length, index + raw.length + 30);
    const before = text.slice(Math.max(0, index - 45), index);
    if (!digits) continue;
    if (PERCENT_AFTER.test(after)) continue;
    if (!unit && TIME_AFTER.test(after)) continue;
    if (!currencySign && !unit && AGE_BEFORE.test(before)) continue;
    const base = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(base)) continue;
    // Bare numbers: years (2033), small counts ("top 3", "age 30") and section numbers are not money.
    if (!currencySign && !unit) {
      if (/^(?:19|20)\d{2}$/.test(digits)) continue;
      if (base < 1000) continue;
    }
    const value = Math.round(base * multiplierFor(unit) * 100) / 100;
    if (value <= 0) continue;
    const currency: 'INR' | 'USD' = currencySign && /\$|usd/i.test(currencySign) ? 'USD' : 'INR';
    const cls = classifyAmount(before, after);
    out.push({ value, currency, type: cls.type, raw: raw.trim(), explicit: cls.explicit, ...(cls.period ? { period: cls.period } : {}) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Time horizon and time-sensitivity                                  */
/* ------------------------------------------------------------------ */

export function extractHorizon(text: string, now: Date): TimeHorizon | null {
  const years = /(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:years?|yrs?|yr|saal|sal|वर्ष|साल)(?![\p{L}])/iu.exec(text);
  if (years?.[1] && !/\bold\b|\bage\b|उम्र/i.test(text.slice((years.index ?? 0) + years[0].length, (years.index ?? 0) + years[0].length + 6))) {
    const y = Number(years[1]);
    if (y > 0 && y <= 60) return y < 1 ? (`${Math.round(y * 12)}m` as TimeHorizon) : (`${Math.round(y)}y` as TimeHorizon);
  }
  const months = /(\d+)\s*(?:months?|mos?|mahine|mahina|महीने|महीना)(?![\p{L}])/iu.exec(text);
  if (months?.[1]) {
    const mo = Number(months[1]);
    if (mo > 0 && mo <= 720) return mo % 12 === 0 ? (`${mo / 12}y` as TimeHorizon) : (`${mo}m` as TimeHorizon);
  }
  const byYear = /\b(?:by|in|till|until|before|tak)\s+(20\d{2})\b/i.exec(text);
  if (byYear?.[1]) {
    const diff = Number(byYear[1]) - now.getFullYear();
    if (diff >= 1 && diff <= 60) return `${diff}y` as TimeHorizon;
  }
  const retireAt = /\bretire(?:ment)?\s*(?:at|by)\s*(?:age\s*)?(\d{2})\b/i.exec(text);
  const age = /\b(?:i am|i'm|im|age|aged|my age is)\s*(\d{2})\b|\b(\d{2})\s*(?:years?|yrs?)\s*old\b/i.exec(text);
  if (retireAt?.[1] && age) {
    const current = Number(age[1] ?? age[2]);
    const diff = Number(retireAt[1]) - current;
    if (diff >= 1 && diff <= 60) return `${diff}y` as TimeHorizon;
  }
  return null;
}

const STRONG_TIME = /\b(?:today|tonight|this week|this month|yesterday|breaking|latest|live|just now|this morning|aaj|kal)\b|आज|कल|ताज़ा/i;
const WEAK_TIME = /\b(?:now|right now|currently|current|at the moment|as of now|abhi|these days)\b|अभी/i;
const PRICE_WORDS = /\b(?:price|rate|level|market|trading|buy|sell|crash|fall|fell|drop|rally|up|down)\b/i;

export function isTimeSensitive(text: string, entities: Entity[]): boolean {
  if (STRONG_TIME.test(text)) return true;
  return WEAK_TIME.test(text) && (entities.some((e) => MARKET_ENTITIES.has(e)) || PRICE_WORDS.test(text));
}

/* ------------------------------------------------------------------ */
/* Intent                                                             */
/* ------------------------------------------------------------------ */

const ALERT_RE =
  /\b(?:alert me|notify me|remind me|tell me when|let me know when|ping me|set (?:an |a )?(?:alert|reminder)|warn me)\b|\b(?:crosses|falls below|goes above|drops below|breaks above|breaks below)\s+\d|batana jab|mujhe batao jab/i;
const COMPARE_RE = /\bvs\.?\b|\bversus\b|\bcompare|\bcomparison\b|which (?:one )?is better|\bbetter than\b|\bdifference between\b|\bor\b|\bya\b|या/i;
const EXPLICIT_COMPARE_RE = /\bvs\.?\b|\bversus\b|\bcompare|\bcomparison\b|which (?:one )?is better|\bdifference between\b/i;
const PLAN_RE =
  /\bplan(?:ning)?\b|\bretire|\bgoal\b|how much (?:should|do|must) i (?:need|save|invest|keep)|\bsave for\b|\bcorpus\b|\bachieve\b|\breach\b|\bafford\b|\broadmap\b|\bstrategy\b|\ballocat(?:e|ion)\b|\bportfolio for\b|\bprepare for\b/i;
const CALC_RE =
  /\bcalculate\b|\bhow much\b|\bwhat (?:will|would|is the|are the)\b.*\b(?:be|get|pay|emi|return|value|maturity|tax)\b|\bemi\b|\breturns?\b|\bmaturity\b|\btax on\b|\binterest on\b|\bkitna\b|\bkitne\b|कितना|कितने|\bgrow\b|\bbecome\b|\bworth\b/i;

export function detectIntent(text: string, entities: Entity[], amounts: RuleAmount[]): Intent {
  if (ALERT_RE.test(text)) return 'ALERT';
  const products = entities.filter((e) => PRODUCT_ENTITIES.has(e)).length;
  if (EXPLICIT_COMPARE_RE.test(text) || (products >= 2 && COMPARE_RE.test(text))) return 'COMPARE';
  if (PLAN_RE.test(text)) return 'PLAN';
  if (amounts.length > 0 && (CALC_RE.test(text) || entities.some((e) => e === 'EMI' || e === 'INCOME_TAX' || e === 'SIP' || e === 'FD'))) return 'CALCULATE';
  if (CALC_RE.test(text) && /\d/.test(text)) return 'CALCULATE';
  return 'EXPLAIN';
}

/* ------------------------------------------------------------------ */
/* Language, fingerprint                                              */
/* ------------------------------------------------------------------ */

const HINGLISH_WORDS =
  /\b(?:kya|hai|hain|mein|main|karu|karun|karna|kaise|kitna|kitne|paisa|paise|mujhe|mera|meri|mere|chahiye|lena|lagana|lagau|aur|nahi|kab|abhi|aaj|saal|mahine|accha|behtar|sahi|batao|bataiye)\b/gi;

export function detectLanguage(text: string): QueryLanguage {
  const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length || 1;
  if (devanagari / letters > 0.3) return 'hi';
  return (text.match(HINGLISH_WORDS) ?? []).length >= 2 ? 'hinglish' : 'en';
}

function fnv1a(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Stable cache key: the same question with the same numbers maps to the same key regardless of case or spacing. */
export function fingerprint(text: string, amounts: ParsedAmount[], horizon: TimeHorizon | null): string {
  const norm = `${text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()}|${amounts.map((a) => `${a.value}:${a.type}`).join(',')}|${horizon ?? ''}`;
  return `${fnv1a(norm, 0x811c9dc5)}${fnv1a(norm, 0x9747b28c)}`;
}

/* ------------------------------------------------------------------ */
/* Deterministic parse                                                */
/* ------------------------------------------------------------------ */

export interface RuleParse {
  intent: Intent;
  entities: Entity[];
  amounts: RuleAmount[];
  time_horizon: TimeHorizon | null;
  is_time_sensitive: boolean;
  language: QueryLanguage;
}

export function cleanQuestion(raw: string): string {
  // eslint-disable-next-line no-control-regex -- strip control characters from user input
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUESTION_CHARS);
}

export function parseDeterministic(question: string, now = new Date()): RuleParse {
  const text = cleanQuestion(question);
  const entities = extractEntities(text);
  const amounts = extractAmounts(text);
  return {
    intent: detectIntent(text, entities, amounts),
    entities,
    amounts,
    time_horizon: extractHorizon(text, now),
    is_time_sensitive: isTimeSensitive(text, entities),
    language: detectLanguage(text),
  };
}

/* ------------------------------------------------------------------ */
/* AI merge                                                           */
/* ------------------------------------------------------------------ */

const isIntent = (v: unknown): v is Intent => typeof v === 'string' && (INTENTS as readonly string[]).includes(v.toUpperCase());
const isEntity = (v: string): v is Entity => (ENTITIES as readonly string[]).includes(v);
const isAmountType = (v: unknown): v is AmountType => typeof v === 'string' && (AMOUNT_TYPES as readonly string[]).includes(v);

function normaliseEntity(v: unknown): string {
  return typeof v === 'string'
    ? v
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_')
        .replace(/^S&P_?500$/, 'SP500')
    : '';
}

interface Merged {
  intent: Intent;
  entities: Entity[];
  amounts: RuleAmount[];
  time_horizon: TimeHorizon | null;
  is_time_sensitive: boolean;
  corrections: string[];
}

export function mergeAi(rules: RuleParse, ai: AiExtraction, question: string): Merged {
  const corrections: string[] = [];

  let intent = rules.intent;
  if (isIntent(ai.intent)) intent = ai.intent.toUpperCase() as Intent;
  else if (ai.intent !== undefined) corrections.push(`AI intent "${String(ai.intent)}" is not a known intent; kept "${rules.intent}".`);

  const entities: Entity[] = [...rules.entities];
  if (Array.isArray(ai.entities)) {
    for (const raw of ai.entities.slice(0, 30)) {
      const e = normaliseEntity(raw);
      if (!e) continue;
      if (!isEntity(e)) {
        corrections.push(`Dropped AI entity "${String(raw)}": not in the vocabulary.`);
        continue;
      }
      if (!entities.includes(e)) entities.push(e);
    }
  }

  const amounts = rules.amounts.map((a) => ({ ...a }));
  if (Array.isArray(ai.amounts)) {
    for (const item of ai.amounts.slice(0, 20)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const value = Number(rec.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      const match = amounts.find((a) => Math.abs(a.value - value) <= Math.max(0.01, a.value * 0.005));
      if (!match) {
        corrections.push(`Dropped AI amount ${value}: it does not appear in the question.`);
        continue;
      }
      if (isAmountType(rec.type) && !match.explicit && rec.type !== match.type) {
        corrections.push(`Amount ${match.raw}: type "${match.type}" relabelled "${rec.type}" by AI (rules had to guess).`);
        match.type = rec.type;
      }
    }
  }

  let horizon = rules.time_horizon;
  if (!horizon && typeof ai.time_horizon === 'string') {
    const h = /^(\d+(?:\.\d+)?)\s*(y|m)$/i.exec(ai.time_horizon.trim());
    const digits: string[] = question.match(/\d+(?:\.\d+)?/g) ?? [];
    if (h?.[1] && h[2] && digits.includes(h[1])) horizon = `${Number(h[1])}${h[2].toLowerCase()}` as TimeHorizon;
    else if (ai.time_horizon.trim()) corrections.push(`Dropped AI horizon "${ai.time_horizon}": not stated in the question.`);
  }

  return {
    intent,
    entities,
    amounts,
    time_horizon: horizon,
    is_time_sensitive: rules.is_time_sensitive || ai.is_time_sensitive === true,
    corrections,
  };
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                 */
/* ------------------------------------------------------------------ */

export interface ParseOptions {
  userId?: string;
  /** AI extractor (the server passes a Groq one). Omit for rules only. */
  ai?: AiExtractor;
  aiTimeoutMs?: number;
  /** Answer-cache lookup by fingerprint. Without it every question counts as novel. */
  hasCachedAnswer?: (fingerprint: string) => boolean | Promise<boolean>;
  now?: Date;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI extraction timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

const publicAmount = ({ value, currency, type, raw }: RuleAmount): ParsedAmount => ({ value, currency, type, raw });

export async function parseQuery(question: string, opts: ParseOptions = {}): Promise<ParseResult> {
  const started = Date.now();
  const text = cleanQuestion(question);
  const rules = parseDeterministic(text, opts.now);

  let merged: Merged = { ...rules, amounts: rules.amounts, corrections: [] };
  let method: 'ai+rules' | 'rules' = 'rules';
  let aiError: string | null = null;
  if (opts.ai && text) {
    try {
      const ai = await withTimeout(opts.ai(text), opts.aiTimeoutMs ?? DEFAULT_AI_TIMEOUT_MS);
      if (!ai || typeof ai !== 'object') throw new Error('AI returned no structure');
      merged = mergeAi(rules, ai, text);
      method = 'ai+rules';
    } catch (e) {
      aiError = e instanceof Error ? e.message : 'AI extraction failed';
    }
  }

  const amounts = merged.amounts.map(publicAmount);
  const fp = fingerprint(text, amounts, merged.time_horizon);
  let novel = true;
  if (opts.hasCachedAnswer) {
    try {
      novel = !(await opts.hasCachedAnswer(fp));
    } catch {
      novel = true;
    }
  }

  return {
    parsed: {
      intent: merged.intent,
      entities: merged.entities,
      amounts,
      time_horizon: merged.time_horizon,
      is_time_sensitive: merged.is_time_sensitive,
      is_novel: novel,
      user_id: opts.userId ?? 'anonymous',
    },
    meta: {
      method,
      ai_error: aiError,
      corrections: merged.corrections,
      rules_intent: rules.intent,
      language: rules.language,
      fingerprint: fp,
      latency_ms: Date.now() - started,
    },
  };
}
