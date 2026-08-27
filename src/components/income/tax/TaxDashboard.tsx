import React, { useState } from 'react';
import { CalendarClock, ChevronDown, Download, ExternalLink, FileJson2, Printer, ShieldCheck } from 'lucide-react';
import { getIndiaTaxRules } from '../../../config/taxRules/india';
import { formatCurrency, IncomeSource } from '../../../services/incomeStorage';
import { IndianTaxProfile, TaxCalculationResult, TaxRegimeComparison, TaxWorkspaceState } from '../../../types/taxTypes';

interface Props {
  result: TaxCalculationResult;
  comparison: TaxRegimeComparison;
  profile: IndianTaxProfile;
  sources: IncomeSource[];
  workspace: TaxWorkspaceState;
}

const rupees = (value: string) => formatCurrency(Number(value), 'INR');
const download = (name: string, contents: string, type: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
};

export const TaxDashboard: React.FC<Props> = ({ result, comparison, profile, sources, workspace }) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const rules = getIndiaTaxRules(profile.financialYear);
  const metrics = [
    ['Gross income', result.grossIncome], ['Taxable income', result.taxableIncome], ['Total estimated tax', result.totalTaxLiability],
    ['TDS / TCS credits', String(Number(result.tdsCredit) + Number(result.tcsCredit))], ['Balance payable', result.remainingTaxPayable], ['Estimated refund', result.estimatedRefund],
  ];
  const heads = Object.entries(result.incomeByHead) as Array<[string, string]>;
  const maxHead = Math.max(1, ...heads.map(([, value]) => Math.max(0, Number(value))));
  const exportCsv = () => download(`artha-income-${profile.financialYear}.csv`, ['description,type,frequency,amount,currency,start_date,tax_status', ...sources.map((source) => [source.description, source.type, source.frequency, source.amount, source.currency, source.startDate, source.taxStatus].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))].join('\n'), 'text/csv');
  const exportAudit = () => download(`artha-tax-audit-${profile.financialYear}.json`, JSON.stringify({ profile, result, comparison, workspace }, null, 2), 'application/json');
  const oldTax = Number(comparison.old.totalTaxLiability);
  const newTax = Number(comparison.new.totalTaxLiability);
  const comparisonMax = Math.max(1, oldTax, newTax);

  return (
    <section className="space-y-5 rounded-3xl border border-brand/25 bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="tax-estimate-title">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-brand">Tax dashboard</p><h2 id="tax-estimate-title" className="mt-1 text-2xl font-black text-ink">Tax Estimate · {result.financialYear} / {result.assessmentYear}</h2><p className="mt-1 text-sm text-secondary">{result.selectedRegime === 'new' ? 'New' : 'Old'} regime calculation · confidence {result.confidenceScore}% · rules {result.rulesVersion}</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-bold text-secondary"><Printer className="h-4 w-4" /> Tax estimate PDF</button><button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-bold text-secondary"><Download className="h-4 w-4" /> CSV ledger</button><button type="button" onClick={exportAudit} className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-bold text-secondary"><FileJson2 className="h-4 w-4" /> Audit JSON</button></div>
      </header>

      <p className="rounded-xl border border-warning-fill/30 bg-warning-soft p-3 text-sm font-bold leading-6 text-warning">Estimated tax calculation based on currently configured rules. Verify with official Income Tax Department sources or a qualified CA before filing.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label, value]) => <button type="button" key={label} onClick={() => setBreakdownOpen((open) => !open)} className="rounded-2xl border border-line bg-canvas p-4 text-left hover:border-brand/40"><p className="text-xs font-bold uppercase tracking-wide text-secondary">{label}</p><p className={`mt-2 text-2xl font-black ${label === 'Balance payable' ? 'text-warning' : label === 'Estimated refund' ? 'text-success' : 'text-ink'}`}>{rupees(value)}</p><p className="mt-1 text-[11px] text-secondary">Click for calculation breakdown</p></button>)}</div>

      {breakdownOpen ? <div className="rounded-2xl border border-line bg-canvas p-4"><div className="flex items-center justify-between"><h3 className="font-black text-ink">Calculation breakdown</h3><ChevronDown className="h-4 w-4 text-secondary" /></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{[['Slab-rate tax', result.slabTax], ['Rebate', result.rebate], ['Special-rate tax', result.specialRateTax], ['Surcharge', result.surcharge], ['Health & education cess', result.cess], ['Deductions', result.deductions], ['Advance tax', result.advanceTaxPaid], ['Self-assessment tax', result.selfAssessmentTaxPaid]].map(([label, value]) => <div key={label} className="rounded-xl bg-surface p-3"><p className="text-xs text-secondary">{label}</p><p className="mt-1 font-mono font-bold text-ink">{rupees(value)}</p></div>)}</div></div> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line p-4"><h3 className="font-black text-ink">Income by tax head</h3><div className="mt-4 space-y-3">{heads.map(([head, value]) => <div key={head}><div className="flex justify-between text-xs"><span className="capitalize text-secondary">{head.replace(/([A-Z])/g, ' $1')}</span><span className="font-mono font-bold text-ink">{rupees(value)}</span></div><div className="mt-1 h-2 rounded-full bg-subtle"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, Number(value) / maxHead * 100)}%` }} /></div></div>)}</div></div>
        <div className="rounded-2xl border border-line p-4"><h3 className="font-black text-ink">Old vs new regime</h3><p className="mt-1 text-xs text-secondary">Potentially lower estimated tax: <strong>{comparison.lowerEstimatedRegime === 'same' ? 'Same estimate' : comparison.lowerEstimatedRegime === 'old' ? 'Old regime' : 'New regime'}</strong>. This is not financial advice.</p><div className="mt-4 space-y-4">{[['Old regime', oldTax, 'bg-premium'], ['New regime', newTax, 'bg-brand']].map(([label, amount, color]) => <div key={String(label)}><div className="flex justify-between text-sm"><span className="font-bold text-ink">{label}</span><span className="font-mono">{formatCurrency(Number(amount), 'INR')}</span></div><div className="mt-1.5 h-3 rounded-full bg-subtle"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, Number(amount) / comparisonMax * 100)}%` }} /></div></div>)}</div><p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm font-bold text-brand-hover">Estimated difference: {rupees(comparison.estimatedDifference)}</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line p-4"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand" /><h3 className="font-black text-ink">Advance-tax calendar</h3></div><div className="mt-3 grid grid-cols-2 gap-2">{rules.advanceTaxDueDates.map((item) => <div key={item.date} className="rounded-xl bg-canvas p-3"><p className="font-bold text-ink">{item.date}</p><p className="text-xs text-secondary">{item.cumulativePercent}% cumulative target</p></div>)}</div><p className="mt-3 text-sm text-secondary">Suggested monthly set-aside: <strong className="text-ink">{rupees(result.monthlyTaxSetAside)}</strong> · effective estimated rate {result.effectiveTaxRate}%.</p></div>
        <div className="rounded-2xl border border-line p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /><h3 className="font-black text-ink">Completeness and assumptions</h3></div><div className="mt-3 h-2 rounded-full bg-subtle"><div className="h-full rounded-full bg-brand" style={{ width: `${result.confidenceScore}%` }} /></div><ul className="mt-3 space-y-2 text-xs text-secondary">{result.warnings.slice(0, 6).map((warning) => <li key={warning}>• {warning}</li>)}{!result.warnings.length ? <li>• No major completeness warnings detected.</li> : null}</ul></div>
      </div>

      {result.deductionBreakdown.length ? <div className="overflow-x-auto rounded-2xl border border-line p-4"><h3 className="font-black text-ink">Deduction audit</h3><table className="mt-3 w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-line text-secondary"><th className="py-2">Deduction</th><th>Entered</th><th>Eligible</th><th>Allowed</th><th>Disallowed</th><th>Reason</th></tr></thead><tbody>{result.deductionBreakdown.map((item) => <tr key={item.id} className="border-b border-line/60"><td className="py-3 font-bold text-ink">{item.label}</td><td>{rupees(item.entered)}</td><td>{rupees(item.eligible)}</td><td>{rupees(item.allowed)}</td><td>{rupees(item.disallowed)}</td><td className="max-w-xs text-secondary">{item.reason}</td></tr>)}</tbody></table></div> : null}

      <div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-line p-4"><h3 className="font-black text-ink">What changed?</h3><div className="mt-3 max-h-44 space-y-3 overflow-auto">{workspace.audit.slice(0, 12).map((event) => <div key={event.id} className="border-l-2 border-brand/30 pl-3"><p className="text-sm font-bold text-ink">{event.action}</p><p className="text-xs text-secondary">{event.detail} · {new Date(event.timestamp).toLocaleString('en-IN')}</p></div>)}{!workspace.audit.length ? <p className="text-sm text-secondary">Profile and estimate changes will appear here.</p> : null}</div></div><div className="rounded-2xl border border-line p-4"><h3 className="font-black text-ink">Official rules and limitations</h3><p className="mt-2 text-xs leading-5 text-secondary">Last verified {result.lastVerifiedAt}. This is an educational estimate, not an ITR, legal opinion, or filing service.</p><div className="mt-3 flex flex-wrap gap-2">{result.officialSourceUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-bold text-brand-hover">Official source {index + 1}<ExternalLink className="h-3 w-3" /></a>)}</div></div></div>
    </section>
  );
};
