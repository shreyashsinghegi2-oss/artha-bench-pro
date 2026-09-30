/**
 * TypeScript client for the RAG sidecar (rag/server.py).
 *
 * The Express API calls `retrieve()` before an LLM request, injects `context` into the system prompt, and after
 * the answer arrives calls `extractCitations()` to map "[n]" markers back to their sources. Every call has a short
 * timeout and failures resolve to an empty result, so the assistant still answers (without document citations)
 * when the sidecar is down.
 */

export type Authority = 'SEBI' | 'RBI' | 'CBDT' | 'AMFI' | 'NSE' | 'BSE' | 'OTHER';

export interface RagPassage {
  citation: number;
  id: string;
  text: string;
  section: string | null;
  score: number;
  rrf: number;
  vector_rank: number | null;
  keyword_rank: number | null;
  source: string | null;
  title: string | null;
  authority: Authority | null;
  date: string | null;
  url: string | null;
}

export interface RagResult {
  passages: RagPassage[];
  context: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}
export interface CitationReport {
  cited: RagPassage[];
  invalid: number[];
  uncitedAnswer: boolean;
}

export interface RagEngineOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const EMPTY = (error: string, latencyMs: number): RagResult => ({ passages: [], context: '', ok: false, error, latencyMs });

export class RagEngine {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RagEngineOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.RAG_SIDECAR_URL ?? '').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? (Number(process.env.RAG_TIMEOUT_MS) || 2500);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get enabled(): boolean {
    return this.baseUrl.length > 0;
  }

  async retrieve(query: string, opts: { topK?: number; authority?: Authority } = {}): Promise<RagResult> {
    const started = Date.now();
    if (!this.enabled) return EMPTY('RAG sidecar not configured', 0);
    const q = query.trim().slice(0, 1000);
    if (!q) return EMPTY('empty query', 0);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, top_k: opts.topK ?? 5, ...(opts.authority ? { authority: opts.authority } : {}) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) return EMPTY(`sidecar HTTP ${res.status}`, Date.now() - started);
      const data = (await res.json()) as { results?: RagPassage[]; context?: string };
      const passages = Array.isArray(data.results) ? data.results : [];
      return { passages, context: typeof data.context === 'string' ? data.context : buildContext(passages), ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return EMPTY(error instanceof Error ? error.message : 'sidecar unreachable', Date.now() - started);
    }
  }

  async health(): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(this.timeoutMs) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

/** Same format as rag/retriever.py build_context, for passages that arrive without a context string. */
export function buildContext(passages: RagPassage[], maxChars = 1800): string {
  if (!passages.length) return '';
  const lines = ['OFFICIAL DOCUMENTS (retrieved). Cite each fact you use as [n]; if these passages do not answer the question, say so.'];
  for (const p of passages) {
    const where = [p.authority, p.title, p.section, p.date].filter(Boolean).join(' · ');
    const text = p.text.length <= maxChars ? p.text : `${p.text.slice(0, maxChars)} …`;
    lines.push(`[${p.citation}] ${where}\n${text}`);
  }
  return lines.join('\n\n');
}

const CITE_RE = /\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\]/g;

/** Which passages an answer cites ("[2]", "[1, 3]"), and citation numbers that point nowhere. */
export function extractCitations(answer: string, passages: RagPassage[]): CitationReport {
  const byNum = new Map(passages.map((p) => [p.citation, p]));
  const used: number[] = [];
  const invalid: number[] = [];
  for (const match of (answer ?? '').matchAll(CITE_RE)) {
    for (const part of match[1].split(',')) {
      const n = Number(part.trim());
      const bucket = byNum.has(n) ? used : invalid;
      if (!bucket.includes(n)) bucket.push(n);
    }
  }
  return { cited: used.map((n) => byNum.get(n)!), invalid, uncitedAnswer: used.length === 0 };
}

/** Short source label for UI or logs, e.g. "SEBI · Master Circular on Mutual Funds (2026-03-12)". */
export function sourceLabel(p: RagPassage): string {
  const main = [p.authority, p.title ?? p.source].filter(Boolean).join(' · ');
  return p.date ? `${main} (${p.date})` : main;
}

export const ragEngine = new RagEngine();
