import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  ChevronDown,
  CircleSlash,
  History,
  Info,
  Link2,
  Loader2,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { askAdvisor, loadShared, shareAnswer, toAdvisorProfile, type AskResult, type SharedAdviceView } from '../../advisor/client';
import type { AdvisorAnswer, Layer, LayerEvent } from '../../advisor/pipeline';
import type { Calculation, Guardrail } from '../../advisor/math-engine';
import type { ProfileMatch } from '../../advisor/profile-matcher';
import type { PatternResult } from '../../advisor/pattern-matcher';
import { loadMoneyProfile } from '../../services/moneyProfile';
import { SimulationCard } from '../simulation/SimulationCard';

/* ---------- Formatting (Indian digit grouping) ---------- */

const inr = (v: number, d = 0) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const signed = (v: number) => `${v >= 0 ? '+' : ''}${pct(v)}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'time unknown';

const LAYER_LABEL: Record<Layer, string> = {
  parse: 'Understanding the question',
  data: 'Gathering live data',
  pattern: 'Checking past market patterns',
  math: 'Calculating',
  profile: 'Matching to your profile',
  explain: 'Explaining (numbers checked)',
};
const LAYER_ORDER: Layer[] = ['parse', 'data', 'pattern', 'math', 'profile', 'explain'];

const EXAMPLES = [
  'I want to start a SIP of ₹10,000 per month for 15 years',
  'EMI on a home loan of 50 lakh for 20 years?',
  'Should I invest ₹1 lakh in a NIFTY index fund now for 5 years?',
  'How much tax on a salary of 18 lakh?',
  'I need ₹50 lakh for my child’s education in 12 years',
];

/* ---------- Small pieces ---------- */

function LayerProgress({ events, running }: { events: LayerEvent[]; running: boolean }) {
  const done = new Map(events.map((e) => [e.layer, e]));
  const next = LAYER_ORDER.find((l) => !done.has(l));
  return (
    <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Answer progress">
      {LAYER_ORDER.map((l, i) => {
        const e = done.get(l);
        const active = running && l === next;
        return (
          <li key={l} className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-bold text-secondary" aria-hidden>
              {e?.status === 'done' ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : e?.status === 'failed' ? (
                <X className="h-3.5 w-3.5 text-danger" />
              ) : e?.status === 'skipped' ? (
                <CircleSlash className="h-3.5 w-3.5 text-secondary" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{LAYER_LABEL[l]}</span>
            {e && <span className="shrink-0 text-secondary">{e.status === 'skipped' ? 'skipped' : `${e.ms} ms`}</span>}
          </li>
        );
      })}
    </ol>
  );
}

const GUARD_STYLE: Record<Guardrail['level'], string> = {
  warning: 'border-danger/40 bg-danger-soft text-ink',
  caution: 'border-warning/40 bg-warning-soft text-ink',
  info: 'border-line bg-subtle text-secondary',
};

function Guardrails({ items }: { items: Guardrail[] }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-2">
      {items.map((g) => (
        <li key={g.id} className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${GUARD_STYLE[g.level]}`}>
          {g.level === 'info' ? (
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${g.level === 'warning' ? 'text-danger' : 'text-warning'}`} aria-hidden />
          )}
          <span>
            <span className="sr-only">{g.level}: </span>
            {g.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CalcCard({ c, showWork }: { c: Calculation; showWork: boolean }) {
  const fmt = (v: number, unit: '₹' | '%') => (unit === '₹' ? inr(v, c.id === 'emi' && v < 1e6 ? 2 : 0) : `${v}%`);
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">{c.title}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{fmt(c.result.value, c.result.unit)}</p>
      <p className="text-sm text-secondary">{c.result.label}</p>
      {c.extras.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          {c.extras.map((e) => (
            <React.Fragment key={e.label}>
              <dt className="text-secondary">{e.label}</dt>
              <dd className="text-right font-semibold text-ink">{fmt(e.value, e.unit)}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      {showWork && (
        <div className="mt-3 border-t border-line pt-3 text-sm">
          <p className="font-mono text-xs break-words text-secondary">{c.formula}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {c.inputs.map((i) => (
              <li
                key={i.name}
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.source === 'assumption' ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}
              >
                {i.name}: {i.unit === '₹' ? inr(i.value) : i.unit === '%' ? `${i.value}%` : `${i.value} ${i.unit}`} · {i.source}
              </li>
            ))}
          </ul>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink">
            {c.steps.map((s) => (
              <li key={s} className="break-words">
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function PatternCard({ p, showWork }: { p: PatternResult; showWork: boolean }) {
  const [s20, s60] = p.stats;
  const [b20, b60] = p.baseline;
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
        Past NIFTY setups like today ({p.matches.length} found, confidence {p.confidence})
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {[
          { s: s20, b: b20, label: 'Next 20 trading days' },
          { s: s60, b: b60, label: 'Next 60 trading days' },
        ].map(({ s, b, label }) =>
          s ? (
            <div key={label}>
              <p className="text-sm text-secondary">{label}</p>
              <p className={`text-xl font-bold ${s.median >= 0 ? 'text-success' : 'text-danger'}`}>{signed(s.median)} median</p>
              <p className="text-xs text-secondary">
                Middle range {signed(s.p25)} to {signed(s.p75)} · higher {pct(s.positive_share, 0)} of the time{b ? ` · any day: ${signed(b.median)}` : ''}
              </p>
            </div>
          ) : null,
        )}
      </div>
      <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-xs font-semibold text-warning">{p.disclaimer}</p>
      {showWork && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <caption className="sr-only">Most similar past days</caption>
            <thead className="text-secondary">
              <tr>
                <th className="py-1 font-semibold">Date</th>
                <th className="py-1 font-semibold">Similarity</th>
                <th className="py-1 text-right font-semibold">+20 days</th>
                <th className="py-1 text-right font-semibold">+60 days</th>
              </tr>
            </thead>
            <tbody>
              {p.matches.map((m) => (
                <tr key={m.date} className="border-t border-line text-ink">
                  <td className="py-1">{m.date}</td>
                  <td className="py-1">{(m.similarity * 100).toFixed(0)}%</td>
                  <td className="py-1 text-right">{signed(m.forward_20d)}</td>
                  <td className="py-1 text-right">{signed(m.forward_60d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-secondary">
            {p.confidence_reason}. History since {p.history_from} ({p.history_days} trading days).
          </p>
        </div>
      )}
    </article>
  );
}

const FIT_STYLE: Record<ProfileMatch['suitability'], string> = {
  fits: 'text-success',
  caution: 'text-warning',
  mismatch: 'text-danger',
  unknown: 'text-secondary',
};

function ProfileCard({ m }: { m: ProfileMatch }) {
  const checks = m.checks.filter((c) => c.relevant).slice(0, 4);
  return (
    <article className="min-w-0 rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-secondary">
        <UserRound className="h-3.5 w-3.5" aria-hidden /> Fit with your finances
      </p>
      <p className={`mt-1 font-semibold ${FIT_STYLE[m.suitability]}`}>{m.suitability_reason}</p>
      {checks.length > 0 && (
        <ul className="mt-2 grid gap-1.5 text-sm">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.status === 'good' ? 'bg-success-fill' : c.status === 'attention' ? 'bg-warning-fill' : 'bg-danger'}`}
                aria-hidden
              />
              <span>
                <span className="font-semibold text-ink">{c.title}: </span>
                <span className="text-ink">{c.detail}</span> <span className="text-secondary">{c.benchmark_note}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {m.missing.length > 0 && <p className="mt-2 text-xs text-secondary">More personal with: {m.missing.join(', ')}.</p>}
    </article>
  );
}

