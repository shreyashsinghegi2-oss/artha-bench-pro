import { describe, expect, it, vi } from 'vitest';
import { RagEngine, buildContext, extractCitations, sourceLabel, type RagPassage } from '../rag/rag_engine';

const passage = (n: number, over: Partial<RagPassage> = {}): RagPassage => ({
  citation: n,
  id: `d:${n}`,
  text: `Passage ${n} text`,
  section: `Section ${n}`,
  score: 1 / n,
  rrf: 0.03,
  vector_rank: n,
  keyword_rank: n,
  source: `doc${n}.pdf`,
  title: `Title ${n}`,
  authority: 'SEBI',
  date: '2026-03-12',
  url: null,
  ...over,
});

describe('RagEngine.retrieve', () => {
  it('is disabled without a sidecar URL and never calls fetch', async () => {
    const fetchImpl = vi.fn();
    const r = await new RagEngine({ baseUrl: '', fetchImpl: fetchImpl as unknown as typeof fetch }).retrieve('repo rate');
    expect(r.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the query and returns passages with context', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [passage(1)], context: 'CTX' }), { status: 200 }));
    const engine = new RagEngine({ baseUrl: 'http://rag:8765/', fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await engine.retrieve('  expense ratio  ', { topK: 3, authority: 'SEBI' });
    expect(r.ok).toBe(true);
    expect(r.passages[0].citation).toBe(1);
    expect(r.context).toBe('CTX');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://rag:8765/query');
    expect(JSON.parse(String(init.body))).toEqual({ query: 'expense ratio', top_k: 3, authority: 'SEBI' });
  });

  it('builds context locally when the sidecar omits it', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [passage(1)] }), { status: 200 }));
    const r = await new RagEngine({ baseUrl: 'http://rag', fetchImpl: fetchImpl as unknown as typeof fetch }).retrieve('q');
    expect(r.context).toContain('[1] SEBI · Title 1 · Section 1 · 2026-03-12');
  });

  it.each([
    ['HTTP error', async () => new Response('{}', { status: 500 })],
    [
      'network error',
      async () => {
        throw new Error('ECONNREFUSED');
      },
    ],
    ['bad JSON shape', async () => new Response(JSON.stringify({ results: 'nope' }), { status: 200 })],
  ])('degrades gracefully on %s', async (_label, impl) => {
    const r = await new RagEngine({ baseUrl: 'http://rag', fetchImpl: vi.fn(impl) as unknown as typeof fetch }).retrieve('q');
    expect(r.passages).toEqual([]);
  });

  it('times out slow sidecars', async () => {
    const slow = vi.fn(
      (_u: string, init: RequestInit) => new Promise<Response>((_res, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
    );
    const r = await new RagEngine({ baseUrl: 'http://rag', timeoutMs: 20, fetchImpl: slow as unknown as typeof fetch }).retrieve('q');
    expect(r.ok).toBe(false);
  });

  it('rejects empty queries without a network call', async () => {
    const fetchImpl = vi.fn();
    expect((await new RagEngine({ baseUrl: 'http://rag', fetchImpl: fetchImpl as unknown as typeof fetch }).retrieve('   ')).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('citations', () => {
  const ps = [passage(1), passage(2, { authority: 'RBI' }), passage(3)];
  it('maps [n] and [a, b] markers to passages in first-use order', () => {
    const r = extractCitations('TER is lower in direct plans [2]. Also [1, 3] and again [2].', ps);
    expect(r.cited.map((p) => p.citation)).toEqual([2, 1, 3]);
    expect(r.invalid).toEqual([]);
    expect(r.uncitedAnswer).toBe(false);
  });
  it('reports citation numbers that point nowhere', () => {
    expect(extractCitations('See [7] and [0].', ps).invalid).toEqual([7, 0]);
  });
  it('flags answers without citations', () => {
    expect(extractCitations('No sources.', ps).uncitedAnswer).toBe(true);
    expect(extractCitations('', []).cited).toEqual([]);
  });
  it('builds labelled context and truncates long passages', () => {
    const ctx = buildContext([passage(1, { text: 'x'.repeat(2000) })]);
    expect(ctx).toContain(`${'x'.repeat(1800)} …`);
    expect(buildContext([])).toBe('');
  });
  it('labels sources', () => {
    expect(sourceLabel(passage(1))).toBe('SEBI · Title 1 (2026-03-12)');
    expect(sourceLabel(passage(1, { title: null, date: null }))).toBe('SEBI · doc1.pdf');
  });
});
