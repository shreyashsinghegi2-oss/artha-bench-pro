/**
 * Polite fetching for official sites: domain allowlist, robots.txt, descriptive User-Agent,
 * and 403/429 reported as HostThrottledError so the registry backs off from that host.
 */
import { HostThrottledError } from './types';

export const USER_AGENT = 'ArthaMindAI/1.0 (+https://artha-bench-pro.vercel.app; education research assistant)';

/** Official Indian financial sources the pipeline may read directly. Anything else is refused. */
export const OFFICIAL_HOSTS = [
  'rbi.org.in',
  'sebi.gov.in',
  'incometaxindia.gov.in',
  'incometax.gov.in',
  'amfiindia.com',
  'nseindia.com',
  'bseindia.com',
  'pib.gov.in',
  'data.gov.in',
  'finmin.gov.in',
  'indiabudget.gov.in',
  'cbic-gst.gov.in',
  'irdai.gov.in',
  'pfrda.org.in',
] as const;

export function isOfficialUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function publisherFor(raw: string | undefined): string {
  try {
    const host = new URL(raw ?? '').hostname.replace(/^www\./, '');
    const names: Record<string, string> = {
      'rbi.org.in': 'RBI',
      'sebi.gov.in': 'SEBI',
      'incometaxindia.gov.in': 'Income Tax Department',
      'incometax.gov.in': 'Income Tax Department',
      'amfiindia.com': 'AMFI',
      'nseindia.com': 'NSE',
      'bseindia.com': 'BSE',
      'pib.gov.in': 'PIB',
      'data.gov.in': 'data.gov.in',
      'finmin.gov.in': 'Ministry of Finance',
      'indiabudget.gov.in': 'Union Budget',
      'cbic-gst.gov.in': 'CBIC',
      'irdai.gov.in': 'IRDAI',
      'pfrda.org.in': 'PFRDA',
    };
    return Object.entries(names).find(([h]) => host === h || host.endsWith(`.${h}`))?.[1] ?? host;
  } catch {
    return 'unknown';
  }
}

// ---- robots.txt ------------------------------------------------------------------------------------
const robotsCache = new Map<string, { at: number; disallow: string[] }>();
const robotsInflight = new Map<string, Promise<string[]>>();
const ROBOTS_TTL = 24 * 3600_000;

/** Disallow rules that apply to every agent ("User-agent: *") or to ours. */
export function parseRobots(txt: string): string[] {
  const rules: string[] = [];
  let applies = false;
  let sawRule = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      if (sawRule) {
        applies = false;
        sawRule = false;
      }
      if (value === '*' || /arthamind/i.test(value)) applies = true;
    } else if (key === 'disallow') {
      sawRule = true;
      if (applies && value) rules.push(value);
    } else if (key === 'allow') {
      sawRule = true;
    }
  }
  return rules;
}

/** Robots.txt matching: prefix match, "*" wildcard, "$" end anchor. */
export function robotsAllows(disallow: string[], path: string): boolean {
  return !disallow.some((rule) => {
    const anchored = rule.endsWith('$');
    const body = (anchored ? rule.slice(0, -1) : rule).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
  });
}

/**
 * RFC 9309: a robots.txt that answers 4xx means no restrictions; one that cannot be fetched (network
 * error or 5xx) means assume everything is disallowed, so we do not read that site until it answers.
 */
export async function allowedByRobots(url: URL, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<boolean> {
  const origin = url.origin;
  let entry = robotsCache.get(origin);
  if (!entry || now - entry.at > ROBOTS_TTL) {
    // One robots.txt request per origin at a time, even when several feeds on it are read in parallel.
    let pending = robotsInflight.get(origin);
    if (!pending) {
      pending = (async () => {
        try {
          const res = await fetchImpl(`${origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(2_500) });
          return res.ok ? parseRobots(await res.text()) : res.status >= 500 ? ['/'] : [];
        } catch {
          return ['/'];
        }
      })().finally(() => robotsInflight.delete(origin));
      robotsInflight.set(origin, pending);
    }
    const disallow = await pending;
    // An unreachable robots.txt is retried after 10 minutes rather than a day.
    entry = { at: disallow.length === 1 && disallow[0] === '/' ? now - ROBOTS_TTL + 10 * 60_000 : now, disallow };
    robotsCache.set(origin, entry);
  }
  return robotsAllows(entry.disallow, url.pathname + url.search);
}

/**
 * GET an official URL as text: allowlist on every hop (redirects are followed manually), robots.txt,
 * descriptive User-Agent, and 403/429 reported as HostThrottledError for back-off.
 */
export async function politeGetText(raw: string, opts: { fetchImpl?: typeof fetch; timeoutMs?: number; maxBytes?: number } = {}): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`not a URL: ${raw}`);
  }
  for (let hop = 0; hop < 4; hop++) {
    if (!isOfficialUrl(url.toString())) throw new Error(`not an allowlisted official host: ${url.hostname}`);
    if (!(await allowedByRobots(url, fetchImpl))) throw new Error(`robots.txt disallows ${url.pathname}`);
    const res = await fetchImpl(url, {
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml,application/xml,text/xml,text/html;q=0.9,*/*;q=0.5' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 3_500),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location') as string, url);
      continue;
    }
    if (res.status === 403 || res.status === 429) throw new HostThrottledError(url.hostname, res.status);
    if (!res.ok) throw new Error(`${url.hostname} answered HTTP ${res.status}`);
    return (await res.text()).slice(0, opts.maxBytes ?? 600_000);
  }
  throw new Error('too many redirects');
}

export function resetRobotsCache() {
  robotsCache.clear();
  robotsInflight.clear();
}
