/**
 * Generic market-data adapter for non-directory routes.
 *
 * India company directory quotes use the dedicated asset-ID mapping service.
 * This adapter deliberately does not convert Yahoo `.NS`/`.BO` identifiers into
 * assumed Twelve Data identifiers.
 */
import type { MarketHistoryPoint, NormalizedMarketQuote, ProviderDiagnostic } from '../../src/types';
import { fetchYahooFinanceHistory, fetchYahooFinanceQuote, isYahooFinanceProvider } from './yahooFinanceProvider';
import {
  fetchTwelveDataVerifiedHistory,
  fetchTwelveDataVerifiedQuote,
  isTwelveDataConfigured,
  TwelveDataProviderError,
} from './twelveDataProvider';

export type ProviderStatus = 'connected' | 'not_configured' | 'invalid_credentials' | 'invalid_response' | 'rate_limited' | 'error';
export interface MarketQuoteProviderResult { quote: NormalizedMarketQuote; status: ProviderStatus; message?: string; }
type NamedMarketProvider = 'yahoo' | 'twelvedata';

export interface NormalizedTwelveDataSymbol {
  providerSymbol: string;
  baseSymbol: string;
  exchange: null;
}

function safeNeutralSymbol(symbol:string){
  const value=symbol.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(value))throw new Error('A verified provider-specific symbol is required.');
  if(/\.(NS|BO)$/i.test(value)||value.includes(':')||value.startsWith('^')||value.includes('=X')){
    throw new Error('Provider-specific mapping is required for this symbol; no cross-provider symbol conversion is performed.');
  }
  return value;
}

/** Compatibility export: validation only, never a cross-provider mapping function. */
export function normalizeTwelveDataSymbol(symbol:string):NormalizedTwelveDataSymbol{
  const providerSymbol=safeNeutralSymbol(symbol);
  return{providerSymbol,baseSymbol:providerSymbol,exchange:null};
}

function providerName(value:string):NamedMarketProvider|null{
  if(isYahooFinanceProvider(value))return'yahoo';
  if(value==='twelvedata'||value==='twelve-data'||value==='twelve_data')return'twelvedata';
  return null;
}

function configuration(){return{
  provider:(process.env.MARKET_DATA_PROVIDER||'hybrid').trim().toLowerCase(),
  primary:(process.env.MARKET_DATA_PRIMARY_PROVIDER||'yahoo').trim().toLowerCase(),
  fallback:(process.env.MARKET_DATA_FALLBACK_PROVIDER||'twelvedata').trim().toLowerCase(),
};}

function statusFromError(error:unknown):ProviderStatus{
  if(error instanceof TwelveDataProviderError){
    if(error.category==='missing_configuration')return'not_configured';
    if(error.category==='authentication')return'invalid_credentials';
    if(error.category==='rate_limit')return'rate_limited';
    if(error.category==='invalid_response')return'invalid_response';
  }
  return'error';
}

function safeMessage(provider:NamedMarketProvider,status:ProviderStatus){
  if(status==='not_configured')return `${provider==='yahoo'?'Yahoo Finance':'Twelve Data'} is not configured for this request.`;
  if(status==='invalid_credentials')return 'Market-data provider authentication failed.';
  if(status==='rate_limited')return 'Market-data provider rate limit reached.';
  if(status==='invalid_response')return 'Market-data provider returned an invalid response.';
  return 'Market-data provider is unavailable for this symbol.';
}

function providerOrder():NamedMarketProvider[]{
  const config=configuration();
  if(config.provider==='hybrid'){
    const first=providerName(config.primary);
    const second=providerName(config.fallback);
    return [...new Set([first||'yahoo',second||'twelvedata'])];
  }
  const selected=providerName(config.provider);
  if(!selected)throw new Error(`Unsupported MARKET_DATA_PROVIDER: ${config.provider}`);
  // Explicit provider selection is strict. Do not silently change the provider.
  return[selected];
}

async function quoteFrom(provider:NamedMarketProvider,symbol:string,assetType:string):Promise<MarketQuoteProviderResult>{
  if(provider==='yahoo'){
    const result=await fetchYahooFinanceQuote(symbol,assetType);
    if(result.status!=='connected'||result.quote.freshness==='demo'||!Number.isFinite(result.quote.price)||result.quote.price<0)throw new Error('Yahoo Finance quote unavailable.');
    return result;
  }
  if(!isTwelveDataConfigured())throw new TwelveDataProviderError('missing_configuration','Twelve Data API key is not configured.');
  const normalized=normalizeTwelveDataSymbol(symbol);
  const quote=await fetchTwelveDataVerifiedQuote({providerSymbol:normalized.providerSymbol,assetType,displaySymbol:symbol});
  return{quote,status:'connected',message:`Twelve Data ${quote.freshness.replaceAll('_',' ')} quote loaded.`};
}

export async function fetchQuoteFromProvider(symbol:string,assetType='equity'):Promise<MarketQuoteProviderResult>{
  const failures:string[]=[];
  for(const provider of providerOrder()){
    if(provider==='twelvedata'&&!isTwelveDataConfigured()){failures.push('Twelve Data not configured');continue;}
    try{return await quoteFrom(provider,symbol,assetType);}catch(error){const status=statusFromError(error);failures.push(safeMessage(provider,status));if(configuration().provider!=='hybrid')break;}
  }
  throw new Error(`Market data unavailable for ${symbol}. ${failures.join(' ')}`);
}

async function historyFrom(provider:NamedMarketProvider,symbol:string,range:string):Promise<MarketHistoryPoint[]>{
  if(provider==='yahoo')return fetchYahooFinanceHistory(symbol,range);
  if(!isTwelveDataConfigured())return[];
  const normalized=normalizeTwelveDataSymbol(symbol);
  return fetchTwelveDataVerifiedHistory({providerSymbol:normalized.providerSymbol,range});
}

export async function fetchHistoryFromProvider(symbol:string,range='1m'):Promise<MarketHistoryPoint[]>{
  for(const provider of providerOrder()){
    try{const points=await historyFrom(provider,symbol,range);if(points.length)return points;}catch{if(configuration().provider!=='hybrid')return[];}
  }
  return[];
}

export async function checkMarketProviderDiagnostic():Promise<ProviderDiagnostic>{
  const startedAt=Date.now();const checkedAt=new Date().toISOString();
  try{
    const result=await fetchQuoteFromProvider('AAPL','equity');
    return{id:'market-data',name:result.quote.providerName,role:'Generic market quotes/history with explicit provider selection and provider-derived freshness',status:'connected',lastChecked:checkedAt,latencyMs:Date.now()-startedAt,message:result.message||'Provider quote check succeeded.'};
  }catch(error){
    const message=error instanceof Error?error.message:'Market data unavailable.';
    const lower=message.toLowerCase();
    const status:ProviderDiagnostic['status']=lower.includes('not configured')?'not_configured':lower.includes('authentication')?'invalid_credentials':lower.includes('rate limit')?'rate_limited':'error';
    return{id:'market-data',name:'Market Data',role:'Generic market quotes and history',status,lastChecked:checkedAt,latencyMs:Date.now()-startedAt,message};
  }
}
