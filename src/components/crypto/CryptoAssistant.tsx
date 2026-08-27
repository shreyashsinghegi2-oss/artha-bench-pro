import React, { useMemo, useState } from 'react';
import { Bot, Clipboard, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import { askCryptoAssistant } from '../../services/cryptoApi';
import type { CryptoCandle, CryptoFeedStatus, CryptoInterval, CryptoSymbol } from './cryptoTypes';

const ASSISTANT_ACTIONS = [
  'Summarize selected candle',
  'Explain this price move',
  'Explain OHLC, volume, and trades',
  'Purchase / avoid checklist',
  'Which crypto deserves more research?',
  'Bullish, neutral, and bearish scenarios',
  'Draft a research note',
] as const;

const sectionStyles: Record<string, { shell: string; heading: string }> = {
  'selected data': { shell: 'border-blue-500/30 bg-blue-500/5', heading: 'text-blue-700' },
  'price summary': { shell: 'border-cyan-500/30 bg-cyan-500/5', heading: 'text-cyan-700' },
  'educational interpretation': { shell: 'border-violet-500/30 bg-violet-500/5', heading: 'text-violet-700' },
  'purchase decision framework': { shell: 'border-amber-500/35 bg-amber-500/5', heading: 'text-amber-700' },
  'comparison framework': { shell: 'border-indigo-500/30 bg-indigo-500/5', heading: 'text-indigo-700' },
  'scenario analysis': { shell: 'border-sky-500/30 bg-sky-500/5', heading: 'text-sky-700' },
  'risk and limitations': { shell: 'border-orange-500/35 bg-orange-500/5', heading: 'text-orange-700' },
  'educational note': { shell: 'border-slate-400/35 bg-slate-500/5', heading: 'text-slate-700' },
};

function formatDateTime(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp)).replace(',', '');
}

function candleChange(candle: CryptoCandle) {
  const absolute = candle.close - candle.open;
  return { absolute, percent: candle.open === 0 ? 0 : absolute / candle.open * 100 };
}

function sectionStyle(title: string, direction: 'up' | 'down' | 'flat') {
  if (title.toLowerCase() === 'what the data shows') {
    if (direction === 'up') return { shell: 'border-success-fill/30 bg-success-fill/5', heading: 'text-success' };
    if (direction === 'down') return { shell: 'border-danger/30 bg-danger/5', heading: 'text-danger' };
  }
  return sectionStyles[title.toLowerCase()] ?? sectionStyles['educational note'];
}

