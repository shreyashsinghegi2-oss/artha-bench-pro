import React, { useCallback, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpenCheck, Building2, CircleDot, Eye, Landmark, LineChart, ShieldCheck, Sparkles } from 'lucide-react';
import { buildRuleBasedNewsBrief, type BriefDirection, type NewsBriefInput, type NewsResearchBrief } from '../../services/newsBrief';
import { CompanyLogo, companyLogoSrc } from '../market/CompanyLogo';
import './researchBrief.css';

/** Fetch the server brief (AI-enriched when available); fall back to the local rule-based brief. */
export function useNewsBrief(input: NewsBriefInput) {
  const [brief, setBrief] = useState<NewsResearchBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (brief || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/news/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const json = res.ok ? await res.json() : null;
      setBrief(json?.brief?.headline ? json.brief as NewsResearchBrief : buildRuleBasedNewsBrief(input));
    } catch {
      setBrief(buildRuleBasedNewsBrief(input));
    } finally {
      setLoading(false);
    }
  }, [brief, loading, input]);
  return { brief, loading, load };
}

const DIR: Record<BriefDirection, { label: string; icon: React.ReactNode }> = {
  positive: { label: 'Positive', icon: <ArrowUpRight size={14}/> },
  negative: { label: 'Negative', icon: <ArrowDownRight size={14}/> },
  mixed: { label: 'Mixed', icon: <CircleDot size={13}/> },
  unclear: { label: 'Unclear', icon: <CircleDot size={13}/> },
};
const CONF = { low: 1, medium: 2, high: 3 } as const;

const fmtWhen = (v?: string | null) => {
  if (!v) return 'Time not given';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST';
};

const EntityChip: React.FC<{ e: NewsResearchBrief['entities'][number] }> = ({ e }) => {
  const logo = e.symbol && companyLogoSrc(e.symbol);
  const Icon = e.type === 'regulator' ? Landmark : e.type === 'index' ? LineChart : Building2;
  return <span className="rb-entity">{logo ? <CompanyLogo symbol={e.symbol!} size={20} className="rb-entity-logo"/> : <i><Icon size={12}/></i>}{e.name}<small>{e.type}</small></span>;
};

export const ResearchBriefPanel: React.FC<{ brief: NewsResearchBrief; onClose?: () => void; id?: string }> = ({ brief, onClose, id }) => {
  const dir = DIR[brief.sentiment];
  return <article id={id} className="rb" aria-label={`Research brief: ${brief.headline}`}>
    <header className="rb-head">
      <div className="rb-head-main">
        <span className="rb-eyebrow"><Sparkles size={12}/> ArthaMind research brief</span>
        <h3>{brief.headline}</h3>
        <p className="rb-meta">
          <span>{brief.source.name}</span><span>·</span><span>{fmtWhen(brief.source.publishedAt)}</span><span>·</span><span>{brief.coverage}</span>
          {brief.source.url && brief.source.url !== '#' && <><span>·</span><a href={brief.source.url} target="_blank" rel="noopener noreferrer">Open source ↗</a></>}
        </p>
      </div>
      <div className="rb-head-side">
        <span className={`rb-sentiment ${brief.sentiment}`}>{dir.icon}{dir.label} read</span>
        <span className="rb-conf" title="How much the supplied text supports this read">
          <small>Confidence</small>
          <span className="rb-conf-bars" aria-label={`Confidence ${brief.confidence}`}>{[1, 2, 3].map((n) => <i key={n} className={n <= CONF[brief.confidence] ? 'on' : ''}/>)}</span>
          <b>{brief.confidence}</b>
        </span>
        {onClose && <button type="button" className="rb-close" onClick={onClose}>Close</button>}
      </div>
    </header>

    {(brief.entities.length > 0 || brief.topics.length > 0) && <div className="rb-tags">
      {brief.entities.map((e) => <EntityChip key={e.name} e={e}/>)}
      {brief.topics.map((t) => <span key={t} className="rb-topic">{t}</span>)}
    </div>}

    <div className="rb-grid">
      <section className="rb-card rb-what">
        <h4>What happened</h4>
        <p className="rb-summary">{brief.summary}</p>
        <h4>Key points</h4>
        <ol className="rb-points">{brief.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ol>
      </section>

      <section className="rb-card rb-impact">
        <h4>Market impact</h4>
        <ul>{brief.impact.map((row, i) => <li key={i} className={row.direction}>
          <span className="rb-impact-dir">{DIR[row.direction].icon}</span>
          <div><b>{row.area}</b><p>{row.note}</p></div>
        </li>)}</ul>
        {brief.figures.length > 0 && <>
          <h4>Figures in the report</h4>
          <dl className="rb-figures">{brief.figures.map((f) => <div key={f.value}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
        </>}
      </section>
    </div>

    <section className="rb-why"><BookOpenCheck size={18}/><div><h4>Why it matters</h4><p>{brief.whyItMatters}</p></div></section>

    <div className="rb-grid rb-grid-even">
      <section className="rb-card"><h4><Eye size={14}/> What to watch next</h4><ul className="rb-list">{brief.whatToWatch.map((w, i) => <li key={i}>{w}</li>)}</ul></section>
      <section className="rb-card rb-verify"><h4><ShieldCheck size={14}/> Verify before acting</h4><ul className="rb-list">{brief.verify.map((w, i) => <li key={i}>{w}</li>)}</ul></section>
    </div>

    <footer className="rb-foot">
      <span>{brief.generatedBy === 'ai' ? 'AI analysis, limited to facts in the source text' : 'Rule-based analysis of the headline and summary'}</span>
      <span>Prepared {fmtWhen(brief.asOf)}</span>
      <span><AlertTriangle size={12}/> Educational research, not investment advice</span>
    </footer>
  </article>;
};

export const ResearchBriefLoading: React.FC = () => <div className="rb rb-loading" role="status" aria-label="Preparing research brief">
  <span className="rb-eyebrow"><Sparkles size={12}/> Reading the article…</span>
  <i/><i/><i/><div className="rb-grid"><i className="tall"/><i className="tall"/></div>
</div>;
