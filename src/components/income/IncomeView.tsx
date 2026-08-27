import React, { useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  IndianRupee,
  Lightbulb,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  WalletCards,
} from 'lucide-react';
import {
  createIncomeSource,
  formatCurrency,
  IncomeSource,
  IncomeSourceDraft,
  IncomeType,
  INCOME_TYPES,
  loadIncomeSources,
  monthlyEquivalent,
  saveIncomeSources,
  summarizeIncomeByCurrency,
} from '../../services/incomeStorage';
import { IncomeSourceForm } from './IncomeSourceForm';
import { calculateIndiaTaxEstimate, compareTaxRegimes } from '../../services/indiaTaxEngine';
import {
  createAuditEvent,
  loadTaxWorkspace,
  saveTaxWorkspace,
} from '../../services/taxWorkspaceStorage';
import { TaxWorkspaceState } from '../../types/taxTypes';
import { TaxCreditsPanel } from './tax/TaxCreditsPanel';
import { TaxDashboard } from './tax/TaxDashboard';
import { TaxDeductionsPanel } from './tax/TaxDeductionsPanel';
import { TaxProfileCard } from './tax/TaxProfileCard';

function buildRecommendations(sources: IncomeSource[]): string[] {
  if (!sources.length) {
    return [
      'Start with your most predictable source—usually salary, pension or business drawings.',
      'Add genuine freelance, rental or investment income separately so tax planning stays accurate.',
    ];
  }

  const recommendations: string[] = [];
  const types = new Set(sources.map((source) => source.type));
  const hasPreTaxIncome = sources.some((source) => source.taxStatus === 'Pre-tax');
  const recurringTypes = new Set(
    sources.filter((source) => source.frequency !== 'One-time').map((source) => source.type),
  );

  if (hasPreTaxIncome) {
    recommendations.push('Set aside a tax reserve for pre-tax income; confirm the amount with a qualified tax professional.');
  }
  if (!types.has('Investment Returns')) {
    recommendations.push('If you receive dividends, interest or realised gains, record them as Investment Returns.');
  }
  if (!types.has('Rental')) {
    recommendations.push('Own a let-out property? Add the actual rent received and keep vacancy periods accurate.');
  }
  if (recurringTypes.size === 1) {
    recommendations.push('Your recurring income is concentrated in one category; use goal planning with a conservative buffer.');
  }

  return recommendations.slice(0, 3);
}

const typeIcons = {
  Salary: BriefcaseBusiness,
  Freelance: WalletCards,
  Rental: Building2,
  Business: CircleDollarSign,
  'Investment Returns': IndianRupee,
  Other: CircleDollarSign,
};

