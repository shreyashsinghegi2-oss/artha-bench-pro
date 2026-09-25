import React, { useEffect, useState } from 'react';
import { Globe, UserRoundCheck } from 'lucide-react';
import { setUseMyData, USE_MY_DATA_EVENT, useMyDataEnabled } from '../../services/userContext';

/**
 * Web-search setting shared by every AI chat. "Auto" searches when a question needs current facts
 * (prices, rates, news, new rules); "On" always searches; "Off" answers from the model and app data only.
 * The setting is sent with each AI request (see aiFetchResilience) and applied on the server.
 */
export type WebSearchMode = 'auto' | 'on' | 'off';
const KEY = 'artha.ai.webSearch';
const EVENT = 'artha:web-search-mode';

export function getWebSearchMode(): WebSearchMode {
  try { const v = localStorage.getItem(KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}
export function setWebSearchMode(mode: WebSearchMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable: keep for this page only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

let statusPromise: Promise<{ webSearch?: { provider: string } } | null> | null = null;
const loadStatus = () => (statusPromise ??= fetch('/api/ai/live-sources').then((r) => (r.ok ? r.json() : null)).catch(() => null));

const NEXT: Record<WebSearchMode, WebSearchMode> = { auto: 'on', on: 'off', off: 'auto' };
const LABEL: Record<WebSearchMode, string> = { auto: 'Auto', on: 'On', off: 'Off' };
const HELP: Record<WebSearchMode, string> = {
  auto: 'Searches the web when a question needs current facts, such as prices, rates, news or new rules.',
  on: 'Searches the web for every question and cites what it finds.',
  off: 'Answers from the AI and your app data only, with live market data where available.',
};

export const WebSearchToggle: React.FC<{ className?: string; compact?: boolean }> = ({ className = '', compact = false }) => {
  const [mode, setMode] = useState<WebSearchMode>(getWebSearchMode);
  const [provider, setProvider] = useState('');
  useEffect(() => {
    const on = (e: Event) => setMode((e as CustomEvent<WebSearchMode>).detail);
    window.addEventListener(EVENT, on);
    loadStatus().then((s) => s?.webSearch?.provider && setProvider(s.webSearch.provider));
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const title = `Web search: ${LABEL[mode]}. ${HELP[mode]}${provider ? ` Source: ${provider}.` : ''} Click to change.`;
  return <span className="inline-flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => setWebSearchMode(NEXT[mode])} title={title} aria-label={title}
    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${mode === 'off' ? 'border-line bg-surface text-secondary' : 'border-[#1f8f4e]/40 bg-[#1f8f4e]/10 text-[#1f8f4e]'} ${className}`.trim()}>
    <Globe className="h-3.5 w-3.5" aria-hidden="true"/>{compact ? LABEL[mode] : <>Web search · {LABEL[mode]}</>}
  </button><MyDataToggle compact={compact}/></span>;
};

/**
 * "Use my data": when on, every AI answer uses the user's own numbers from all features (income,
 * spending, loans, portfolio, plans). Off by default; one switch, shared by every assistant.
 */
export const MyDataToggle: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [on, setOn] = useState(useMyDataEnabled);
  useEffect(() => { const s = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail)); window.addEventListener(USE_MY_DATA_EVENT, s); return () => window.removeEventListener(USE_MY_DATA_EVENT, s); }, []);
  const title = on ? 'Your saved numbers (income, spending, loans, portfolio, plans) are used in every AI answer. Click to turn off.' : 'Turn on to let every AI answer use your saved numbers from all features. Off by default.';
  return <button type="button" onClick={() => setUseMyData(!on)} title={title} aria-label={title} aria-pressed={on}
    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${on ? 'border-[#2563eb]/40 bg-[#2563eb]/10 text-[#2563eb]' : 'border-line bg-surface text-secondary'}`}>
    <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true"/>{compact ? (on ? 'My data' : 'My data off') : <>Use my data · {on ? 'On' : 'Off'}</>}
  </button>;
};
