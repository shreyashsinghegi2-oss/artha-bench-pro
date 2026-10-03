import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileUp, Info, KeyRound, Landmark, Loader2, Plus, RefreshCw, Search, Sparkles, Trash2, Wallet } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { PageAssistant } from '../ai/PageAssistant';
import { assetClassFor } from '../../data/fundClass';
import { casToHoldings, parseCas, type CasResult } from '../../services/casParser';
import { CLASS_COLOR, KIND_CLASS, KIND_LABEL, loadPortfolio, newId, PORTFOLIO_EVENT, portfolioSnapshot, savePortfolio, summarise, type AssetClass, type Holding, type HoldingKind, type PortfolioData } from '../../services/portfolio';
import { parseMoney } from './MoneyReport';
import { loadMoneyProfile } from '../../services/moneyProfile';
import './portfolio.css';

const inr = (v: number) => `${v < 0 ? '−' : ''}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`;
const pct = (v: number) => `${v >= 0 ? '' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
const today = () => new Date().toISOString().slice(0, 10);

interface FundHit { code: string; name: string; category: string; house: string }
type Tab = 'cas' | 'mf' | 'stock' | 'other' | 'loan';

function readProfileAge(): number | undefined {
  const a = loadMoneyProfile()?.age;
  return a && a > 15 && a < 100 ? a : undefined;
}

async function latestFund(code: string) {
  const res = await fetch(`/api/mf/scheme/${code}`);
  if (!res.ok) throw new Error('Could not load this fund right now.');
  const d = await res.json() as { scheme: { name: string; category: string; house: string; assetClass: string } | null; history: Array<{ date: string; nav: number }> };
  const last = d.history[d.history.length - 1];
  if (!last) throw new Error('No NAV available for this fund yet.');
  return { nav: last.nav, date: last.date, scheme: d.scheme };
}
async function stockPrice(symbol: string) {
  const res = await fetch(`/api/markets/quote?symbol=${encodeURIComponent(symbol)}&assetType=equity`);
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.quote?.price) throw new Error(d.error ? 'Price unavailable for this symbol right now.' : 'Price unavailable.');
  return { price: Number(d.quote.price), name: String(d.quote.name || symbol), date: String(d.quote.providerTimestamp || '').slice(0, 10) || today() };
}

const SAMPLE: PortfolioData = {
  holdings: [
    { id: 's1', kind: 'mf', name: 'Sample Flexi Cap Fund - Direct Plan - Growth', assetClass: 'Equity', category: 'Equity Scheme - Flexi Cap Fund', invested: 240000, value: 312000, source: 'manual', updatedAt: '', txns: [{ date: '2023-04-10', amount: 120000, kind: 'buy' }, { date: '2024-04-10', amount: 120000, kind: 'buy' }] },
    { id: 's2', kind: 'mf', name: 'Sample Large Cap Fund - Regular Plan - Growth', assetClass: 'Equity', category: 'Equity Scheme - Large Cap Fund', invested: 150000, value: 181000, source: 'manual', updatedAt: '', txns: [{ date: '2023-10-01', amount: 150000, kind: 'buy' }] },
    { id: 's3', kind: 'ppf', name: 'PPF account', assetClass: 'Debt', invested: 300000, value: 352000, source: 'manual', updatedAt: '' },
    { id: 's4', kind: 'cash', name: 'Savings and FD', assetClass: 'Cash', invested: 0, value: 180000, source: 'manual', updatedAt: '' },
    { id: 's5', kind: 'gold', name: 'Gold (sovereign gold bonds)', assetClass: 'Gold & commodities', invested: 60000, value: 84000, source: 'manual', updatedAt: '' },
  ],
  liabilities: [{ id: 'sl', name: 'Car loan', outstanding: 220000, ratePct: 9.5 }],
  importedFrom: 'Sample portfolio (not your data)',
};

export const PortfolioView: React.FC<{ onNavigate?: (d: AppNavigationDestination) => void }> = () => {
  const [data, setData] = useState<PortfolioData>(() => loadPortfolio());
  const [tab, setTab] = useState<Tab>('cas');
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState('');
  const age = useMemo(() => readProfileAge(), []);
  const summary = useMemo(() => summarise(data, age), [data, age]);
  const isSample = data.importedFrom?.startsWith('Sample');

  useEffect(() => { const sync = () => setData(loadPortfolio()); window.addEventListener(PORTFOLIO_EVENT, sync); return () => window.removeEventListener(PORTFOLIO_EVENT, sync); }, []);
  const update = useCallback((next: PortfolioData) => { setData(next); savePortfolio(next); }, []);

  const refresh = useCallback(async (base: PortfolioData) => {
    setRefreshing(true); setNote('');
    let holdings = [...base.holdings];
    let updated = 0, failed = 0;
    // Match imported funds (ISIN only) to scheme codes first, a few at a time on the server.
    const unmatched = holdings.filter((h) => h.kind === 'mf' && h.isin && !h.schemeCode);
    if (unmatched.length) {
      try {
        const res = await fetch('/api/mf/isin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: unmatched.map((h) => ({ isin: h.isin, name: h.name })) }) });
        const d = await res.json() as { funds?: Record<string, { code: string; category: string; house: string; assetClass: string } | null> };
        holdings = holdings.map((h) => {
          const m = h.isin ? d.funds?.[h.isin.toUpperCase()] : null;
          return m ? { ...h, schemeCode: m.code, category: m.category || h.category, house: m.house || h.house, assetClass: assetClassFor(m.category || '', h.name) as AssetClass } : h;
        });
      } catch { /* keep statement values */ }
    }
    holdings = await Promise.all(holdings.map(async (h) => {
      try {
        if (h.kind === 'mf' && h.schemeCode && h.units) {
          const f = await latestFund(h.schemeCode); updated++;
          return { ...h, price: f.nav, priceDate: f.date, value: h.units * f.nav, category: h.category || f.scheme?.category, updatedAt: new Date().toISOString() };
        }
        if (h.kind === 'stock' && h.symbol && h.units) {
          const q = await stockPrice(h.symbol); updated++;
          return { ...h, price: q.price, priceDate: q.date, value: h.units * q.price, updatedAt: new Date().toISOString() };
        }
      } catch { failed++; }
      return h;
    }));
    const next = { ...base, holdings };
    update(next);
    setRefreshing(false);
    setNote(updated ? `Updated ${updated} price${updated > 1 ? 's' : ''} from AMFI NAVs and exchange quotes.${failed ? ` ${failed} could not be updated right now.` : ''}` : failed ? 'Prices could not be updated right now. Values are from your statement or last update.' : 'Nothing to refresh: prices update for mutual funds and stocks with units.');
  }, [update]);

  const remove = (id: string) => update({ ...data, holdings: data.holdings.filter((h) => h.id !== id) });
  const removeLoan = (id: string) => update({ ...data, liabilities: data.liabilities.filter((l) => l.id !== id) });
  const add = (h: Holding) => update({ ...data, importedFrom: isSample ? undefined : data.importedFrom, holdings: [...(isSample ? [] : data.holdings), h], liabilities: isSample ? [] : data.liabilities });

  const snapshot = useCallback(() => (data.holdings.length ? portfolioSnapshot(data, summary) : 'The user has not added any holdings yet. Help them understand how to build a portfolio and what to add first.'), [data, summary]);
  const empty = !data.holdings.length && !data.liabilities.length;

  return <div className="pf">
    <header className="pf-hero">
      <div>
        <small>Portfolio & net worth</small>
        <h1>{empty ? 'See all your money in one place' : inr(summary.netWorth)}</h1>
        <p>{empty ? 'Import your mutual fund statement in a minute, or add stocks, deposits, gold, PPF, EPF and loans. Everything stays on this device.' : `Net worth · ${data.holdings.length} holding${data.holdings.length === 1 ? '' : 's'}${data.liabilities.length ? ` · ${data.liabilities.length} loan${data.liabilities.length === 1 ? '' : 's'}` : ''}${isSample ? ' · sample data' : ''}`}</p>
      </div>
      {!empty && <div className="pf-hero-actions">
        <button type="button" className="pf-btn" onClick={() => void refresh(data)} disabled={refreshing}>{refreshing ? <Loader2 size={15} className="pf-spin"/> : <RefreshCw size={15}/>} Refresh prices</button>
        {isSample && <button type="button" className="pf-btn ghost" onClick={() => update({ holdings: [], liabilities: [] })}>Clear sample</button>}
      </div>}
    </header>
    {isSample && <p className="pf-banner"><Info size={15}/> This is a sample portfolio so you can explore. Add or import your own to replace it.</p>}
    {note && <p className="pf-note" role="status">{note}</p>}

    {!empty && <>
      <section className="pf-tiles">
        <div><span>Assets</span><b>{inr(summary.assets)}</b></div>
        <div><span>Loans</span><b>{inr(summary.liabilities)}</b></div>
        <div><span>Invested → now</span><b>{summary.invested ? `${inr(summary.invested)} → ${inr(summary.investedValue)}` : '—'}</b>{summary.gainPct !== null && <em className={summary.gain >= 0 ? 'up' : 'down'}>{summary.gain >= 0 ? '+' : ''}{inr(summary.gain)} ({pct(summary.gainPct)})</em>}</div>
        <div><span>XIRR (yearly return)</span><b>{summary.xirr !== null ? pct(summary.xirr) : '—'}</b><em>{summary.xirr !== null ? `on ${Math.round(summary.xirrCoverage * 100)}% of assets with dated transactions` : 'Needs dated transactions (import a detailed statement)'}</em></div>
      </section>

      <section className="pf-card">
        <h2>Where your money is</h2>
        <div className="pf-bar" role="img" aria-label={summary.byClass.map((c) => `${c.cls} ${Math.round(c.share * 100)}%`).join(', ')}>
          {summary.byClass.map((c) => <span key={c.cls} style={{ width: `${Math.max(1, c.share * 100)}%`, background: CLASS_COLOR[c.cls] }}/>)}
        </div>
        <ul className="pf-legend">{summary.byClass.map((c) => <li key={c.cls}><i style={{ background: CLASS_COLOR[c.cls] }}/>{c.cls}<b>{Math.round(c.share * 100)}%</b><span>{inr(c.value)}</span></li>)}</ul>
      </section>

      <section className="pf-card">
        <h2>Checks</h2>
        <ul className="pf-insights">{summary.insights.map((i) => <li key={i.title} className={i.tone}>
          {i.tone === 'warn' ? <AlertTriangle size={16}/> : i.tone === 'good' ? <CheckCircle2 size={16}/> : <Info size={16}/>}
          <div><b>{i.title}</b><p>{i.detail}</p></div>
        </li>)}</ul>
      </section>

      <section className="pf-card">
        <h2>Holdings</h2>
        <div className="pf-table" role="table">
          <div className="pf-row head" role="row"><span>Name</span><span>Type</span><span>Value</span><span>Gain</span><span/></div>
          {[...data.holdings].sort((a, b) => b.value - a.value).map((h) => {
            const g = h.invested ? h.value - h.invested : null;
            return <div key={h.id} className="pf-row" role="row">
              <span className="pf-name"><b>{h.name}</b><small>{[h.category, h.folio ? `Folio ${h.folio}` : '', h.units ? `${h.units.toLocaleString('en-IN', { maximumFractionDigits: 3 })} units` : '', h.price ? `@ ₹${h.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}${h.priceDate ? ` on ${h.priceDate}` : ''}` : ''].filter(Boolean).join(' · ')}</small></span>
              <span><i className="pf-dot" style={{ background: CLASS_COLOR[h.assetClass] }}/>{KIND_LABEL[h.kind]}</span>
              <span className="pf-num">{inr(h.value)}</span>
              <span className={`pf-num ${g === null ? '' : g >= 0 ? 'up' : 'down'}`}>{g === null ? '—' : `${g >= 0 ? '+' : ''}${inr(g)}`}</span>
              <span><button type="button" className="pf-x" aria-label={`Remove ${h.name}`} onClick={() => remove(h.id)}><Trash2 size={14}/></button></span>
            </div>;
          })}
          {data.liabilities.map((l) => <div key={l.id} className="pf-row loan" role="row">
            <span className="pf-name"><b>{l.name}</b><small>{l.ratePct ? `${l.ratePct}% interest` : 'Loan'}</small></span>
            <span><Landmark size={13}/> Loan</span>
            <span className="pf-num down">−{inr(l.outstanding).replace('−', '')}</span><span/>
            <span><button type="button" className="pf-x" aria-label={`Remove ${l.name}`} onClick={() => removeLoan(l.id)}><Trash2 size={14}/></button></span>
          </div>)}
        </div>
      </section>
    </>}

    <section className="pf-card">
      <h2>{empty ? 'Add your investments' : 'Add more'}</h2>
      <nav className="pf-tabs" role="tablist">
        {([['cas', 'Import statement'], ['mf', 'Mutual fund'], ['stock', 'Stock'], ['other', 'FD, PPF, gold & more'], ['loan', 'Loan']] as const).map(([id, label]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      {tab === 'cas' && <CasImport onImport={(hs, from) => { const next = { holdings: [...(isSample ? [] : data.holdings.filter((h) => h.source !== 'cas')), ...hs], liabilities: isSample ? [] : data.liabilities, importedFrom: from, importedAt: new Date().toISOString() }; update(next); void refresh(next); }}/>}
      {tab === 'mf' && <AddFund onAdd={add}/>}
      {tab === 'stock' && <AddStock onAdd={add}/>}
      {tab === 'other' && <AddOther onAdd={add}/>}
      {tab === 'loan' && <AddLoan onAdd={(l) => update({ ...data, holdings: isSample ? [] : data.holdings, importedFrom: isSample ? undefined : data.importedFrom, liabilities: [...(isSample ? [] : data.liabilities), l] })}/>}
      {empty && <button type="button" className="pf-sample" onClick={() => update(SAMPLE)}><Sparkles size={14}/> Explore with a sample portfolio</button>}
    </section>

    <PageAssistant destination="portfolio" title="Portfolio & net worth" snapshot={snapshot}/>
    <p className="pf-fine">Stored only in this browser. Prices: official AMFI NAVs (via mfapi.in) and delayed exchange quotes. XIRR uses the dated transactions in your statement. Education only, not investment advice.</p>
  </div>;
};

// ---------------- Import a CAS ----------------

const CasImport: React.FC<{ onImport: (hs: Holding[], from: string) => void }> = ({ onImport }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CasResult | null>(null);

  const read = async (f: File, pw?: string) => {
    setBusy(true); setError(''); setResult(null);
    try {
      const { pdfToText, PdfPasswordError } = await import('../../services/documentScan');
      try {
        const text = await pdfToText(f, { password: pw, maxPages: 80 });
        const cas = parseCas(text);
        if (!cas.schemes.length) setError('No mutual fund holdings were found. Please use a Consolidated Account Statement (CAS) from CAMS, KFintech or MF Central.');
        else { setResult(cas); setNeedPassword(false); }
      } catch (e) {
        if (e instanceof PdfPasswordError) { setNeedPassword(true); if (e.wrong) setError('That password did not open the file. Check the email that came with the statement.'); }
        else throw e;
      }
    } catch { setError('This file could not be read. Please choose the PDF statement again.'); }
    finally { setBusy(false); }
  };

  const total = result?.schemes.reduce((s, x) => s + (x.value ?? 0), 0) ?? 0;
  return <div className="pf-cas">
    <button type="button" className="pf-drop" onClick={() => fileRef.current?.click()} disabled={busy} onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFile(f); void read(f); } }}>
      {busy ? <Loader2 size={22} className="pf-spin"/> : <FileUp size={22}/>}
      <b>{file ? file.name : 'Choose your CAS statement (PDF)'}</b>
      <span>Read on this device only. Nothing is uploaded.</span>
    </button>
    <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPassword(''); void read(f); } e.target.value = ''; }}/>
    {needPassword && file && <form className="pf-pw" onSubmit={(e) => { e.preventDefault(); void read(file, password); }}>
      <label><KeyRound size={15}/> This statement is password-protected. Enter the password from the email that came with it.</label>
      <div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Statement password" autoComplete="off" aria-label="Statement password"/><button type="submit" disabled={!password || busy}>Open</button></div>
    </form>}
    {error && <p className="pf-err" role="alert">{error}</p>}
    {result && <div className="pf-preview">
      <p><b>{result.schemes.length} fund{result.schemes.length > 1 ? 's' : ''} found</b> · {inr(total)}{result.statementPeriod ? ` · statement ${result.statementPeriod}` : ''}{result.kind === 'summary' ? ' · summary statement (no transactions, so no XIRR)' : ''}</p>
      <ul>{result.schemes.slice(0, 8).map((s, i) => <li key={i}><span>{s.name}</span><b>{inr(s.value ?? 0)}</b></li>)}{result.schemes.length > 8 && <li><span>and {result.schemes.length - 8} more</span></li>}</ul>
      <button type="button" className="pf-btn primary" onClick={() => { onImport(casToHoldings(result), `CAS ${result.statementPeriod ?? ''}`.trim()); setResult(null); setFile(null); }}><CheckCircle2 size={15}/> Add to my portfolio</button>
      <small>Replaces funds from an earlier statement import; your manual entries stay.</small>
    </div>}
    <details className="pf-help">
      <summary>How do I get my CAS?</summary>
      <p>A Consolidated Account Statement lists all your mutual funds across fund houses. Request a <b>detailed</b> statement (it includes transactions, so we can calculate your true yearly return) for the period since you started investing. It arrives by email as a password-protected PDF.</p>
      <ul>
        <li><a href="https://www.mfcentral.com" target="_blank" rel="noopener noreferrer">MF Central <ExternalLink size={11}/></a> (run by CAMS and KFintech)</li>
        <li><a href="https://www.camsonline.com" target="_blank" rel="noopener noreferrer">CAMS <ExternalLink size={11}/></a></li>
        <li><a href="https://mfs.kfintech.com" target="_blank" rel="noopener noreferrer">KFintech <ExternalLink size={11}/></a></li>
      </ul>
    </details>
  </div>;
};

// ---------------- Manual entry ----------------

const AddFund: React.FC<{ onAdd: (h: Holding) => void }> = ({ onAdd }) => {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<FundHit[]>([]);
  const [pick, setPick] = useState<FundHit | null>(null);
  const [units, setUnits] = useState('');
  const [invested, setInvested] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (pick || q.trim().length < 3) { setHits([]); return; }
    const t = window.setTimeout(async () => {
      try { const r = await fetch(`/api/mf/search?q=${encodeURIComponent(q.trim())}&limit=8`); const d = await r.json(); setHits(r.ok ? d.results ?? [] : []); if (!r.ok) setError('Fund search is unavailable right now.'); else setError(''); }
      catch { setError('Fund search is unavailable right now.'); }
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, pick]);

  const save = async () => {
    if (!pick) return;
    const u = Number(units.replace(/,/g, '')), inv = invested ? parseMoney(invested) : 0;
    if (!(u > 0)) { setError('Enter the number of units (it is on your statement or app).'); return; }
    if (!Number.isFinite(inv) || inv < 0) { setError('Check the amount invested, e.g. 1,20,000.'); return; }
    setBusy(true); setError('');
    try {
      const f = await latestFund(pick.code);
      const category = f.scheme?.category || pick.category;
      onAdd({ id: newId(), kind: 'mf', name: pick.name, schemeCode: pick.code, category, house: f.scheme?.house || pick.house, assetClass: assetClassFor(category, pick.name) as AssetClass, units: u, price: f.nav, priceDate: f.date, invested: inv, value: u * f.nav, source: 'search', updatedAt: new Date().toISOString() });
      setQ(''); setPick(null); setUnits(''); setInvested('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add this fund.'); }
    finally { setBusy(false); }
  };

  return <div className="pf-form">
    {!pick ? <label className="pf-search"><Search size={15}/><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a fund, e.g. Parag Parikh Flexi Cap" aria-label="Search mutual funds"/></label>
      : <p className="pf-picked"><b>{pick.name}</b><button type="button" onClick={() => setPick(null)}>Change</button></p>}
    {!pick && hits.length > 0 && <ul className="pf-hits">{hits.map((h) => <li key={h.code}><button type="button" onClick={() => { setPick(h); setHits([]); }}>{h.name}{h.category && <small>{h.category}</small>}</button></li>)}</ul>}
    {pick && <div className="pf-fields">
      <label>Units held<input inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="e.g. 1,234.567"/></label>
      <label>Amount invested (optional)<input inputMode="decimal" value={invested} onChange={(e) => setInvested(e.target.value)} placeholder="e.g. 1,20,000"/></label>
      <button type="button" className="pf-btn primary" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 size={15} className="pf-spin"/> : <Plus size={15}/>} Add fund</button>
    </div>}
    {error && <p className="pf-err" role="alert">{error}</p>}
    <small className="pf-hint">Value = units × the latest official NAV.</small>
  </div>;
};

const AddStock: React.FC<{ onAdd: (h: Holding) => void }> = ({ onAdd }) => {
  const [sym, setSym] = useState('');
  const [qty, setQty] = useState('');
  const [avg, setAvg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const s = sym.trim().toUpperCase().replace(/\s+/g, '');
    const q = Number(qty.replace(/,/g, '')), a = avg ? parseMoney(avg) : 0;
    if (!/^[A-Z0-9&^.-]{1,20}$/.test(s)) { setError('Enter the NSE symbol, e.g. RELIANCE or TCS.'); return; }
    if (!(q > 0)) { setError('Enter how many shares you hold.'); return; }
    setBusy(true); setError('');
    const symbol = /\.(NS|BO)$/.test(s) || !/^[A-Z0-9&-]+$/.test(s) ? s : `${s}.NS`;
    try {
      const p = await stockPrice(symbol);
      onAdd({ id: newId(), kind: 'stock', name: p.name, symbol, assetClass: 'Equity', units: q, price: p.price, priceDate: p.date, invested: a > 0 ? a * q : 0, value: q * p.price, source: 'manual', updatedAt: new Date().toISOString() });
      setSym(''); setQty(''); setAvg('');
    } catch (e) { setError(`${e instanceof Error ? e.message : 'Price unavailable.'} Check the symbol (NSE), e.g. HDFCBANK.`); }
    finally { setBusy(false); }
  };
  return <div className="pf-form"><div className="pf-fields">
    <label>NSE symbol<input value={sym} onChange={(e) => setSym(e.target.value)} placeholder="e.g. RELIANCE"/></label>
    <label>Shares<input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="e.g. 25"/></label>
    <label>Average buy price (optional)<input inputMode="decimal" value={avg} onChange={(e) => setAvg(e.target.value)} placeholder="e.g. 2,450"/></label>
    <button type="button" className="pf-btn primary" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 size={15} className="pf-spin"/> : <Plus size={15}/>} Add stock</button>
  </div>{error && <p className="pf-err" role="alert">{error}</p>}<small className="pf-hint">Value uses the latest (delayed) exchange price.</small></div>;
};

const OTHER_KINDS: HoldingKind[] = ['fd', 'ppf', 'epf', 'nps', 'gold', 'cash', 'property', 'crypto', 'other'];
const AddOther: React.FC<{ onAdd: (h: Holding) => void }> = ({ onAdd }) => {
  const [kind, setKind] = useState<HoldingKind>('fd');
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [invested, setInvested] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    const v = parseMoney(value), inv = invested ? parseMoney(invested) : 0;
    if (!(v > 0)) { setError('Enter the current value, e.g. 2,50,000.'); return; }
    if (!Number.isFinite(inv) || inv < 0) { setError('Check the amount invested.'); return; }
    onAdd({ id: newId(), kind, name: name.trim() || KIND_LABEL[kind], assetClass: KIND_CLASS[kind], invested: inv, value: v, source: 'manual', updatedAt: new Date().toISOString() });
    setName(''); setValue(''); setInvested(''); setError('');
  };
  return <div className="pf-form"><div className="pf-fields">
    <label>Type<select value={kind} onChange={(e) => setKind(e.target.value as HoldingKind)}>{OTHER_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
    <label>Name (optional)<input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${kind === 'fd' ? 'SBI FD' : KIND_LABEL[kind]}`}/></label>
    <label>Current value<input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. 2,50,000"/></label>
    <label>Amount put in (optional)<input inputMode="decimal" value={invested} onChange={(e) => setInvested(e.target.value)} placeholder="e.g. 2,00,000"/></label>
    <button type="button" className="pf-btn primary" onClick={save}><Plus size={15}/> Add</button>
  </div>{error && <p className="pf-err" role="alert">{error}</p>}</div>;
};

const AddLoan: React.FC<{ onAdd: (l: { id: string; name: string; outstanding: number; ratePct?: number }) => void }> = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [out, setOut] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    const o = parseMoney(out), r = rate ? Number(rate) : undefined;
    if (!(o > 0)) { setError('Enter the amount still to repay, e.g. 12,00,000.'); return; }
    if (r !== undefined && !(r >= 0 && r < 60)) { setError('Enter the interest rate as a percentage, e.g. 9.5.'); return; }
    onAdd({ id: newId(), name: name.trim() || 'Loan', outstanding: o, ratePct: r }); setName(''); setOut(''); setRate(''); setError('');
  };
  return <div className="pf-form"><div className="pf-fields">
    <label>Loan<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Home loan"/></label>
    <label>Still to repay<input inputMode="decimal" value={out} onChange={(e) => setOut(e.target.value)} placeholder="e.g. 12,00,000"/></label>
    <label>Interest rate % (optional)<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 8.75"/></label>
    <button type="button" className="pf-btn primary" onClick={save}><Wallet size={15}/> Add loan</button>
  </div>{error && <p className="pf-err" role="alert">{error}</p>}</div>;
};