export const IncomeView: React.FC = () => {
  const [sources, setSources] = useState<IncomeSource[]>(loadIncomeSources);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | undefined>();
  const [taxWorkspace, setTaxWorkspace] = useState<TaxWorkspaceState>(loadTaxWorkspace);

  const summaries = useMemo(() => summarizeIncomeByCurrency(sources), [sources]);
  const recommendations = useMemo(() => buildRecommendations(sources), [sources]);
  const primarySummary = summaries.find((summary) => summary.currency === 'INR') ?? summaries[0];
  const orderedSources = useMemo(
    () => [...sources].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sources],
  );
  const taxComparison = useMemo(
    () => compareTaxRegimes(sources, taxWorkspace.profile, taxWorkspace.deductions, taxWorkspace.credits),
    [sources, taxWorkspace.profile, taxWorkspace.deductions, taxWorkspace.credits],
  );
  const taxEstimate = useMemo(
    () => calculateIndiaTaxEstimate(sources, taxWorkspace.profile, taxWorkspace.deductions, taxWorkspace.credits),
    [sources, taxWorkspace.profile, taxWorkspace.deductions, taxWorkspace.credits],
  );

  const commitSources = (nextSources: IncomeSource[]) => {
    setSources(nextSources);
    saveIncomeSources(nextSources);
  };

  const commitTaxWorkspace = (nextWorkspace: TaxWorkspaceState, action: string, detail: string) => {
    const withAudit = {
      ...nextWorkspace,
      audit: [createAuditEvent(action, detail), ...nextWorkspace.audit].slice(0, 100),
    };
    setTaxWorkspace(withAudit);
    saveTaxWorkspace(withAudit);
  };

  const openCreateForm = () => {
    setEditingSource(undefined);
    setFormOpen(true);
  };

  const handleSave = (draft: IncomeSourceDraft) => {
    if (editingSource) {
      const updatedSource: IncomeSource = {
        ...editingSource,
        ...draft,
        currency: draft.currency.toUpperCase(),
        tags: [...new Set(draft.tags)],
        updatedAt: new Date().toISOString(),
      };
      commitSources(sources.map((source) => source.id === editingSource.id ? updatedSource : source));
    } else {
      commitSources([createIncomeSource(draft), ...sources]);
    }
    setFormOpen(false);
    setEditingSource(undefined);
    commitTaxWorkspace(taxWorkspace, editingSource ? 'Income source updated' : 'Income source added', draft.description);
  };

  const handleDelete = (source: IncomeSource) => {
    if (!window.confirm(`Delete “${source.description}”? This only removes the device-local copy.`)) return;
    commitSources(sources.filter((item) => item.id !== source.id));
    commitTaxWorkspace(taxWorkspace, 'Income source deleted', source.description);
  };

  const annualByType: Partial<Record<IncomeType, number>> = primarySummary?.byType ?? {};
  const maxTypeAmount = Math.max(1, ...Object.values(annualByType).map((amount) => amount ?? 0));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-7 sm:px-6">
      <section className="overflow-hidden rounded-3xl border border-brand/20 bg-surface shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-brand-hover">ArthaMind · Personal Finance</span>
              <span className="rounded-full border border-line bg-canvas px-3 py-1 text-xs font-semibold text-secondary">Private on this device</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">Income workspace</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
              Build a clean income baseline for future cash-flow, tax, EMI and goal planning—without changing any existing ArthaBench data connection.
            </p>
          </div>
          <button type="button" onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-brand-hover">
            <Plus className="h-4 w-4" /> Add income source
          </button>
        </div>
        <div className="border-t border-brand/10 bg-brand-soft/60 px-5 py-3 text-xs text-secondary sm:px-7">
          MVP storage: this browser only. No bank account, tax portal, or trading account is connected.
        </div>
      </section>

      <section className="grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-5" aria-label="Tax workspace onboarding">
        {['1. Choose FY & profile', '2. Add income', '3. Add deductions', '4. Add tax credits', '5. Review estimate'].map((step, index) => (
          <div key={step} className={`rounded-xl px-3 py-2 text-xs font-bold ${index === 0 || sources.length ? 'bg-brand-soft text-brand-hover' : 'bg-canvas text-secondary'}`}>{step}</div>
        ))}
      </section>

      <TaxProfileCard
        profile={taxWorkspace.profile}
        onChange={(profile) => commitTaxWorkspace({ ...taxWorkspace, profile }, 'Tax profile changed', `${profile.financialYear} · ${profile.taxRegime} regime`)}
      />

      {formOpen ? (
        <IncomeSourceForm
          key={editingSource?.id ?? 'new-income-source'}
          source={editingSource}
          onCancel={() => { setFormOpen(false); setEditingSource(undefined); }}
          onSave={handleSave}
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Income summary">
        {[
          ['Monthly recurring', primarySummary ? formatCurrency(primarySummary.monthlyRecurring, primarySummary.currency) : '₹0', 'Normalized recurring income'],
          ['Annual projection', primarySummary ? formatCurrency(primarySummary.annualProjected, primarySummary.currency) : '₹0', 'Includes one-time income this year'],
          ['Income sources', String(sources.length), `${new Set(sources.map((source) => source.type)).size} categories`],
          ['Currencies', String(summaries.length || 1), summaries.map((summary) => summary.currency).join(' · ') || 'INR default'],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary">{label}</p>
            <p className="mt-2 text-2xl font-black text-ink">{value}</p>
            <p className="mt-1 text-xs text-secondary">{note}</p>
          </div>
        ))}
      </section>

      {summaries.length > 1 ? (
        <section className="rounded-2xl border border-warning-fill/25 bg-warning-soft p-4 text-sm text-warning">
          Currency totals are intentionally kept separate; no live foreign-exchange conversion is applied.
        </section>
      ) : null}

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
        <div className="rounded-3xl border border-line bg-surface shadow-sm">
          <header className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-ink">Income sources</h2>
              <p className="mt-1 text-sm text-secondary">Edit details as your financial situation changes.</p>
            </div>
            <button type="button" onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand/25 bg-brand-soft px-4 py-2 text-sm font-bold text-brand-hover hover:border-brand/50">
              <Plus className="h-4 w-4" /> New source
            </button>
          </header>

          {orderedSources.length ? (
            <div className="divide-y divide-line">
              {orderedSources.map((source) => {
                const Icon = typeIcons[source.type];
                const normalizedMonthly = monthlyEquivalent(source);
                return (
                  <article key={source.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-hover"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-black text-ink">{source.description}</h3>
                          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-secondary">{source.type}</span>
                          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] font-bold text-secondary">{source.taxStatus}</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-ink">
                          {formatCurrency(source.amount, source.currency)} <span className="font-normal text-secondary">· {source.frequency}</span>
                        </p>
                        <p className="mt-1 text-xs text-secondary">
                          {source.startDate}{source.endDate ? ` to ${source.endDate}` : ' onward'}
                          {normalizedMonthly > 0 ? ` · ${formatCurrency(normalizedMonthly, source.currency)}/month normalized` : ''}
                        </p>
                        {source.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{source.tags.map((tag) => <span key={tag} className="rounded-md border border-line px-2 py-0.5 text-[11px] text-secondary">#{tag}</span>)}</div> : null}
                      </div>
                    </div>
                    <div className="flex gap-2 md:justify-end">
                      <button type="button" onClick={() => { setEditingSource(source); setFormOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-bold text-secondary hover:border-interactive/40 hover:text-ink"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                      <button type="button" onClick={() => handleDelete(source)} className="inline-flex items-center gap-1.5 rounded-xl border border-danger/20 px-3 py-2 text-xs font-bold text-danger hover:bg-danger-soft"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-hover"><IndianRupee className="h-6 w-6" /></div>
              <h3 className="mt-4 font-black text-ink">No income sources yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">Add your first source to see recurring monthly and annual projections.</p>
              <button type="button" onClick={openCreateForm} className="mt-4 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover">Add first source</button>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-brand" /><h2 className="font-black text-ink">Smart checks</h2></div>
            <p className="mt-2 text-xs leading-5 text-secondary">Rule-based MVP guidance. It does not change your tax treatment or call an AI provider.</p>
            <ul className="mt-4 space-y-3">
              {recommendations.map((recommendation) => <li key={recommendation} className="flex gap-2 text-sm leading-5 text-secondary"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-premium" /><span>{recommendation}</span></li>)}
            </ul>
          </section>

          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="font-black text-ink">Annual breakdown</h2>
            <p className="mt-1 text-xs text-secondary">{primarySummary?.currency ?? 'INR'} projected by source type</p>
            <div className="mt-4 space-y-3">
              {INCOME_TYPES.map((type) => {
                const amount = annualByType[type] ?? 0;
                if (!amount) return null;
                return (
                  <div key={type}>
                    <div className="flex justify-between gap-3 text-xs"><span className="font-semibold text-ink">{type}</span><span className="font-mono text-secondary">{formatCurrency(amount, primarySummary?.currency ?? 'INR')}</span></div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(6, (amount / maxTypeAmount) * 100)}%` }} /></div>
                  </div>
                );
              })}
              {Object.values(annualByType).every((amount) => !amount) ? <p className="text-sm text-secondary">Add an active source to see the breakdown.</p> : null}
            </div>
          </section>
        </aside>
      </section>

      <TaxDeductionsPanel
        profile={taxWorkspace.profile}
        entries={taxWorkspace.deductions}
        onChange={(deductions) => commitTaxWorkspace({ ...taxWorkspace, deductions }, 'Deductions changed', `${deductions.length} deduction entries`)}
      />

      <TaxCreditsPanel
        credits={taxWorkspace.credits}
        documents={taxWorkspace.documents}
        onCreditsChange={(credits) => commitTaxWorkspace({ ...taxWorkspace, credits }, 'Tax credits changed', `${credits.length} credit entries`)}
        onDocumentsChange={(documents) => commitTaxWorkspace({ ...taxWorkspace, documents }, 'Document status changed', 'Tax evidence checklist updated')}
      />

      <TaxDashboard
        result={taxEstimate}
        comparison={taxComparison}
        profile={taxWorkspace.profile}
        sources={sources}
        workspace={taxWorkspace}
      />
    </div>
  );
};
