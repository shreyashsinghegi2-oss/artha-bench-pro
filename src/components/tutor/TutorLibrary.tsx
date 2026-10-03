import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, BookOpen, ExternalLink, FileText, FileUp, Search, Sigma, Trash2 } from 'lucide-react';
import { KNOWLEDGE, READING_LIST, type KnowledgeEntry } from '../../data/financeKnowledge';
import { addDocument, deleteDoc, LIBRARY_EVENT, listDocs, rankPassages, type LibraryDoc } from '../../services/knowledgeLibrary';
import './tutorLibrary.css';

export const FormulaCard: React.FC<{ entry: KnowledgeEntry; compact?: boolean }> = ({ entry, compact }) => <article className={`tl-card ${compact ? 'compact' : ''}`}>
  <header><small>{entry.chapter}</small><b>{entry.title}</b></header>
  <p>{entry.summary}</p>
  {entry.formula && <code className="tl-formula">{entry.formula}</code>}
  {entry.variables && !compact && <dl className="tl-vars">{entry.variables.map(([s, m]) => <div key={s}><dt>{s}</dt><dd>{m}</dd></div>)}</dl>}
  {entry.example && <div className="tl-example"><small>Worked example</small><span>{entry.example.inputs}</span>{entry.example.working && <span className="tl-working">{entry.example.working}</span>}<b>= {entry.example.result}</b></div>}
  {entry.notes && !compact && <ul className="tl-notes">{entry.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
  <footer>Source: {entry.reference}</footer>
</article>;

type Tab = 'formulas' | 'docs' | 'books';
const CHAPTERS = Array.from(new Set(KNOWLEDGE.map((k) => k.chapter)));

export const TutorLibrary: React.FC = () => {
  const [tab, setTab] = useState<Tab>('formulas');
  const [query, setQuery] = useState('');
  const [chapter, setChapter] = useState<string>('All');
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const load = () => void listDocs().then(setDocs); load(); window.addEventListener(LIBRARY_EVENT, load); return () => window.removeEventListener(LIBRARY_EVENT, load); }, []);

  const entries = useMemo(() => {
    if (query.trim()) return rankPassages(query, [], 12).flatMap((h) => (h.kind === 'formula' ? [h.entry] : []));
    return KNOWLEDGE.filter((k) => chapter === 'All' || k.chapter === chapter);
  }, [query, chapter]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg('');
    const done: string[] = [];
    for (const f of Array.from(files)) {
      try { const d = await addDocument(f); done.push(`${d.name} (${d.chunks.length} passages)`); }
      catch (e) { setMsg(`${f.name}: ${e instanceof Error ? e.message : 'could not be read'}`); }
    }
    if (done.length) setMsg(`Added ${done.join(', ')}. The tutor will now use them when relevant.`);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return <section className="tl" aria-labelledby="tl-title">
    <header className="tl-head">
      <div><small>Knowledge library</small><h2 id="tl-title">Formula book, your documents and reading list</h2>
        <p>The tutor searches this library before every answer and cites what it used. Formulas and worked examples are checked by automated tests.</p></div>
      <nav className="tl-tabs" role="tablist">
        {([['formulas', 'Formula book', Sigma], ['docs', 'My documents', FileText], ['books', 'Reading list', BookMarked]] as const).map(([id, label, Icon]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={14}/>{label}{id === 'docs' && docs.length ? ` (${docs.length})` : ''}</button>)}
      </nav>
    </header>

    {tab === 'formulas' && <>
      <div className="tl-tools">
        <label className="tl-search"><Search size={14}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search formulas: EMI, CAGR, HRA, bond price, repo rate…" aria-label="Search the formula book"/></label>
        {!query && <div className="tl-chips">{['All', ...CHAPTERS].map((c) => <button key={c} type="button" className={chapter === c ? 'on' : ''} onClick={() => setChapter(c)}>{c}</button>)}</div>}
      </div>
      <div className="tl-grid">{(showAll || query || chapter !== 'All' ? entries : entries.slice(0, 6)).map((e) => <FormulaCard key={e.id} entry={e}/>)}</div>
      {!showAll && !query && chapter === 'All' && entries.length > 6 && <button type="button" className="tl-more" onClick={() => setShowAll(true)}>Show all {entries.length} formulas</button>}
      {!entries.length && <p className="tl-empty">No formula matches “{query}”. Try a simpler word, or ask the tutor directly.</p>}
    </>}

    {tab === 'docs' && <div className="tl-docs">
      <button type="button" className="tl-drop" onClick={() => fileRef.current?.click()} disabled={busy}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files); }}>
        <FileUp size={22}/><b>{busy ? 'Reading…' : 'Add PDFs or notes'}</b><span>Textbooks, class notes, annual reports, RBI or SEBI circulars. Read on this device and stored only in this browser.</span>
      </button>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain" multiple hidden onChange={(e) => void onFiles(e.target.files)}/>
      {msg && <p className="tl-msg" role="status">{msg}</p>}
      <ul className="tl-doclist">{docs.map((d) => <li key={d.id}><FileText size={16}/><span><b>{d.name}</b><small>{d.chunks.length} passages · {(d.size / 1024 / 1024).toFixed(1)} MB · added {new Date(d.addedAt).toLocaleDateString('en-IN')}</small></span>
        <button type="button" aria-label={`Remove ${d.name}`} onClick={() => void deleteDoc(d.id)}><Trash2 size={14}/></button></li>)}</ul>
      {!docs.length && <p className="tl-empty">No documents yet. Add a PDF and ask the tutor about it.</p>}
      <p className="tl-fine">Scanned image-only PDFs have no text to read; run OCR on them first. Only add material you have the right to use.</p>
    </div>}

    {tab === 'books' && <ul className="tl-books">{READING_LIST.map((b) => <li key={b.title}>
      <BookOpen size={16}/><div><b>{b.title}</b><small>{b.author}{b.free ? ' · free, official' : ''}</small><p>{b.why}</p></div>
      {b.url && <a href={b.url} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={12}/></a>}
    </li>)}</ul>}
  </section>;
};
