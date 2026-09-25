/**
 * Reads a public web page the user shares so the AI can analyse it (a fund factsheet, a news story,
 * a company page). Safety: http(s) only, public addresses only (every DNS answer and every redirect
 * is checked, so it cannot reach internal services), 1.5 MB cap, 10-second timeout, text only.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface WebPage { url: string; title: string; description: string; text: string; retrievedAt: string }

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

/** True for loopback, private, link-local, carrier-grade NAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff');
}

async function assertPublic(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only web links (http or https) can be read.');
  if (url.username || url.password) throw new Error('Links with passwords cannot be read.');
  if (url.port && !['80', '443', '8080', '8443'].includes(url.port)) throw new Error('This link uses an unusual port and cannot be read.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new Error('This address cannot be read.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('This address cannot be read.');
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', rupee: '₹' };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENTITIES[e.toLowerCase()] ?? m;
});

/** Readable text from HTML: drops scripts, styles, navigation and markup; keeps headings and paragraphs. */
export function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    ?? html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? '').trim();
  const body = html
    .replace(/<(script|style|noscript|svg|iframe|template|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  const text = decode(body).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l.length > 2).join('\n');
  return { title, description, text };
}

export async function readWebPage(raw: string): Promise<WebPage> {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error('That does not look like a web link.'); }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ArthaMindReader/1.0; +https://artha-bench-pro.vercel.app)', Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' } });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('The page redirected without a destination.');
      url = new URL(loc, url);
      continue;
    }
    if (!res.ok) throw new Error(`The page answered with HTTP ${res.status}.`);
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!/text\/html|text\/plain|application\/(json|xhtml)/.test(type)) throw new Error('Only web pages and text can be read (not files or images).');
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); break; }
      chunks.push(value);
    }
    const bodyText = new TextDecoder().decode(Buffer.concat(chunks));
    const parsed = type.includes('html') ? htmlToText(bodyText) : { title: url.hostname, description: '', text: bodyText.replace(/\s+\n/g, '\n').trim() };
    return { url: url.toString(), title: parsed.title || url.hostname, description: parsed.description, text: parsed.text.slice(0, 12_000), retrievedAt: new Date().toISOString() };
  }
  throw new Error('The page redirected too many times.');
}

/** Links in a user's message (at most two). */
export const linksIn = (text: string) => [...new Set(text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [])].map((u) => u.replace(/[.,;:!?]+$/, '')).slice(0, 2);
