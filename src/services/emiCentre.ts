import Decimal from 'decimal.js';
import { calculateEmiPlan, EmiDraft, EmiRecord, saveEmiDraft } from './emiStorage';

export type EmiDetectionState = 'needs_review' | 'confirmed' | 'rejected' | 'ignored';
export type EmiConfidence = 'High' | 'Medium' | 'Low';
export type EmiDetectionCandidate = {
  id: string;
  merchant: string;
  amount: number;
  frequency: 'monthly' | 'irregular' | 'unclear';
  dates: string[];
  sourceLabel: string;
  sourceReference: string;
  confidence: EmiConfidence;
  reason: string;
  state: EmiDetectionState;
  createdAt: string;
  updatedAt: string;
};
export type EmiDocument = {
  id: string;
  fileName: string;
  sourceType: 'bank_statement' | 'loan_statement' | 'repayment_schedule';
  mimeType: string;
  uploadedAt: string;
  extractionStatus: 'review_ready' | 'uploaded_extraction_unavailable' | 'failed';
  candidateCount: number;
  dateRange: string | null;
};
export type EmiAuditEntry = { id: string; event: string; entityId: string | null; sourceReference: string | null; at: string; details: string };
export type EmiReminderPreference = { emiId: string; enabled: boolean; offsets: number[]; overdue: boolean; permission: NotificationPermission | 'unsupported'; updatedAt: string };

const CANDIDATE_KEY = 'arthabench_emi_detection_candidates_v1';
const DOCUMENT_KEY = 'arthabench_emi_documents_v1';
const AUDIT_KEY = 'arthabench_emi_audit_v1';
const REMINDER_KEY = 'arthabench_emi_reminders_v1';