function parseSections(text: string) {
  return text
    .split(/(?=^##\s+)/gm)
    .filter((section) => section.trim())
    .map((section) => {
      const lines = section.trim().split('\n');
      return { title: lines[0].replace(/^##\s+/, '').trim() || 'Response', lines: lines.slice(1) };
    });
}

const ScenarioLine: React.FC<{ line: string }> = ({ line }) => {
  const text = line.replace(/^-\s*/, '').replace(/\*\*/g, '');
  const normalized = text.toLowerCase();
  const className = normalized.startsWith('bullish')
    ? 'border-success-fill/25 bg-success-fill/10 text-success'
    : normalized.startsWith('bearish')
      ? 'border-danger/25 bg-danger/10 text-danger'
      : normalized.startsWith('neutral')
        ? 'border-blue-500/25 bg-blue-500/10 text-blue-700'
        : 'border-line bg-surface text-ink';
  return <p className={`rounded-lg border px-2.5 py-2 text-xs leading-5 ${className}`}>{text}</p>;
};

const StructuredCryptoAnswer: React.FC<{ text: string; direction: 'up' | 'down' | 'flat' }> = ({ text, direction }) => (
  <div className="space-y-3">
    {parseSections(text).map(({ title, lines }) => {
      const style = sectionStyle(title, direction);
      return (
        <section key={title} className={`rounded-xl border-l-4 p-3 ${style.shell}`}>
          <h3 className={`text-sm font-extrabold leading-snug ${style.heading}`}>{title}</h3>
          <div className="mt-2 space-y-1.5 text-xs leading-5 text-ink">
            {lines.map((line, index) => {
              const value = line.trim();
              if (!value || /^\|?\s*-{3}/.test(value)) return null;
              if (title.toLowerCase() === 'scenario analysis' && value.startsWith('- ')) {
                return <ScenarioLine key={`${value}-${index}`} line={value} />;
              }
              if (value.startsWith('|') && value.endsWith('|')) {
                const cells = value.slice(1, -1).split('|').map((cell) => cell.trim());
                return (
                  <div key={`${value}-${index}`} className="grid grid-cols-[minmax(90px,.8fr)_minmax(0,1.2fr)] gap-2 border-b border-line/70 py-1.5 font-mono text-xs tabular-nums">
                    {cells.map((cell, cellIndex) => <span key={`${cell}-${cellIndex}`} className={cellIndex ? 'break-words text-right font-semibold text-ink' : 'font-bold text-secondary'}>{cell.replace(/\*\*/g, '')}</span>)}
                  </div>
                );
              }
              return value.startsWith('- ')
                ? <p key={`${value}-${index}`} className="flex gap-2"><span className={`font-black ${style.heading}`} aria-hidden="true">•</span><span>{value.slice(2).replace(/\*\*/g, '')}</span></p>
                : <p key={`${value}-${index}`}>{value.replace(/\*\*/g, '')}</p>;
            })}
          </div>
        </section>
      );
    })}
  </div>
);

interface CryptoAssistantProps {
  candle: CryptoCandle | null;
  symbol: CryptoSymbol;
  interval: CryptoInterval;
  status: CryptoFeedStatus;
  updatedAt: string | null;
}

export const CryptoAssistant: React.FC<CryptoAssistantProps> = ({ candle, symbol, interval, status, updatedAt }) => {
  const [answer, setAnswer] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const direction = candle ? candle.close > candle.open ? 'up' : candle.close < candle.open ? 'down' : 'flat' : 'flat';
  const context = useMemo(() => {
    if (!candle) return null;
    const change = candleChange(candle);
    return {
      symbol,
      interval,
      candleStatus: candle.closeTime > Date.now() ? 'Forming' as const : 'Closed' as const,
      timeUtc: formatDateTime(candle.openTime, 'UTC'),
      timeIst: formatDateTime(candle.openTime, 'Asia/Kolkata'),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      absoluteChange: change.absolute,
      percentChange: change.percent,
      baseVolume: candle.volume,
      quoteVolume: candle.quoteVolume,
      tradeCount: candle.trades,
      provider: 'Binance Public Market Data' as const,
      streamStatus: status,
      lastUpdatedAt: updatedAt,
    };
  }, [candle, interval, status, symbol, updatedAt]);

  const submitAction = async (action: string) => {
    if (!context || pendingAction) return;
    setPendingAction(action);
    setError('');
    try {
      const response = await askCryptoAssistant(action, context);
      setAnswer(response.answer);
    } catch {
      setError('Crypto Assistant is temporarily unavailable. The verified candle data remains visible above.');
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="rounded-3xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-interactive-soft p-2 text-interactive"><Sparkles className="h-5 w-5" /></div>
        <div><h2 className="text-base font-black text-ink">Crypto Assistant</h2><p className="mt-1 text-xs leading-5 text-secondary">Color-coded Artha AI research guidance grounded in the selected Binance candle.</p></div>
      </div>
      <div className="mt-3 max-h-[480px] overflow-y-auto rounded-2xl border border-line bg-canvas p-3">
        {pendingAction ? <span className="flex items-center gap-2 text-sm text-secondary"><LoaderCircle className="h-4 w-4 animate-spin" /> Preparing a structured explanation…</span>
          : error ? <p className="rounded-xl border border-danger/25 bg-danger/5 p-3 text-xs leading-5 text-danger">{error}</p>
            : answer ? <><Bot className="mb-2 h-4 w-4 text-interactive" /><StructuredCryptoAnswer text={answer} direction={direction} /></>
              : <p className="text-xs leading-5 text-secondary">{candle ? 'Choose an action for a structured explanation, purchase/avoid checklist, comparison framework, or conditional scenarios.' : 'Candle context is unavailable. Select a market and wait for verified candle data.'}</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ASSISTANT_ACTIONS.map((action) => <button key={action} type="button" disabled={!context || Boolean(pendingAction)} onClick={() => void submitAction(action)} className="rounded-full border border-line bg-subtle px-3 py-1.5 text-xs font-bold text-secondary hover:border-interactive/40 hover:text-interactive disabled:opacity-40">{pendingAction === action ? 'Loading…' : action}</button>)}
      </div>
      {answer ? <div className="mt-3 flex gap-3"><button type="button" onClick={() => void navigator.clipboard.writeText(answer)} className="inline-flex items-center gap-1 text-xs font-bold text-interactive"><Clipboard className="h-3.5 w-3.5" /> Copy response</button><button type="button" onClick={() => setAnswer('')} className="inline-flex items-center gap-1 text-xs font-bold text-secondary"><Trash2 className="h-3.5 w-3.5" /> Clear response</button></div> : null}
      <p className="mt-3 border-t border-line pt-3 text-xs leading-5 text-secondary">Educational research guidance only — not personalized investment advice. The assistant will not issue a direct buy/sell order or promise returns.</p>
    </section>
  );
};
