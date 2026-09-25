import type { AppNavigationDestination } from '../navigationTypes';
import { loadAiDataContext, type AiDataContextPreferences } from './aiDataContext';

export type ArthaPilotIntent = 'finance'|'calculation'|'learning'|'market'|'verify'|'future'|'navigation'|'ambiguous';
export interface ArthaPilotUserContext { language:string; country:string; currency:string; learnerLevel:string; detail:string; dataPermissions:AiDataContextPreferences; }
export interface ArthaPilotRoute { intent:ArthaPilotIntent; destination:AppNavigationDestination|null; workspaceLabel:string; status:string; requiresPersonalContext:boolean; allowedContext:string[]; clarification?:string; }
export interface ArthaPilotHandoff { request:string; intent:ArthaPilotIntent; destination:AppNavigationDestination; workspaceLabel:string; context:ArthaPilotUserContext; createdAt:string; }
export const ARTHA_PILOT_HANDOFF_KEY='arthabench_artha_pilot_handoff_v1';
export const ARTHA_PILOT_RECENT_KEY='arthabench_artha_pilot_recent_v1';

// Each pattern carries a weight: specific subjects (NIFTY, EMI, "what if") outrank generic verbs
// ("explain", "open"), so "Explain why NIFTY moved" routes to markets rather than the tutor.
const patterns:Array<{intent:ArthaPilotIntent;destination:AppNavigationDestination;label:string;status:string;terms:RegExp;weight:number}>= [
  {intent:'calculation',destination:'portfolio',label:'Portfolio & net worth',status:'Opening your portfolio',terms:/\b(portfolio|net worth|cas|consolidated account statement|my (mutual )?funds|holdings|xirr|my investments)\b/gi,weight:5},
  {intent:'calculation',destination:'money-planner',label:'Money Planner',status:'Allocating the amount step by step',terms:/\b(lump ?sum|bonus|where (should|do) i (put|invest)|how (should|do) i invest|allocate|allocation|planner)\b/gi,weight:4},
  {intent:'calculation',destination:'my-dashboard',label:'Dashboard',status:'Opening your complete dashboard',terms:/\b(dashboard|net worth|total (investments?|savings|tax)|everything at a glance)\b/gi,weight:4},
  {intent:'calculation',destination:'emi-manager',label:'EMI Manager & calculator',status:'Applying the deterministic EMI formula',terms:/\b(emi|emis|loan|loans|interest rate|principal|tenure|compound interest|calculate my emi|calculate.*loan|calculation|formula|prepay|prepayment|foreclose)\b/gi,weight:3},
  {intent:'verify',destination:'evaluation-lab',label:'Evaluation Lab',status:'Preparing a verified evaluation',terms:/\b(verify|verification|check this|check if|fact check|is this answer|claim|reliable|trustworthy|proof|decision receipt)\b/gi,weight:3},
  {intent:'learning',destination:'tutor',label:'Financial Tutor',status:'Opening a learning session',terms:/\b(learn|explain|quiz|flashcard|flash cards|revision|revise|teach|lesson|study|practice|what is|meaning of)\b/gi,weight:1},
  {intent:'future',destination:'financial-twin',label:'Ripple Twin',status:'Opening your future scenario workspace',terms:/\b(future|what if|what happens if|scenario|save every month|every month|per month|projection|projected|replay|changes? if|in \d+ years?)\b/gi,weight:3},
  {intent:'market',destination:'crypto',label:'Crypto workspace',status:'Retrieving verified crypto data',terms:/\b(crypto|bitcoin|ethereum|btc|eth)\b/gi,weight:3},
  {intent:'market',destination:'news',label:'Business News',status:'Retrieving verified business news',terms:/\b(news|business news|company news|latest news|news about|headlines)\b/gi,weight:3},
  {intent:'market',destination:'economy',label:'Economic Data',status:'Retrieving verified economic data',terms:/\b(economic data|economy|inflation|gdp|interest rates|repo rate|fred|world bank)\b/gi,weight:3},
  {intent:'market',destination:'markets',label:'Market Data workspace',status:'Retrieving verified market data',terms:/\b(nifty|sensex|stock|stocks|share|shares|market|markets|forex|ticker|price moved|moved today|market data)\b/gi,weight:3},
  {intent:'finance',destination:'budgeting',label:'Finance workspace',status:'Checking your budget context',terms:/\b(budget|income|expense|expenses|spending|salary|goal|saving|savings|emergency fund|cash flow|money plan|plan my money|cfo)\b/gi,weight:2},
  {intent:'navigation',destination:'overview',label:'Global workspace search',status:'Finding the right workspace',terms:/\b(where|find|open|go to|navigate|continue|what should i complete first|next step|workspace|feature|search)\b/gi,weight:0.5},
];