function readArray<T>(key: string): T[] { if (typeof window === 'undefined') return []; try { const parsed = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function writeArray<T>(key: string, rows: T[]): void { if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(rows)); }

export const loadEmiCandidates = () => readArray<EmiDetectionCandidate>(CANDIDATE_KEY);
export const saveEmiCandidates = (rows: EmiDetectionCandidate[]) => writeArray(CANDIDATE_KEY, rows);
export const loadEmiDocuments = () => readArray<EmiDocument>(DOCUMENT_KEY);
export const saveEmiDocuments = (rows: EmiDocument[]) => writeArray(DOCUMENT_KEY, rows);
export const loadEmiAudit = () => readArray<EmiAuditEntry>(AUDIT_KEY);
export function appendEmiAudit(entry: Omit<EmiAuditEntry, 'id' | 'at'>): void { const rows = loadEmiAudit(); writeArray(AUDIT_KEY, [{ ...entry, id: crypto.randomUUID(), at: new Date().toISOString() }, ...rows].slice(0, 250)); }
export const loadEmiReminders = () => readArray<EmiReminderPreference>(REMINDER_KEY);
export function saveEmiReminder(preference: EmiReminderPreference): void { const rows = loadEmiReminders().filter((row) => row.emiId !== preference.emiId); writeArray(REMINDER_KEY, [preference, ...rows]); appendEmiAudit({ event: 'reminder_preference_updated', entityId: preference.emiId, sourceReference: null, details: `Enabled=${preference.enabled}; offsets=${preference.offsets.join(',')}; overdue=${preference.overdue}; permission=${preference.permission}` }); }

function csvLine(line: string): string[] { const values:string[]=[]; let value=''; let quoted=false; for(let index=0; index<line.length; index+=1){const char=line[index]; if(char==='"'){if(quoted&&line[index+1]==='"'){value+='"';index+=1}else quoted=!quoted;}else if(char===','&&!quoted){values.push(value.trim());value='';}else value+=char;} values.push(value.trim()); return values; }

export function detectEmiCandidatesFromCsv(text: string, fileName: string): { candidates: EmiDetectionCandidate[]; dateRange: string | null } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { candidates: [], dateRange: null };
  const headers = csvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (names:string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = find(['date','transactiondate','valuedate','debitdate']);
  const descriptionIndex = find(['description','narration','merchant','details','particulars']);
  const amountIndex = find(['amount','debit','debitamount','withdrawal']);
  if (dateIndex < 0 || descriptionIndex < 0 || amountIndex < 0) return { candidates: [], dateRange: null };
  const rows = lines.slice(1).flatMap((line) => { const cells=csvLine(line); const amount=Math.abs(Number(String(cells[amountIndex]||'').replace(/[,₹ ]/g,''))); const date=String(cells[dateIndex]||'').trim(); const description=String(cells[descriptionIndex]||'').trim(); if(!description||!date||!Number.isFinite(amount)||amount<=0)return[]; return [{ date, description, amount }]; });
  const bySignature = new Map<string, typeof rows>();
  rows.forEach((row) => { const normalized = row.description.toLowerCase().replace(/\d+/g,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim().slice(0,42); const amountBand = Math.round(row.amount / Math.max(10, row.amount * 0.01)); const key=`${normalized}:${amountBand}`; bySignature.set(key,[...(bySignature.get(key)||[]),row]); });
  const existing = loadEmiCandidates();
  const candidates: EmiDetectionCandidate[] = [];
  for (const grouped of bySignature.values()) {
    if (grouped.length < 2) continue;
    const ordered=[...grouped].sort((a,b)=>a.date.localeCompare(b.date));
    const amounts=ordered.map((row)=>row.amount); const average=amounts.reduce((sum,value)=>sum+value,0)/amounts.length;
    const spread=Math.max(...amounts)-Math.min(...amounts); const stable=average>0&&spread/average<=0.05;
    const dayValues=ordered.map((row)=>Number(row.date.slice(-2))).filter(Number.isFinite); const daySpread=dayValues.length?Math.max(...dayValues)-Math.min(...dayValues):99;
    const monthly=stable&&daySpread<=7&&ordered.length>=3;
    const confidence: EmiConfidence = monthly ? 'High' : stable ? 'Medium' : 'Low';
    const signature=`${fileName}:${ordered[0].description}:${Math.round(average)}`;
    if(existing.some((item)=>item.sourceReference===signature)) continue;
    candidates.push({ id:crypto.randomUUID(), merchant:ordered[0].description, amount:Math.round(average*100)/100, frequency:monthly?'monthly':stable?'irregular':'unclear', dates:ordered.slice(-6).map((row)=>row.date), sourceLabel:'Uploaded CSV', sourceReference:signature, confidence, reason:monthly?`Similar debit amount appeared around the same date across ${ordered.length} recorded transactions.`:`Repeated similar debit amount found ${ordered.length} times; cadence needs review.`, state:'needs_review', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  }
  const dates=rows.map((row)=>row.date).filter(Boolean).sort();
  return { candidates, dateRange: dates.length ? `${dates[0]} to ${dates.at(-1)}` : null };
}

export function stageEmiDocument(file: File, sourceType: EmiDocument['sourceType'], candidateCount: number, dateRange: string | null, extractionStatus: EmiDocument['extractionStatus']): EmiDocument {
  const doc:EmiDocument={id:crypto.randomUUID(),fileName:file.name,sourceType,mimeType:file.type||'unknown',uploadedAt:new Date().toISOString(),extractionStatus,candidateCount,dateRange};
  saveEmiDocuments([doc,...loadEmiDocuments()].slice(0,50));
  appendEmiAudit({event:'document_staged',entityId:doc.id,sourceReference:file.name,details:`${sourceType}; ${extractionStatus}; candidates=${candidateCount}`});
  return doc;
}

export function updateCandidateDecision(candidate: EmiDetectionCandidate, state: EmiDetectionState): EmiDetectionCandidate {
  const updated={...candidate,state,updatedAt:new Date().toISOString()};
  saveEmiCandidates(loadEmiCandidates().map((row)=>row.id===candidate.id?updated:row));
  appendEmiAudit({event:`candidate_${state}`,entityId:candidate.id,sourceReference:candidate.sourceReference,details:`${candidate.merchant}; ₹${candidate.amount}; confidence=${candidate.confidence}`});
  return updated;
}

export function draftFromCandidate(candidate: EmiDetectionCandidate): EmiDraft {
  return { name:candidate.merchant,lender:candidate.merchant,loanType:'Other',originalLoanAmount:null,outstandingBalance:null,annualInterestRate:null,emiAmount:candidate.amount,startDate:'',nextDueDate:'',tenureMonths:null,remainingInstallments:null,paymentFrequency:'monthly',notes:`Detected from ${candidate.sourceLabel} · review required · ${candidate.sourceReference}`,status:'active',typeDetails:{} };
}

export function confirmCandidateAsRecord(candidate: EmiDetectionCandidate, reviewedDraft: EmiDraft): EmiRecord {
  const saved=saveEmiDraft(reviewedDraft);
  updateCandidateDecision(candidate,'confirmed');
  appendEmiAudit({event:'emi_confirmed_from_detection',entityId:saved.id,sourceReference:candidate.sourceReference,details:'User reviewed and confirmed detected commitment before save.'});
  return saved;
}

export type RepaymentScenarioInput = { prepaymentAmount:number; processingFee:number; emiIncrease:number; strategy:'reduce-tenure'|'reduce-emi'|'compare-both' };
export type RepaymentScenarioResult = { baselineEmi:number; baselineTenure:number; baselineInterest:number; revisedEmi:number|null; revisedTenure:number|null; revisedInterest:number|null; interestDifference:number|null; processingFee:number; finalPaymentMonth:string|null; assumptions:string[] };

function monthsToPay(principal:number, annualRate:number, emi:number): { months:number; interest:number } | null { if(principal<=0)return{months:0,interest:0}; if(emi<=0)return null; let balance=new Decimal(principal); const rate=new Decimal(annualRate).div(1200); let months=0; let interestTotal=new Decimal(0); while(balance.gt(0)&&months<600){const interest=balance.times(rate); const principalPart=new Decimal(emi).minus(interest); if(principalPart.lte(0))return null; balance=Decimal.max(0,balance.minus(principalPart)); interestTotal=interestTotal.plus(interest); months+=1;} if(balance.gt(0))return null; return{months,interest:interestTotal.toDecimalPlaces(2).toNumber()}; }
function addMonthsIso(count:number):string { const date=new Date(); date.setUTCMonth(date.getUTCMonth()+count); return date.toISOString().slice(0,7); }

export function calculateRepaymentScenario(record: EmiRecord, input: RepaymentScenarioInput): RepaymentScenarioResult | null {
  if(record.outstandingBalance==null||record.annualInterestRate==null||record.remainingInstallments==null||record.emiAmount==null)return null;
  const balance=Math.max(0,record.outstandingBalance); const prepayment=Math.min(balance,Math.max(0,input.prepaymentAmount)); const revisedPrincipal=new Decimal(balance).minus(prepayment).toNumber();
  const baselinePlan=calculateEmiPlan({principal:balance,annualRate:record.annualInterestRate,tenureMonths:Math.max(1,record.remainingInstallments)}); if(!baselinePlan)return null;
  let revisedEmi:number|null=null,revisedTenure:number|null=null,revisedInterest:number|null=null;
  if(input.strategy==='reduce-emi'||input.strategy==='compare-both'){const plan=calculateEmiPlan({principal:Math.max(0.01,revisedPrincipal),annualRate:record.annualInterestRate,tenureMonths:Math.max(1,record.remainingInstallments)}); if(plan){revisedEmi=plan.monthlyEmi;revisedTenure=record.remainingInstallments;revisedInterest=plan.totalInterest;}}
  if(input.strategy==='reduce-tenure'){const payment=new Decimal(record.emiAmount).plus(Math.max(0,input.emiIncrease)).toNumber(); const payoff=monthsToPay(revisedPrincipal,record.annualInterestRate,payment); if(payoff){revisedEmi=payment;revisedTenure=payoff.months;revisedInterest=payoff.interest;}}
  const difference=revisedInterest==null?null:new Decimal(baselinePlan.totalInterest).minus(revisedInterest).minus(Math.max(0,input.processingFee)).toDecimalPlaces(2).toNumber();
  return {baselineEmi:record.emiAmount,baselineTenure:record.remainingInstallments,baselineInterest:baselinePlan.totalInterest,revisedEmi,revisedTenure,revisedInterest,interestDifference:difference,processingFee:Math.max(0,input.processingFee),finalPaymentMonth:revisedTenure==null?null:addMonthsIso(revisedTenure),assumptions:['Illustrative scenario','Estimated from saved outstanding balance, annual rate, EMI and remaining tenure','Prepayment/foreclosure rules and fees must be confirmed directly with the lender','Scenario does not overwrite the EMI record']};
}
