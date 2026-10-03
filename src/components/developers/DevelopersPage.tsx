import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, KeyRound, Play, Webhook } from 'lucide-react';

/* ---------- Types for the registry returned by GET /api/v1/calculators ---------- */

interface NumberParamInfo {
  kind: 'number';
  name: string;
  description: string;
  required: boolean;
  min: number;
  max: number;
  default?: number;
  example: number;
}
interface EnumParamInfo {
  kind: 'enum';
  name: string;
  description: string;
  required: boolean;
  values: string[];
  default?: string;
  example: string;
}
type ParamInfo = NumberParamInfo | EnumParamInfo;

interface EndpointInfo {
  id: string;
  label: string;
  path: string;
  group: 'Calculators' | 'Market' | 'Service';
  summary: string;
  params: ParamInfo[];
}

interface CalculatorListing {
  slug: string;
  summary: string;
  formula: string;
  path: string;
  params: ParamInfo[];
}

interface PlaygroundResult {
  status: number;
  ms: number;
  body: string;
}

const STATIC_ENDPOINTS: EndpointInfo[] = [
  {
    id: 'market/nifty',
    label: 'NIFTY 50',
    path: '/api/v1/market/nifty',
    group: 'Market',
    summary: 'NIFTY 50 quote (Yahoo Finance, usually delayed).',
    params: [],
  },
  { id: 'market/btc', label: 'Bitcoin', path: '/api/v1/market/btc', group: 'Market', summary: 'BTC/USDT 24-hour statistics from Binance.', params: [] },
  {
    id: 'market/fii-dii',
    label: 'FII / DII flows',
    path: '/api/v1/market/fii-dii',
    group: 'Market',
    summary: 'NSE provisional cash-market flows (₹ crore). NSE sometimes blocks cloud servers.',
    params: [],
  },
  {
    id: 'market/sector-rotation',
    label: 'Sector rotation',
    path: '/api/v1/market/sector-rotation',
    group: 'Market',
    summary: 'Ten NSE sectors ranked by 1-day change.',
    params: [],
  },
  { id: 'health', label: 'Health', path: '/api/v1/health', group: 'Service', summary: 'Uptime and data-source health.', params: [] },
];

const FALLBACK_CALC: EndpointInfo = {
  id: 'calculators/emi',
  label: 'emi',
  path: '/api/v1/calculators/emi',
  group: 'Calculators',
  summary: 'Loan EMI (reducing balance)',
  params: [
    { kind: 'number', name: 'principal', description: 'Loan amount', required: true, min: 0.01, max: 1e12, example: 1000000 },
    { kind: 'number', name: 'rate', description: 'Annual interest rate in percent', required: true, min: 0, max: 100, example: 8.5 },
    { kind: 'number', name: 'months', description: 'Tenure in months', required: true, min: 1, max: 600, example: 240 },
  ],
};

const origin = (): string => (typeof window === 'undefined' ? 'https://artha-bench-pro.vercel.app' : window.location.origin);

function buildUrl(ep: EndpointInfo, values: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const p of ep.params) {
    const v = values[p.name]?.trim();
    if (v) q.set(p.name, v);
  }
  const qs = q.toString();
  return `${origin()}${ep.path}${qs ? `?${qs}` : ''}`;
}

function snippets(url: string): Record<'cURL' | 'JavaScript' | 'Python', string> {
  return {
    cURL: `curl -s "${url}"`,
    JavaScript: `const res = await fetch("${url}");\nconst { data, source, reliability_score } = await res.json();\nconsole.log(data, source, reliability_score);`,
    Python: `import requests\n\nr = requests.get("${url}", timeout=10)\nbody = r.json()\nprint(body["data"], body["source"], body["reliability_score"])`,
  };
}

const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-hover"
      aria-label={`Copy ${label}`}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
};

const Code: React.FC<{ text: string; label: string }> = ({ text, label }) => (
  <div className="relative min-w-0">
    <div className="absolute right-2 top-2">
      <CopyButton text={text} label={label} />
    </div>
    <pre className="overflow-x-auto rounded-xl border border-line bg-subtle p-4 pr-24 text-[12.5px] leading-6 text-ink">
      <code>{text}</code>
    </pre>
  </div>
);

const card = 'min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6';

