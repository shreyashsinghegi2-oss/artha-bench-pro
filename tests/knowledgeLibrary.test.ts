import { describe, expect, it } from 'vitest';
import { chunkText, rankPassages, referenceBlock } from '../src/services/knowledgeLibrary';

describe('tutor knowledge library', () => {
  it('retrieves the right formula-book entry for common questions', () => {
    const top = (q: string) => { const h = rankPassages(q, [], 1)[0]; return h && h.kind === 'formula' ? h.entry.id : null; };
    expect(top('How is EMI calculated for a home loan?')).toBe('emi');
    expect(top('What is CAGR?')).toBe('cagr');
    expect(top('How much SIP do I need for 1 crore target corpus?')).toBe('sip-target');
    expect(top('Explain the new tax regime slabs')).toBe('new-regime');
    expect(top('What is HRA exemption?')).toBe('hra');
    expect(top('How does the repo rate affect my EMI?')).toMatch(/repo-rate|emi/);
    expect(top('What is the Keynesian multiplier?')).toBe('multiplier');
  });

  it('ranks a passage from the learner’s own document', () => {
    const docs = [{ id: '1', name: 'Bonds notes.pdf', size: 1, addedAt: '', chunks: ['Duration measures how sensitive a bond price is to changes in interest rates. Modified duration approximates the percentage price change.'] }];
    const hits = rankPassages('what is modified duration of a bond', docs, 3);
    expect(hits[0]).toMatchObject({ kind: 'doc', docName: 'Bonds notes.pdf' });
  });

  it('builds a numbered reference block with exact formulas', () => {
    const block = referenceBlock(rankPassages('emi formula', [], 1));
    expect(block).toMatch(/^REFERENCE PASSAGES/);
    expect(block).toContain('[1] ArthaMind formula book: EMI');
    expect(block).toContain('EMI = P × i × (1 + i)^n ÷ [(1 + i)^n − 1]');
  });

  it('chunks long text on sentence boundaries', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} explains compounding in detail.`).join(' ');
    const chunks = chunkText(text, 300);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.length <= 450)).toBe(true);
    expect(chunks.join(' ')).toBe(text);
  });
});
