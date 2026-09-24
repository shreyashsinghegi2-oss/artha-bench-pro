/**
 * Tutor knowledge library: the verified formula book plus documents the user adds (PDF or text).
 * Documents are read on the device, split into passages and kept in IndexedDB; nothing is uploaded.
 * Before the tutor answers, the most relevant passages are retrieved (BM25 ranking) and sent with the
 * question so the answer uses the exact formula or text, and the UI shows which passages were used.
 */
import { KNOWLEDGE, type KnowledgeEntry } from '../data/financeKnowledge';

export interface LibraryDoc { id: string; name: string; size: number; addedAt: string; chunks: string[] }
export type LibraryHit =
  | { kind: 'formula'; score: number; entry: KnowledgeEntry }
  | { kind: 'doc'; score: number; docName: string; text: string };

const STOP = new Set('a an and are as at be by for from how i in is it of on or that the this to what when which why with you your my me do does can should about'.split(' '));
export const tokenize = (s: string) => s.toLowerCase().replace(/[₹%]/g, ' ').split(/[^a-z0-9/]+/).filter((t) => t.length > 1 && !STOP.has(t));

/** Split text into ~900-character passages on sentence boundaries. */
export function chunkText(text: string, size = 900): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + ' ' + s).length > size && cur) { out.push(cur.trim()); cur = s; } else cur = cur ? `${cur} ${s}` : s;
    while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const entryText = (e: KnowledgeEntry) => [e.title, e.title, e.keywords.join(' '), e.keywords.join(' '), e.summary, e.formula ?? '', (e.notes ?? []).join(' '), e.chapter].join(' ');

/** BM25 over formula-book entries and document passages. */
export function rankPassages(query: string, docs: LibraryDoc[], k = 4): LibraryHit[] {
  const q = tokenize(query);
  if (!q.length) return [];
  type Item = { tokens: string[]; hit: { kind: 'formula'; entry: KnowledgeEntry } | { kind: 'doc'; docName: string; text: string } };
  const items: Item[] = [
    ...KNOWLEDGE.map((entry) => ({ tokens: tokenize(entryText(entry)), hit: { kind: 'formula' as const, entry } })),
    ...docs.flatMap((d) => d.chunks.map((text) => ({ tokens: tokenize(text), hit: { kind: 'doc' as const, docName: d.name, text } }))),
  ];
  const N = items.length, avg = items.reduce((s, i) => s + i.tokens.length, 0) / Math.max(1, N);
  const df = new Map<string, number>();
  for (const it of items) for (const t of new Set(it.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const k1 = 1.4, b = 0.75;
  const scored = items.map((it) => {
    const tf = new Map<string, number>();
    for (const t of it.tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of q) {
      const f = tf.get(t); if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * it.tokens.length) / avg)));
    }
    // Exact keyword phrase in the question is a strong signal for formula entries.
    if (it.hit.kind === 'formula') for (const kw of it.hit.entry.keywords) if (kw.includes(' ') && query.toLowerCase().includes(kw)) score += 3;
    return { ...it.hit, score } as LibraryHit;
  });
  return scored.filter((h) => h.score > 1.2).sort((a, b) => b.score - a.score).slice(0, k);
}

/** Reference block sent with the question. */
export function referenceBlock(hits: LibraryHit[]): string {
  if (!hits.length) return '';
  const lines = hits.map((h, i) => h.kind === 'formula'
    ? `[${i + 1}] ArthaMind formula book: ${h.entry.title}. ${h.entry.summary}${h.entry.formula ? ` Formula: ${h.entry.formula}.` : ''}${h.entry.example ? ` Worked example: ${h.entry.example.inputs} → ${h.entry.example.result}.` : ''}${h.entry.notes ? ` Notes: ${h.entry.notes.join(' ')}` : ''} (Reference: ${h.entry.reference})`
    : `[${i + 1}] From the learner's document "${h.docName}": ${h.text.slice(0, 900)}`);
  return `REFERENCE PASSAGES (retrieved from the ArthaMind library; use these formulas and figures exactly, cite them as [n], and say if they do not cover the question):\n${lines.join('\n')}`;
}

// ---------------- IndexedDB storage ----------------

const DB = 'arthamind-library', STORE = 'docs';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => { const r = fn(db.transaction(STORE, mode).objectStore(STORE)); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

export const LIBRARY_EVENT = 'arthamind:library-changed';
export async function listDocs(): Promise<LibraryDoc[]> { try { return (await tx<LibraryDoc[]>('readonly', (s) => s.getAll() as IDBRequest<LibraryDoc[]>)).sort((a, b) => b.addedAt.localeCompare(a.addedAt)); } catch { return []; } }
export async function deleteDoc(id: string) { await tx('readwrite', (s) => s.delete(id)); window.dispatchEvent(new Event(LIBRARY_EVENT)); }

/** Read a PDF or text file on the device and add it to the library. */
export async function addDocument(file: File): Promise<LibraryDoc> {
  if (file.size > 25 * 1024 * 1024) throw new Error('Please add files under 25 MB.');
  let text: string;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const { pdfToText } = await import('./documentScan');
    text = await pdfToText(file);
  } else if (/\.(txt|md|csv)$/i.test(file.name) || file.type.startsWith('text/')) {
    text = await file.text();
  } else throw new Error('Add a PDF or a text file.');
  const chunks = chunkText(text);
  if (!chunks.length) throw new Error('No readable text found. Scanned image-only PDFs need OCR first.');
  const doc: LibraryDoc = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, size: file.size, addedAt: new Date().toISOString(), chunks };
  await tx('readwrite', (s) => s.put(doc));
  window.dispatchEvent(new Event(LIBRARY_EVENT));
  return doc;
}

/** Search the formula book and the user's documents. */
export async function searchLibrary(query: string, k = 4): Promise<LibraryHit[]> {
  const docs = typeof indexedDB === 'undefined' ? [] : await listDocs();
  return rankPassages(query, docs, k);
}
