import type { MarketDataState } from './providerContracts';
import type { MarketHistoryPoint, NormalizedMarketQuote } from '../types';

export type MarketRegion = 'india' | 'us' | 'forex';

export interface MarketRegistryAsset {
  id: string;
  symbol: string;
  providerSymbol: string;
  displayName: string;
  market: MarketRegion;
  exchange: string;
  currency: string;
  sector?: string;
  officialWebsite?: string;
}

export interface ForexPair {
  id: string;
  pair: string;
  providerSymbol: string;
  base: string;
  quote: string;
  baseName: string;
  quoteName: string;
}

export const US_MARKET_UNIVERSE: MarketRegistryAsset[] = [
  { id:'spy',symbol:'SPY',providerSymbol:'SPY',displayName:'SPDR S&P 500 ETF Trust',market:'us',exchange:'NYSE Arca',currency:'USD',sector:'Broad market' },
  { id:'aapl',symbol:'AAPL',providerSymbol:'AAPL',displayName:'Apple',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Technology',officialWebsite:'https://www.apple.com/' },
  { id:'nvda',symbol:'NVDA',providerSymbol:'NVDA',displayName:'NVIDIA',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Semiconductors',officialWebsite:'https://www.nvidia.com/' },
  { id:'msft',symbol:'MSFT',providerSymbol:'MSFT',displayName:'Microsoft',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Technology',officialWebsite:'https://www.microsoft.com/' },
  { id:'googl',symbol:'GOOGL',providerSymbol:'GOOGL',displayName:'Alphabet',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Communication services',officialWebsite:'https://abc.xyz/' },
  { id:'amzn',symbol:'AMZN',providerSymbol:'AMZN',displayName:'Amazon',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Consumer',officialWebsite:'https://www.amazon.com/' },
  { id:'meta',symbol:'META',providerSymbol:'META',displayName:'Meta Platforms',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Communication services',officialWebsite:'https://about.meta.com/' },
  { id:'tsla',symbol:'TSLA',providerSymbol:'TSLA',displayName:'Tesla',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Automobile',officialWebsite:'https://www.tesla.com/' },
  { id:'jpm',symbol:'JPM',providerSymbol:'JPM',displayName:'JPMorgan Chase',market:'us',exchange:'NYSE',currency:'USD',sector:'Financials',officialWebsite:'https://www.jpmorganchase.com/' },
  { id:'xom',symbol:'XOM',providerSymbol:'XOM',displayName:'Exxon Mobil',market:'us',exchange:'NYSE',currency:'USD',sector:'Energy',officialWebsite:'https://corporate.exxonmobil.com/' },
  { id:'qqq',symbol:'QQQ',providerSymbol:'QQQ',displayName:'Invesco QQQ Trust',market:'us',exchange:'NASDAQ',currency:'USD',sector:'Technology index' },
  { id:'dia',symbol:'DIA',providerSymbol:'DIA',displayName:'SPDR Dow Jones Industrial Average ETF',market:'us',exchange:'NYSE Arca',currency:'USD',sector:'Broad market' },
];

export const FOREX_PAIRS: ForexPair[] = [
  { id:'usd-inr',pair:'USD/INR',providerSymbol:'INR=X',base:'USD',quote:'INR',baseName:'US Dollar',quoteName:'Indian Rupee' },
  { id:'eur-inr',pair:'EUR/INR',providerSymbol:'EURINR=X',base:'EUR',quote:'INR',baseName:'Euro',quoteName:'Indian Rupee' },
  { id:'gbp-inr',pair:'GBP/INR',providerSymbol:'GBPINR=X',base:'GBP',quote:'INR',baseName:'British Pound',quoteName:'Indian Rupee' },
  { id:'jpy-inr',pair:'JPY/INR',providerSymbol:'JPYINR=X',base:'JPY',quote:'INR',baseName:'Japanese Yen',quoteName:'Indian Rupee' },
  { id:'eur-usd',pair:'EUR/USD',providerSymbol:'EURUSD=X',base:'EUR',quote:'USD',baseName:'Euro',quoteName:'US Dollar' },
  { id:'gbp-usd',pair:'GBP/USD',providerSymbol:'GBPUSD=X',base:'GBP',quote:'USD',baseName:'British Pound',quoteName:'US Dollar' },
  { id:'usd-jpy',pair:'USD/JPY',providerSymbol:'JPY=X',base:'USD',quote:'JPY',baseName:'US Dollar',quoteName:'Japanese Yen' },
  { id:'aud-usd',pair:'AUD/USD',providerSymbol:'AUDUSD=X',base:'AUD',quote:'USD',baseName:'Australian Dollar',quoteName:'US Dollar' },
  { id:'usd-cad',pair:'USD/CAD',providerSymbol:'CAD=X',base:'USD',quote:'CAD',baseName:'US Dollar',quoteName:'Canadian Dollar' },
  { id:'usd-chf',pair:'USD/CHF',providerSymbol:'CHF=X',base:'USD',quote:'CHF',baseName:'US Dollar',quoteName:'Swiss Franc' },
];

export type MarketDataLabel = 'Live verified feed'|'Recently refreshed'|'Delayed quote'|'End-of-day reference'|'Cached reference'|'Stale data'|'Unavailable'|'Demo data';

export function marketDataState(quote?: NormalizedMarketQuote | null): { state: MarketDataState; label: MarketDataLabel } {
  if (!quote) return { state:'unavailable',label:'Unavailable' };
  if (quote.freshness === 'demo') return { state:'demo',label:'Demo data' };
  if (quote.freshness === 'stale') return { state:'stale',label:'Stale data' };
  if (quote.freshness === 'end_of_day') return { state:'end_of_day',label:'End-of-day reference' };
  if (quote.freshness === 'delayed') return { state:'delayed',label:'Delayed quote' };
  if (quote.freshness === 'real_time' && quote.providerTimestamp) return { state:'live_verified',label:'Live verified feed' };
  if (quote.freshness === 'real_time') return { state:'recently_refreshed',label:'Recently refreshed' };
  return { state:'unavailable',label:'Unavailable' };
}

export function quoteAttribution(quote?: NormalizedMarketQuote | null) {
  const state = marketDataState(quote);
  return {
    provider: quote?.providerName || 'No verified provider response',
    quoteTimestamp: quote?.providerTimestamp || null,
    retrievedAt: quote?.retrievedAt || null,
    state: state.state,
    label: state.label,
    exchange: quote?.exchange || null,
  };
}

export function hasGenuineOhlc(points: MarketHistoryPoint[]): boolean {
  return points.length > 1 && points.every((point) => [point.open,point.high,point.low,point.close].every((value) => typeof value === 'number' && Number.isFinite(value)));
}

export function looksIntraday(points: MarketHistoryPoint[]): boolean {
  if (points.length < 3) return false;
  return points.some((point) => /T\d{2}:\d{2}|\s\d{2}:\d{2}/.test(point.date));
}

export function historyStats(points: MarketHistoryPoint[]) {
  if (!points.length) return null;
  const prices = points.map((point) => point.price).filter(Number.isFinite);
  if (!prices.length) return null;
  const first = prices[0], last = prices[prices.length-1];
  return { high:Math.max(...prices),low:Math.min(...prices),returnPercent:first===0?null:((last/first)-1)*100,observations:prices.length,start:points[0]?.date||null,end:points.at(-1)?.date||null };
}

export type MarketAlertKind = 'price_threshold'|'movement'|'period_high_low'|'data_quality'|'watchlist_update'|'fx_reference';
export interface MarketAlertRecord { id:string;kind:MarketAlertKind;symbol:string;label:string;threshold:number|null;direction:'above'|'below'|'absolute'|null;createdAt:string;enabled:boolean;lastEvaluatedAt:string|null;lastState:string; }
export interface PaperMarketScenario { id:string;symbol:string;observedPrice:number;quantity:number;hypothesis:string;createdAt:string;sourceLabel:string;sourceTimestamp:string|null;retrievedAt:string|null; }

const ALERT_KEY='arthabench_market_alerts_v1';
const PAPER_KEY='arthabench_market_learning_scenarios_v1';
const FX_FAV_KEY='arthabench_fx_favourites_v1';
const safeParse=<T,>(key:string,fallback:T):T=>{if(typeof window==='undefined')return fallback;try{const raw=window.localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback;}catch{return fallback;}};
const safeSave=<T,>(key:string,value:T)=>{if(typeof window!=='undefined')window.localStorage.setItem(key,JSON.stringify(value));};
export const loadMarketAlerts=()=>safeParse<MarketAlertRecord[]>(ALERT_KEY,[]);
export const saveMarketAlerts=(rows:MarketAlertRecord[])=>safeSave(ALERT_KEY,rows);
export const loadPaperMarketScenarios=()=>safeParse<PaperMarketScenario[]>(PAPER_KEY,[]);
export const savePaperMarketScenarios=(rows:PaperMarketScenario[])=>safeSave(PAPER_KEY,rows);
export const loadFxFavourites=()=>safeParse<string[]>(FX_FAV_KEY,['USD/INR']);
export const saveFxFavourites=(rows:string[])=>safeSave(FX_FAV_KEY,rows);

export function evaluateAlert(alert: MarketAlertRecord, quote?: NormalizedMarketQuote | null): string {
  const state=marketDataState(quote);
  if(alert.kind==='data_quality') return state.state==='stale'||state.state==='unavailable'?'Condition met':`Data state: ${state.label}`;
  if(!quote||alert.threshold==null) return 'Waiting for a verified quote';
  if(alert.kind==='movement') return Math.abs(quote.changePercent??0)>=alert.threshold?'Condition met':`Current absolute movement ${Math.abs(quote.changePercent??0).toFixed(2)}%`;
  if(alert.direction==='above') return quote.price>=alert.threshold?'Condition met':`Current ${quote.price}`;
  if(alert.direction==='below') return quote.price<=alert.threshold?'Condition met':`Current ${quote.price}`;
  return 'Waiting for condition';
}

export const MARKET_SAFE_REDIRECT='I can help you inspect the current chart, compare timestamped market information, explain risk and terminology, or create an educational research checklist. I cannot provide personalised trade instructions, buy/sell calls, targets, stop-loss levels, or profit guarantees.';

export function isUnsafeTradingAdviceRequest(question:string): boolean {
  return /\b(buy|sell|short|long|entry|exit|target\s*price|target|stop[- ]?loss|sure[- ]?shot|guarantee(?:d)?\s+(?:profit|return|trade)|which\s+(?:stock|pair).*(?:double|best|trade)|where\s+to\s+invest|what\s+should\s+i\s+(?:buy|sell))\b/i.test(question);
}

export function buildMarketExplainerPrompt(input:{question:string;page:string;visibleData:unknown;sourceLabels:string[]}){
  return `You are ArthaMind Market Explainer inside Artha Bench Pro. This is evidence-grounded market education, never investment advice. Use ONLY the page-visible JSON and source labels supplied below. Never invent a price, timestamp, indicator, quote, event, company fact, bid/ask, volume, market-cap, session state or missing field. Never provide personalised buy/sell/hold instructions, entries/exits, targets, stop-losses, leverage guidance, profit promises, forecasts or portfolio allocation. If asked for those, reply exactly: ${MARKET_SAFE_REDIRECT} Use these sections: What the visible data shows | Supporting data and timestamps | Limitations / what is missing | Educational concepts | Optional research questions. Always mention provider/source, quote timestamp when available, Artha Bench retrieval time, and data-state/freshness. End with: Educational analysis only — not personalised investment, trading, tax, legal, or financial advice. Page: ${input.page}. Question: ${input.question.slice(0,500)}. Sources: ${input.sourceLabels.join('; ')}. Visible data: ${JSON.stringify(input.visibleData).slice(0,5200)}`;
}
