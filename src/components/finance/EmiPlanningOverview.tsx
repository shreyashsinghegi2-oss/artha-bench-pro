import React, { useMemo } from 'react';
import Decimal from 'decimal.js';
import { CalendarClock, Database, Gauge, ShieldCheck, WalletCards } from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';
import { loadIncomeSources, monthlyEquivalent } from '../../services/incomeStorage';
import { EmiRecord, loadEmiPlanning } from '../../services/emiStorage';
import { currentMonthKey, expensesForMonth, formatINR, loadExpenses, totalExpenses } from '../../services/personalFinanceStorage';
import { loadEmiCandidates, loadEmiDocuments } from '../../services/emiCentre';

type Props = { records: EmiRecord[]; onNavigate: (destination: AppNavigationDestination) => void };

type Factor = { label: string; score: number | null; weight: number; evidence: string; limitation?: string };
const clamp=(value:number)=>Math.max(0,Math.min(100,value));
const round=(value:number)=>Math.round(value*10)/10;

export const EmiPlanningOverview: React.FC<Props> = ({ records, onNavigate }) => {
  const snapshot = useMemo(() => {
    const planning=loadEmiPlanning();
    const sources=loadIncomeSources().filter((source)=>source.currency.toUpperCase()==='INR');
    const recurring=sources.filter((source)=>source.frequency!=='One-time');
    const recurringMonthly=recurring.reduce((sum,source)=>new Decimal(sum).plus(monthlyEquivalent(source)).toNumber(),0);
    const irregular=sources.filter((source)=>source.frequency==='One-time');
    const cutoff=new Date();cutoff.setUTCMonth(cutoff.getUTCMonth()-planning.incomeWindow);
    const irregularRows=irregular.filter((source)=>source.startDate>=cutoff.toISOString().slice(0,10));
    const irregularAverage=irregularRows.reduce((sum,source)=>new Decimal(sum).plus(source.amount).toNumber(),0)/planning.incomeWindow;
    const calculatedIncome=recurringMonthly>0?recurringMonthly:irregularRows.length?irregularAverage:0;
    const income=planning.manualIncomeOverride??calculatedIncome;
    const incomeSource=planning.manualIncomeOverride!=null?'planning override':'saved records';
    const active=records.filter((record)=>record.status==='active');
    const monthlyEmi=active.reduce((sum,record)=>new Decimal(sum).plus(record.emiAmount??0).toNumber(),0);
    const ratio=income>0?round(new Decimal(monthlyEmi).div(income).times(100).toNumber()):null;
    const now=new Date();const today=now.toISOString().slice(0,10);const d30=new Date(now.getTime()+30*86400000).toISOString().slice(0,10);const d8=new Date(now.getTime()+8*86400000).toISOString().slice(0,10);
    const upcoming30Rows=active.filter((record)=>record.nextDueDate&&record.nextDueDate>=today&&record.nextDueDate<=d30);
    const upcoming30=upcoming30Rows.reduce((sum,record)=>new Decimal(sum).plus(record.emiAmount??0).toNumber(),0);
    const dueCluster=active.filter((record)=>record.nextDueDate&&record.nextDueDate>=today&&record.nextDueDate<=d8);
    const expenses=totalExpenses(expensesForMonth(loadExpenses(),currentMonthKey()));
    const cushion=income>0?new Decimal(income).minus(expenses).minus(monthlyEmi).toNumber():null;
    const unsecuredTypes=new Set(['Personal loan','Business loan','Credit-card EMI','Buy Now Pay Later / Pay Later','Consumer durable / appliance loan']);
    const unsecured=active.filter((record)=>unsecuredTypes.has(record.loanType)).reduce((sum,record)=>new Decimal(sum).plus(record.emiAmount??0).toNumber(),0);
    const unsecuredShare=monthlyEmi>0?round(new Decimal(unsecured).div(monthlyEmi).times(100).toNumber()):null;
    const payments=records.flatMap((record)=>record.payments);
    const onTime=payments.filter((payment)=>payment.paidAt.slice(0,10)<=payment.dueDate).length;
    const repaymentConsistency=payments.length?round(onTime/payments.length*100):null;
    const fieldCoverage=active.length?round(active.reduce((sum,record)=>sum+[record.emiAmount,record.nextDueDate,record.lender,record.remainingInstallments,record.annualInterestRate,record.outstandingBalance].filter((value)=>value!==null&&value!=='').length/6,0)/active.length*100):null;
    const factors:Factor[]=[
      {label:'EMI-to-income burden',score:ratio==null?null:clamp(100-(ratio/50)*100),weight:30,evidence:ratio==null?'Income context missing':`${ratio}% of selected income context`,limitation:'Internal planning ratio only; not lender affordability.'},
      {label:'Near-term due-date concentration',score:active.length?clamp(100-(dueCluster.length/Math.max(1,active.length))*70):null,weight:20,evidence:`${dueCluster.length} of ${active.length} active commitments due within 8 days`},
      {label:'Emergency-buffer coverage',score:null,weight:15,evidence:'Verified emergency-fund balance is not stored in EMI Manager',limitation:'Factor omitted rather than inventing a bank/savings balance.'},
      {label:'Repayment consistency',score:repaymentConsistency,weight:15,evidence:payments.length?`${onTime}/${payments.length} user-confirmed payment records were recorded on/before due date`:'No user-confirmed payment history yet',limitation:'Only explicit confirmed payment records are used; missing payments are not treated as missed.'},
      {label:'Unsecured-debt share',score:unsecuredShare==null?null:clamp(100-unsecuredShare),weight:10,evidence:unsecuredShare==null?'No recorded EMI amount mix available':`${unsecuredShare}% of recorded monthly EMI amount is in unsecured-category records`,limitation:'Category classification is descriptive and not a credit-risk assessment.'},
      {label:'Missing / unverified information',score:fieldCoverage,weight:10,evidence:fieldCoverage==null?'No active EMI records':`${fieldCoverage}% core field coverage across active EMI records`},
    ];
    const available=factors.filter((factor)=>factor.score!=null);
    const totalWeight=available.reduce((sum,factor)=>sum+factor.weight,0);
    const planningScore=income>0&&active.length&&totalWeight>0?round(available.reduce((sum,factor)=>sum+(factor.score??0)*factor.weight,0)/totalWeight):null;
    return {planning,income,incomeSource,active,monthlyEmi,ratio,upcoming30Rows,upcoming30,dueCluster,expenses,cushion,factors,planningScore,fieldCoverage,documents:loadEmiDocuments().length,pendingCandidates:loadEmiCandidates().filter((item)=>item.state==='needs_review').length};
  }, [records]);

  return <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="emi-planning-overview-title"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[.14em] text-interactive">EMI Intelligence Overview</div><h2 id="emi-planning-overview-title" className="mt-1 text-xl font-black text-ink">Planning signals from confirmed workspace records</h2><p className="mt-1 text-[10px] leading-5 text-secondary">Values remain descriptive and source-linked. No card is a loan approval, credit score, lender affordability decision or repayment prediction.</p></div><span className="rounded-full border border-line bg-canvas px-3 py-1.5 text-[9px] font-black text-secondary">Income source: {snapshot.incomeSource}</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Card icon={Gauge} label="ArthaBench EMI Health Score — planning indicator" value={snapshot.planningScore==null?'Data needed':`${snapshot.planningScore}/100`} note={snapshot.planningScore==null?'Add income and at least one confirmed EMI to calculate your planning score.':`Weighted from ${snapshot.factors.filter((factor)=>factor.score!=null).length}/${snapshot.factors.length} evidence factors; missing factors are omitted, not guessed.`}><details className="mt-3 text-[9px] leading-4 text-secondary"><summary className="cursor-pointer font-black text-ink">How this is calculated</summary><div className="mt-2 space-y-1">{snapshot.factors.map((factor)=><div key={factor.label}>• {factor.label}: {factor.score==null?'Data needed':`${factor.score}/100`} · {factor.evidence}{factor.limitation?` · ${factor.limitation}`:''}</div>)}</div></details></Card>
      <Card icon={WalletCards} label="EMI-to-Income Ratio" value={snapshot.ratio==null?'Data needed':`${snapshot.ratio}%`} note={snapshot.ratio==null?'Income is missing or zero; a ratio is not calculated.':`${formatINR(snapshot.monthlyEmi)} confirmed monthly EMI / ${formatINR(snapshot.income)} ${snapshot.incomeSource}.`}><button onClick={()=>onNavigate('income')} className="mt-3 text-[9px] font-black text-interactive">Manage income</button></Card>
      <Card icon={CalendarClock} label="Next 30 Days Commitment" value={formatINR(snapshot.upcoming30)} note={`${snapshot.upcoming30Rows.length} recorded active payment${snapshot.upcoming30Rows.length===1?'':'s'} in the next 30 days${snapshot.upcoming30Rows[0]?.nextDueDate?` · earliest ${snapshot.upcoming30Rows.map((row)=>row.nextDueDate).sort()[0]}`:''}. Detected/unconfirmed candidates are excluded.`} />
      <Card icon={ShieldCheck} label="Cash-Flow Cushion" value={snapshot.cushion==null?'Partial data':formatINR(snapshot.cushion)} note={snapshot.cushion==null?'Recorded income is needed.':`${formatINR(snapshot.income)} income − ${formatINR(snapshot.expenses)} all recorded current-month expenses − ${formatINR(snapshot.monthlyEmi)} active EMI. Essential/non-essential classification is not inferred.`} />
      <Card icon={CalendarClock} label="Due-Date Concentration" value={snapshot.dueCluster.length?`${snapshot.dueCluster.length} within 8 days`:'No near cluster recorded'} note={snapshot.dueCluster.length?`${snapshot.dueCluster.map((row)=>row.name).join(' · ')}. Review the EMI Calendar for dates and payment states.`:'Based on currently recorded next due dates only.'} />
      <Card icon={Database} label="Data Readiness" value={snapshot.fieldCoverage==null?'Data needed':`${snapshot.fieldCoverage}% EMI field coverage`} note={`Income ${snapshot.income>0?'available':'missing'} · confirmed active EMIs ${snapshot.active.length} · imported documents ${snapshot.documents} · detected items awaiting review ${snapshot.pendingCandidates}. Connected account: unavailable in this build.`} />
    </div>
  </section>;
};

const Card:React.FC<React.PropsWithChildren<{icon:React.ComponentType<{className?:string}>;label:string;value:string;note:string}>>=({icon:Icon,label,value,note,children})=><article className="rounded-2xl border border-line bg-canvas p-4"><Icon className="h-4 w-4 text-interactive"/><div className="mt-3 text-[8px] font-black uppercase tracking-wider text-secondary">{label}</div><div className="mt-1 text-lg font-black text-ink">{value}</div><p className="mt-1 text-[9px] leading-4 text-secondary">{note}</p>{children}</article>;
