import React, { useState } from 'react';
import { AlertCircle, BookMarked, Calculator, Globe2, Sparkles } from 'lucide-react';
import { CalculationResultPanel } from './CalculationResultPanel';
import { CalculatorTab, ScenarioAssistantPanel, ScenarioCurrency, ScenarioProfile } from './ScenarioAssistantPanel';

const INPUT_CLASS = 'w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-interactive';
const CURRENCY_SYMBOL: Record<ScenarioCurrency, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
const ENDPOINTS: Record<CalculatorTab, string> = {
  compound: 'compound-interest',
  'quick-ratio': 'quick-ratio',
  cagr: 'cagr',
  'break-even': 'break-even',
  dti: 'dti',
};

export const ScenariosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CalculatorTab>('compound');
  const [profile, setProfile] = useState<ScenarioProfile>('US');
  const [currency, setCurrency] = useState<ScenarioCurrency>('USD');
  const [companySymbol, setCompanySymbol] = useState('');
  const [useExternalContext, setUseExternalContext] = useState(true);

  const [principal, setPrincipal] = useState(10000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(5);
  const [monthlyContribution, setMonthlyContribution] = useState(200);
  const [compoundingFrequency, setCompoundingFrequency] = useState(12);

  const [cash, setCash] = useState(50000);
  const [securities, setSecurities] = useState(20000);
  const [receivables, setReceivables] = useState(15000);
  const [liabilities, setLiabilities] = useState(40000);

  const [initialValue, setInitialValue] = useState(50000);
  const [finalValue, setFinalValue] = useState(100000);
  const [cagrYears, setCagrYears] = useState(5);

  const [fixedCosts, setFixedCosts] = useState(120000);
  const [pricePerUnit, setPricePerUnit] = useState(100);
  const [varCostPerUnit, setVarCostPerUnit] = useState(60);

  const [monthlyIncome, setMonthlyIncome] = useState(8000);
  const [monthlyDebt, setMonthlyDebt] = useState(2400);

  const [calcResult, setCalcResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputsFor = (tab = activeTab): Record<string, number> => {
    if (tab === 'compound') return { principal, annualRatePercent: rate, years, monthlyContribution, compoundingFrequencyPerYear: compoundingFrequency };
    if (tab === 'quick-ratio') return { cash, marketableSecurities: securities, receivables, currentLiabilities: liabilities };
    if (tab === 'cagr') return { initialValue, finalValue, years: cagrYears };
    if (tab === 'break-even') return { fixedCosts, pricePerUnit, variableCostPerUnit: varCostPerUnit };
    return { monthlyGrossIncome: monthlyIncome, monthlyDebtPayments: monthlyDebt };
  };

  const switchTab = (tab: CalculatorTab) => {
    setActiveTab(tab);
    setCalcResult(null);
    setError(null);
  };

  const runCalculator = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/${ENDPOINTS[activeTab]}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputsFor()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Calculation failed.');
      setCalcResult(data as Record<string, unknown>);
    } catch (err) {
      setCalcResult(null);
      setError(err instanceof Error ? err.message : 'Validation error.');
    } finally {
      setLoading(false);
    }
  };

  const symbol = CURRENCY_SYMBOL[currency];
  const companyContextRelevant = activeTab === 'quick-ratio' || activeTab === 'cagr' || activeTab === 'break-even';

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="space-y-5 rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-success-fill bg-success-soft p-3 text-success"><BookMarked className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold text-ink">Financial Scenario & Calculation Studio</h1>
              <p className="text-xs text-secondary">Run server-verified Decimal.js calculations, then ask ArthaMind to explain the exact result with optional connected external context.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-wider">
            <span className="rounded-full border border-success-fill/25 bg-success-soft px-2.5 py-1 text-success">Decimal.js deterministic</span>
            <span className="rounded-full border border-interactive bg-interactive-soft px-2.5 py-1 text-interactive">ArthaMind analysis</span>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-line bg-canvas p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] text-secondary">Profile / data region
            <select value={profile} onChange={(event) => setProfile(event.target.value as ScenarioProfile)} className={`${INPUT_CLASS} mt-1`}>
              <option value="US">United States</option><option value="India">India</option><option value="Global">Global</option>
            </select>
          </label>
          <label className="text-[11px] text-secondary">Display currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value as ScenarioCurrency)} className={`${INPUT_CLASS} mt-1`}>
              <option value="USD">USD ($)</option><option value="INR">INR (₹)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option>
            </select>
          </label>
          {companyContextRelevant ? <label className="text-[11px] text-secondary">Optional company symbol for connected context
            <input value={companySymbol} onChange={(event) => setCompanySymbol(event.target.value)} maxLength={20} placeholder="AAPL or RELIANCE.NS" className={`${INPUT_CLASS} mt-1 uppercase`} />
          </label> : <div className="text-[11px] leading-5 text-secondary"><div className="mb-1 font-bold text-ink">External context</div>Official macro observations can be supplied separately to ArthaMind. They never replace the rate, income, debt, or other inputs you enter.</div>}
          <label className="flex items-center gap-2 self-end rounded-xl border border-line bg-surface px-3 py-2.5 text-[11px] font-semibold text-secondary">
            <input type="checkbox" checked={useExternalContext} onChange={(event) => setUseExternalContext(event.target.checked)} className="h-4 w-4 accent-current" />
            <Globe2 className="h-4 w-4 text-interactive" /> Use connected provider context
          </label>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-line pb-4 pt-1">
          {([
            ['compound', 'Compound Interest'],
            ['quick-ratio', 'Quick Ratio'],
            ['cagr', 'CAGR'],
            ['break-even', 'Break-Even Point'],
            ['dti', 'Debt-to-Income (DTI)'],
          ] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => switchTab(tab)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeTab === tab ? 'bg-interactive-soft text-interactive' : 'bg-hover text-secondary'}`}>{label}</button>)}
        </div>

        <div className="space-y-4 pt-1">
          {activeTab === 'compound' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <NumberField label={`Principal (${symbol})`} value={principal} onChange={setPrincipal} min={0} />
            <NumberField label="Annual Interest Rate (%)" value={rate} onChange={setRate} min={0} step={0.01} />
            <NumberField label="Time Horizon (Years)" value={years} onChange={setYears} min={0.01} step={0.25} />
            <NumberField label={`Monthly Deposit (${symbol})`} value={monthlyContribution} onChange={setMonthlyContribution} min={0} />
            <label className="text-[11px] text-secondary">Compounding frequency
              <select value={compoundingFrequency} onChange={(event) => setCompoundingFrequency(Number(event.target.value))} className={`${INPUT_CLASS} mt-1`}><option value={1}>Annual</option><option value={4}>Quarterly</option><option value={12}>Monthly</option><option value={365}>Daily</option></select>
            </label>
          </div>}

          {activeTab === 'quick-ratio' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label={`Cash (${symbol})`} value={cash} onChange={setCash} min={0} />
            <NumberField label={`Marketable Securities (${symbol})`} value={securities} onChange={setSecurities} min={0} />
            <NumberField label={`Receivables (${symbol})`} value={receivables} onChange={setReceivables} min={0} />
            <NumberField label={`Current Liabilities (${symbol})`} value={liabilities} onChange={setLiabilities} min={0.01} />
          </div>}

          {activeTab === 'cagr' && <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label={`Initial Value (${symbol})`} value={initialValue} onChange={setInitialValue} min={0.01} />
            <NumberField label={`Final Value (${symbol})`} value={finalValue} onChange={setFinalValue} min={0.01} />
            <NumberField label="Years" value={cagrYears} onChange={setCagrYears} min={0.01} step={0.25} />
          </div>}

          {activeTab === 'break-even' && <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label={`Total Fixed Costs (${symbol})`} value={fixedCosts} onChange={setFixedCosts} min={0} />
            <NumberField label={`Price Per Unit (${symbol})`} value={pricePerUnit} onChange={setPricePerUnit} min={0.01} />
            <NumberField label={`Variable Cost Per Unit (${symbol})`} value={varCostPerUnit} onChange={setVarCostPerUnit} min={0} />
          </div>}

          {activeTab === 'dti' && <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label={`Monthly Gross Income (${symbol})`} value={monthlyIncome} onChange={setMonthlyIncome} min={0.01} />
            <NumberField label={`Monthly Debt Payments (${symbol})`} value={monthlyDebt} onChange={setMonthlyDebt} min={0} />
          </div>}

          <button type="button" onClick={() => void runCalculator()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-bold text-brand-foreground transition-colors hover:bg-brand-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas">
            <Calculator className="h-4 w-4" /> {loading ? 'Calculating…' : 'Calculate Deterministic Result'}
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-2xl border border-danger bg-danger-soft/80 p-4 text-xs text-danger"><AlertCircle className="h-4 w-4 shrink-0" /><span>Calculation error: {error}</span></div>}

      {calcResult && <CalculationResultPanel activeTab={activeTab} result={calcResult} currency={currency} />}

      <div className="flex items-center gap-2 px-1 text-xs font-bold text-interactive"><Sparkles className="h-4 w-4" /> ArthaMind is available for every calculator and recalculates the current inputs on the server before analysis.</div>
      <ScenarioAssistantPanel
        key={activeTab}
        activeTab={activeTab}
        inputs={inputsFor()}
        profile={profile}
        currency={currency}
        companySymbol={companyContextRelevant ? companySymbol : undefined}
        useExternalContext={useExternalContext}
        hasVerifiedResult={Boolean(calcResult)}
        onVerifiedResult={setCalcResult}
      />
    </div>
  );
};

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void; min?: number; step?: number }> = ({ label, value, onChange, min, step }) => (
  <label className="text-[11px] text-secondary">{label}<input type="number" value={value} min={min} step={step || 1} onChange={(event) => onChange(Number(event.target.value))} className={`${INPUT_CLASS} mt-1`} /></label>
);