export function readArthaPilotContext():ArthaPilotUserContext {
  const context=loadAiDataContext();
  const read=(keys:string[],fallback:string)=>{for(const key of keys){const value=typeof window!=='undefined'?window.localStorage.getItem(key):null;if(value)return value;}return fallback;};
  let tutorPrefs:Record<string,unknown>={};
  try { if(typeof window!=='undefined') tutorPrefs=JSON.parse(window.localStorage.getItem('artha_tutor_preferences_v1')||'{}'); } catch { /* safe fallback */ }
  return {language:String(tutorPrefs.language||read(['artha-language','artha_language','language'],'english')),country:String(tutorPrefs.country||read(['artha-country','artha_country','country'],'India')),currency:String(tutorPrefs.currency||read(['artha-currency','artha_currency','currency'],'INR')),learnerLevel:String(tutorPrefs.level||read(['artha-learner-level','learnerLevel'],'beginner')),detail:String(tutorPrefs.detail||read(['artha-detail','detail'],'standard')),dataPermissions:context};
}

export function detectArthaPilotIntent(request:string):ArthaPilotRoute {
  const normalized=request.trim();
  if(!normalized)return {intent:'ambiguous',destination:null,workspaceLabel:'ArthaPilot',status:'Choose an action to begin',requiresPersonalContext:false,allowedContext:[],clarification:'What would you like to understand, plan, learn, or verify?'};
  let best:(typeof patterns)[number]|null=null;let bestScore=0;
  for(const pattern of patterns){const hits=normalized.match(pattern.terms)?.length??0;const score=hits*pattern.weight;if(score>bestScore){best=pattern;bestScore=score;}}
  if(best){const pattern=best;const requiresPersonalContext=pattern.intent==='finance'||pattern.intent==='calculation'||pattern.intent==='future';const allowedContext=requiresPersonalContext?['income','expenses','budgets','emis','goals']:[];return {intent:pattern.intent,destination:pattern.destination,workspaceLabel:pattern.label,status:pattern.status,requiresPersonalContext,allowedContext};}
  return {intent:'ambiguous',destination:null,workspaceLabel:'ArthaPilot',status:'Choose an available action',requiresPersonalContext:false,allowedContext:[],clarification:'Would you like to plan money, learn, verify an answer, explore markets, or model a future scenario?'};
}

export function createArthaPilotHandoff(request:string):ArthaPilotHandoff|null {
  const route=detectArthaPilotIntent(request); if(!route.destination)return null; const context=readArthaPilotContext();
  const handoff:ArthaPilotHandoff={request:request.trim(),intent:route.intent,destination:route.destination,workspaceLabel:route.workspaceLabel,context,createdAt:new Date().toISOString()};
  if(typeof window!=='undefined'){window.sessionStorage.setItem(ARTHA_PILOT_HANDOFF_KEY,JSON.stringify(handoff));let recent:unknown[]=[];try{recent=JSON.parse(window.localStorage.getItem(ARTHA_PILOT_RECENT_KEY)||'[]');}catch{}const next=Array.isArray(recent)?[handoff,...recent].slice(0,8):[handoff];window.localStorage.setItem(ARTHA_PILOT_RECENT_KEY,JSON.stringify(next));}
  return handoff;
}

export function canUsePersonalContext(route:ArthaPilotRoute,context=readArthaPilotContext()):boolean { if(!route.requiresPersonalContext)return true; return route.allowedContext.some(key=>context.dataPermissions[key as keyof AiDataContextPreferences]===true); }
export function contextGuidance(route:ArthaPilotRoute,context=readArthaPilotContext()):string|null { if(!route.requiresPersonalContext||canUsePersonalContext(route,context))return null; if(route.intent==='finance'&&!context.dataPermissions.expenses)return 'Enable expense context or add expenses first.'; if(route.intent==='calculation'&&!context.dataPermissions.emis)return 'Enable EMI context to use existing loan records, or enter the loan details in EMI Manager.'; if(route.intent==='future'&&!context.dataPermissions.goals)return 'Enable goal context or set a target before using personal future scenarios.'; return 'Personal data context is not enabled for this request. You can continue with information you enter manually.'; }