export default function DevelopersPage({ onHome }: { onHome: () => void }): React.JSX.Element {
  const [calculators, setCalculators] = useState<EndpointInfo[]>([FALLBACK_CALC]);
  const [selectedId, setSelectedId] = useState(FALLBACK_CALC.id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'cURL' | 'JavaScript' | 'Python'>('cURL');
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Developers · ArthaBench API';
    let cancelled = false;
    fetch('/api/v1/calculators')
      .then((r) => r.json() as Promise<{ data: CalculatorListing[] }>)
      .then((body) => {
        if (cancelled || !Array.isArray(body.data)) return;
        setCalculators(
          body.data.map((c) => ({
            id: `calculators/${c.slug}`,
            label: c.slug,
            path: c.path,
            group: 'Calculators',
            summary: `${c.summary}. ${c.formula}`,
            params: c.params,
          })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const endpoints = useMemo(() => [...calculators, ...STATIC_ENDPOINTS], [calculators]);
  const selected = endpoints.find((e) => e.id === selectedId) ?? FALLBACK_CALC;

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of selected.params) next[p.name] = p.required ? String(p.example) : '';
    setValues(next);
    setResult(null);
  }, [selected]);

  const url = buildUrl(selected, values);
  const code = snippets(url);

  const send = async () => {
    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch(url);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* not JSON */
      }
      setResult({ status: res.status, ms: Math.round(performance.now() - started), body: pretty });
    } catch (e) {
      setResult({ status: 0, ms: Math.round(performance.now() - started), body: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  };

  const webhookCreate = `curl -X POST "${origin()}/api/v1/webhooks" \\\n  -H "x-api-key: $ARTHABENCH_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url":"https://example.com/hooks/nifty","symbol":"nifty","condition":"above","threshold":25000}'`;
  const webhookVerify = `import { createHmac, timingSafeEqual } from "node:crypto";\n\n// rawBody: the exact bytes we POSTed; secret: the whsec_… value returned when you created the webhook\nexport function isFromArthaBench(rawBody, signatureHeader, secret) {\n  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");\n  const a = Buffer.from(expected), b = Buffer.from(signatureHeader ?? "");\n  return a.length === b.length && timingSafeEqual(a, b);\n}`;
  const aiCall = `curl -X POST "${origin()}/api/v1/ai/cfo" \\\n  -H "x-api-key: $ARTHABENCH_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"query":"Should I prepay my ₹30,00,000 home loan at 8.5% or invest in an index fund?"}'`;

  const groups: Array<EndpointInfo['group']> = ['Calculators', 'Market', 'Service'];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button type="button" onClick={onHome} className="inline-flex items-center gap-1.5 text-sm font-bold text-secondary hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> ArthaMind home
          </button>
          <nav className="flex flex-wrap gap-2 text-xs font-bold" aria-label="API references">
            <a
              className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-interactive"
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Swagger docs <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-interactive"
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenAPI spec <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section>
          <p className="text-xs font-black uppercase tracking-[.14em] text-brand">ArthaBench public API</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Financial calculators and market data, one GET away</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-secondary">
            {`${calculators.length > 1 ? calculators.length : 19} deterministic calculators (India, US, UK, Philippines, Nigeria and Kenya tax included) and market data. No key needed for GET endpoints; every response says where the numbers came from and how reliable they are. Educational use only, not investment, tax or legal advice.`}
          </p>
        </section>

        <section className={card} aria-labelledby="envelope-title">
          <h2 id="envelope-title" className="text-lg font-black">
            Every response has the same shape
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Code
              label="response shape"
              text={`{\n  "data": { ... },\n  "source": "ArthaBench deterministic calculator · reducing-balance EMI formula",\n  "timestamp": "2026-09-30T10:00:00.000Z",\n  "reliability_score": 100,\n  "is_deterministic": true\n}`}
            />
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">How the reliability score is set</caption>
                <thead>
                  <tr className="border-b border-line text-secondary">
                    <th className="py-2 pr-3 font-bold">Kind of data</th>
                    <th className="py-2 font-bold">reliability_score</th>
                  </tr>
                </thead>
                <tbody className="text-ink">
                  <tr className="border-b border-line">
                    <td className="py-2 pr-3">Calculator, all rates statutory or yours</td>
                    <td>100</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-2 pr-3">Calculator using a default scheme rate (PPF, SSY, EPF, NPS)</td>
                    <td>90</td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="py-2 pr-3">Market data</td>
                    <td>Source (NSE 95, Binance 90, Yahoo 85) minus freshness penalty (0 / 10 / 25 / 40 / 60)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3">AI answers</td>
                    <td>15 to 95 from evidence: linked sources, certified numbers, citation fixes. Never 100.</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-3 text-xs leading-5 text-secondary">
                Limits: 100 requests a minute per IP without a key, 1,000 with a key. Calculator and market responses are cached for 60 seconds.
              </p>
            </div>
          </div>
        </section>

        <section className={card} aria-labelledby="playground-title">
          <h2 id="playground-title" className="text-lg font-black">
            API playground
          </h2>
          <p className="mt-1 text-xs text-secondary">Pick an endpoint, change the inputs and press Send. Requests go to this site’s live API.</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 space-y-4">
              <div>
                <label htmlFor="pg-endpoint" className="text-xs font-bold text-ink">
                  Endpoint
                </label>
                <select
                  id="pg-endpoint"
                  value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink"
                >
                  {groups.map((g) => (
                    <optgroup key={g} label={g}>
                      {endpoints
                        .filter((e) => e.group === g)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.path.replace('/api/v1/', '')}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <p className="mt-2 text-xs leading-5 text-secondary">{selected.summary}</p>
              </div>
              {selected.params.map((p) => (
                <div key={p.name}>
                  <label htmlFor={`pg-${p.name}`} className="text-xs font-bold text-ink">
                    {p.name}
                    {p.required ? (
                      <span className="text-danger"> *</span>
                    ) : (
                      <span className="font-normal text-secondary"> (optional{p.default !== undefined ? `, default ${p.default}` : ''})</span>
                    )}
                  </label>
                  {p.kind === 'enum' ? (
                    <select
                      id={`pg-${p.name}`}
                      value={values[p.name] ?? ''}
                      onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink"
                    >
                      {!p.required && <option value="">(default)</option>}
                      {p.values.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`pg-${p.name}`}
                      inputMode="decimal"
                      value={values[p.name] ?? ''}
                      placeholder={String(p.example)}
                      onChange={(e) => setValues({ ...values, [p.name]: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink"
                    />
                  )}
                  <p className="mt-1 text-[11px] leading-4 text-secondary">{p.description}</p>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-5 py-2.5 text-sm font-black text-white hover:bg-[#115E59] disabled:opacity-60"
              >
                <Play className="h-4 w-4" aria-hidden="true" /> {busy ? 'Sending…' : 'Send'}
              </button>
            </div>
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Code language">
                {(['cURL', 'JavaScript', 'Python'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === t ? 'bg-ink text-canvas' : 'border border-line text-secondary'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Code label={`${tab} snippet`} text={code[tab]} />
              <div aria-live="polite">
                {result && (
                  <div>
                    <p className="mb-2 text-xs font-bold">
                      <span className={result.status >= 200 && result.status < 300 ? 'text-success' : 'text-danger'}>HTTP {result.status || 'error'}</span>
                      <span className="text-secondary"> · {result.ms} ms</span>
                    </p>
                    <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-canvas p-4 text-[12px] leading-5 text-ink">{result.body}</pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={card} aria-labelledby="keys-title">
            <h2 id="keys-title" className="flex items-center gap-2 text-lg font-black">
              <KeyRound className="h-5 w-5 text-brand" aria-hidden="true" /> API keys and AI endpoints
            </h2>
            <p className="mt-2 text-xs leading-6 text-secondary">
              POST /api/v1/ai/cfo (grounded AI CFO brief) and POST /api/v1/ai/benchmark (score a model on your numeric questions) need a key in the x-api-key
              header. Keys also raise your limit to 1,000 requests a minute. Keys are issued by the project maintainers for now; self-service keys come with
              paid plans.
            </p>
            <div className="mt-3">
              <Code label="AI CFO request" text={aiCall} />
            </div>
          </section>

          <section className={card} aria-labelledby="webhooks-title">
            <h2 id="webhooks-title" className="flex items-center gap-2 text-lg font-black">
              <Webhook className="h-5 w-5 text-brand" aria-hidden="true" /> Market alerts by webhook
            </h2>
            <p className="mt-2 text-xs leading-6 text-secondary">
              Get a signed POST when NIFTY or BTC crosses your level. Alerts fire when the condition becomes true, and again only after it has been false in
              between. Your URL must be public https. The secret is shown once when you create the webhook.
            </p>
            <div className="mt-3 space-y-3">
              <Code label="create webhook" text={webhookCreate} />
              <Code label="verify signature" text={webhookVerify} />
            </div>
          </section>
        </div>

        <section className={card} aria-labelledby="mcp-title">
          <h2 id="mcp-title" className="text-lg font-black">
            Use ArthaBench from your AI assistant (MCP)
          </h2>
          <p className="mt-2 text-xs leading-6 text-secondary">
            An MCP server that exposes these calculators and market data as tools for Claude Code, Cursor, Goose and Windsurf is the next module. Until then,
            any assistant that can make HTTP requests can call the endpoints above directly.
          </p>
        </section>
      </main>
    </div>
  );
}