interface SimArgs {
  initial: number;
  monthly: number;
  years: number;
  expectedReturnPct: number;
}

/** Equity SIP or lump-sum projections also get a Monte Carlo range (Module 23). */
function simulationFor(answer: AdvisorAnswer): SimArgs | null {
  const c = answer.math.calculations.find((x) => (x.id === 'sip' || x.id === 'lump_sum') && x.inputs.some((i) => i.name.includes('scenarios')));
  if (!c) return null;
  const val = (name: string) => c.inputs.find((i) => i.name === name)?.value;
  const years = val('Time');
  const ret = c.inputs.find((i) => i.unit === '%')?.value;
  if (!years || !ret) return null;
  return c.id === 'sip'
    ? { initial: 0, monthly: val('Monthly SIP') ?? 0, years, expectedReturnPct: ret }
    : { initial: val('Amount invested') ?? 0, monthly: 0, years, expectedReturnPct: ret };
}

function AnswerView({ answer, showWork }: { answer: AdvisorAnswer; showWork: boolean }) {
  const sim = simulationFor(answer);
  const ex = answer.explanation;
  const sources = answer.sources ?? [];
  const stale = sources.length
    ? Object.values(answer.context ?? {}).filter(
        (v): v is { source: string; stale_warning: string } =>
          typeof v === 'object' && v !== null && 'stale_warning' in v && typeof v.stale_warning === 'string',
      )
    : [];
  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <p
          className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ex.mode === 'raw' ? 'bg-subtle text-secondary' : 'bg-success-soft text-success'}`}
        >
          {ex.mode === 'raw' ? <Calculator className="h-3.5 w-3.5" aria-hidden /> : <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
          {ex.mode === 'raw' ? 'Computed data (AI explanation unavailable)' : 'AI explanation · every number checked'}
        </p>
        <div className="whitespace-pre-line break-words text-[15px] leading-relaxed text-ink">{ex.text}</div>
      </div>
      <Guardrails items={answer.math.guardrails} />
      {answer.math.calculations.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {answer.math.calculations.map((c) => (
            <CalcCard key={c.id} c={c} showWork={showWork} />
          ))}
        </div>
      )}
      {sim && <SimulationCard {...sim} />}
      {answer.pattern && <PatternCard p={answer.pattern} showWork={showWork} />}
      {answer.profile && <ProfileCard m={answer.profile} />}
      {answer.math.assumptions.length > 0 && <p className="text-xs text-secondary">Assumptions: {answer.math.assumptions.join('; ')}.</p>}
      {stale.length > 0 && <p className="text-xs font-semibold text-warning">{stale.map((s) => `${s.source}: ${s.stale_warning}`).join(' · ')}</p>}
      {showWork && (
        <div className="grid gap-3 rounded-2xl border border-dashed border-line-strong p-4 text-sm">
          <div>
            <p className="font-semibold text-ink">How the question was read</p>
            <p className="text-secondary">
              Intent {answer.parsed.intent}; topics {answer.parsed.entities.join(', ') || 'none'}; amounts{' '}
              {answer.parsed.amounts.map((a) => `${a.raw} → ${inr(a.value)} (${a.type})`).join(', ') || 'none'}; time{' '}
              {answer.parsed.time_horizon ?? 'not stated'}.
            </p>
          </div>
          <div>
            <p className="font-semibold text-ink">Data sources</p>
            <ul className="mt-1 grid gap-1">
              {sources.map((s) => (
                <li key={s.key} className="flex flex-wrap gap-x-2 text-secondary">
                  <span className={s.status === 'ok' ? 'font-semibold text-success' : 'font-semibold text-secondary'}>{s.status === 'ok' ? '●' : '○'}</span>
                  <span className="text-ink">{s.source}</span>
                  <span>
                    {s.status !== 'ok'
                      ? (s.note ?? s.status)
                      : s.key === 'profile'
                        ? 'shared for this answer only'
                        : `as of ${when(s.as_of)} · reliability ${s.reliability}/100`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {ex.rejected_numbers.length > 0 && (
            <p className="text-secondary">
              The AI draft used numbers that could not be traced ({ex.rejected_numbers.join(', ')}), so the computed data is shown instead.
            </p>
          )}
          <p className="text-secondary">
            Answered {when(answer.created_at)} in {answer.total_ms} ms.{' '}
            {answer.layers.map((l) => `${LAYER_LABEL[l.layer]}: ${l.status}${l.note ? ` (${l.note})` : ''}`).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

interface Turn {
  id: number;
  question: string;
  events: LayerEvent[];
  result: AskResult | null;
  error: string | null;
  showWork: boolean;
  shareUrl: string | null;
  shareState: 'idle' | 'working' | 'copied' | 'failed';
}

export default function AdvisorChat({ onHome, shareId }: { onHome: () => void; shareId?: string }) {
  const auth = useAuth();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [useProfile, setUseProfile] = useState(true);
  const [moneyProfile] = useState(() => (typeof window === 'undefined' ? null : loadMoneyProfile()));
  const [shared, setShared] = useState<SharedAdviceView | null>(null);
  const [sharedError, setSharedError] = useState<string | null>(null);
  const [sharedWork, setSharedWork] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareId) return;
    loadShared(shareId)
      .then(setShared)
      .catch((e: unknown) => setSharedError(e instanceof Error ? e.message : 'Could not load this answer.'));
  }, [shareId]);

  const update = (id: number, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));

  const ask = useCallback(
    async (q: string) => {
      const text = q.trim();
      if (text.length < 2 || busy) return;
      const id = nextId.current++;
      setTurns((ts) => [...ts, { id, question: text, events: [], result: null, error: null, showWork: false, shareUrl: null, shareState: 'idle' }]);
      setQuestion('');
      setBusy(true);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
      try {
        const result = await askAdvisor(text, {
          token: auth.session?.access_token ?? null,
          profile: useProfile && moneyProfile ? toAdvisorProfile(moneyProfile) : null,
          onLayer: (e) => update(id, (t) => ({ events: [...t.events, e] })),
        });
        update(id, { result });
      } catch (e) {
        update(id, { error: e instanceof Error ? e.message : 'Something went wrong.' });
      } finally {
        setBusy(false);
      }
    },
    [auth.session?.access_token, busy, moneyProfile, useProfile],
  );

  const share = async (t: Turn) => {
    const token = auth.session?.access_token;
    if (!t.result?.audit || !token) return;
    update(t.id, { shareState: 'working' });
    try {
      const url = t.shareUrl ?? (await shareAnswer(t.result.audit.id, token));
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      update(t.id, { shareUrl: url, shareState: 'copied' });
    } catch {
      update(t.id, { shareState: 'failed' });
    }
  };

  const header = (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onHome}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-secondary hover:bg-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Home
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-ink">ArthaMind Advisor</h1>
          <p className="truncate text-xs text-secondary">Live data, exact maths and the working behind every number</p>
        </div>
      </div>
    </header>
  );

  if (shareId) {
    return (
      <div className="min-h-screen bg-canvas text-ink">
        {header}
        <main className="mx-auto grid max-w-4xl gap-4 px-4 py-6">
          {!shared && !sharedError && <p className="text-sm text-secondary">Loading shared answer…</p>}
          {sharedError && <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink">{sharedError}</p>}
          {shared && (
            <>
              <p className="text-xs text-secondary">
                Shared answer from {when(shared.created_at)}. Market data was live at that time and may have changed. Not personal advice for you.
              </p>
              <p className="rounded-2xl bg-brand-soft px-4 py-3 font-semibold text-ink">{shared.question}</p>
              <button
                type="button"
                onClick={() => setSharedWork((v) => !v)}
                aria-expanded={sharedWork}
                className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-interactive"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${sharedWork ? 'rotate-180' : ''}`} aria-hidden />{' '}
                {sharedWork ? 'Hide the working' : 'Show the working'}
              </button>
              <AnswerView answer={shared.answer} showWork={sharedWork} />
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {header}
      <main className="mx-auto grid w-full max-w-4xl flex-1 content-start gap-5 px-4 py-6">
        {turns.length === 0 && (
          <section className="grid gap-3">
            <h2 className="text-2xl font-bold text-ink">Ask a money question</h2>
            <p className="text-sm text-secondary">
              Every number is calculated, not guessed by AI. Past market patterns are shown as history, never as predictions. Educational information, not
              SEBI-registered investment advice.
            </p>
            <ul className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <li key={e}>
                  <button
                    type="button"
                    onClick={() => void ask(e)}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink hover:border-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {e}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {turns.map((t) => {
          const running = !t.result && !t.error;
          return (
            <section key={t.id} className="grid gap-3" aria-busy={running}>
              <p className="ml-auto max-w-[85%] rounded-2xl bg-brand-soft px-4 py-2.5 font-semibold break-words text-ink">{t.question}</p>
              {(running || t.showWork) && <LayerProgress events={t.events} running={running} />}
              {t.error && (
                <p className="rounded-xl border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-ink" role="alert">
                  {t.error}
                </p>
              )}
              {t.result && (
                <>
                  <AnswerView answer={t.result.answer} showWork={t.showWork} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => update(t.id, { showWork: !t.showWork })}
                      aria-expanded={t.showWork}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${t.showWork ? 'rotate-180' : ''}`} aria-hidden />{' '}
                      {t.showWork ? 'Hide my work' : 'Show my work'}
                    </button>
                    {t.result.audit ? (
                      <button
                        type="button"
                        onClick={() => void share(t)}
                        disabled={t.shareState === 'working'}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-ink hover:bg-hover focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60"
                      >
                        <Link2 className="h-4 w-4" aria-hidden />{' '}
                        {t.shareState === 'copied' ? 'Link copied' : t.shareState === 'failed' ? 'Share failed, retry' : 'Share'}
                      </button>
                    ) : (
                      t.result.audit_note && (
                        <span className="inline-flex items-center gap-1 text-xs text-secondary">
                          <History className="h-3.5 w-3.5" aria-hidden /> {t.result.audit_note}
                        </span>
                      )
                    )}
                    {t.shareUrl && (
                      <a href={t.shareUrl} className="break-all text-xs text-interactive underline">
                        {t.shareUrl}
                      </a>
                    )}
                  </div>
                  {t.shareUrl && (
                    <p className="text-xs text-secondary">
                      Anyone with this link can see the answer. Your saved profile values are not included, but the explanation may mention your numbers.
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}
        <div ref={endRef} />
      </main>
      <form
        className="sticky bottom-0 border-t border-line bg-canvas/95 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <div className="mx-auto grid max-w-4xl gap-2 px-4 py-3">
          <div className="flex gap-2">
            <label htmlFor="advisor-q" className="sr-only">
              Your question
            </label>
            <input
              id="advisor-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1000}
              placeholder="e.g. SIP of ₹5,000 a month for 10 years?"
              className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-secondary focus-visible:outline-2 focus-visible:outline-brand"
            />
            <button
              type="submit"
              disabled={busy || question.trim().length < 2}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 font-semibold text-brand-foreground hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
              <span className="hidden sm:inline">Ask</span>
              <span className="sr-only sm:hidden">Ask</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
            {moneyProfile ? (
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={useProfile} onChange={(e) => setUseProfile(e.target.checked)} className="h-4 w-4 accent-brand" /> Use my money
                profile for this answer
              </label>
            ) : (
              <span>No money profile on this device, so answers are general.</span>
            )}
            {!auth.user && (
              <button type="button" onClick={() => auth.openAuth('login')} className="font-semibold text-interactive underline">
                Sign in to save and share answers
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
