import React, { useState } from 'react';
import { BookMarked, Calculator, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ScenariosView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'compound' | 'quick-ratio' | 'cagr' | 'break-even' | 'dti'>('compound');

  // Calculator Inputs
  const [principal, setPrincipal] = useState(10000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(5);
  const [monthlyContribution, setMonthlyContribution] = useState(200);

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

  const [calcResult, setCalcResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCalculator = async (endpoint: string, payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Calculation failed');
      setCalcResult(data);
    } catch (err: any) {
      setError(err.message || 'Validation error');
      setCalcResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950 border border-emerald-800 rounded-2xl text-emerald-400">
            <BookMarked className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Financial Scenario & Calculation Studio</h1>
            <p className="text-xs text-slate-400">
              Run deterministic financial calculations verified by the Decimal.js core engine.
            </p>
          </div>
        </div>

        {/* Calculator Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-b border-slate-800 pb-4">
          <button
            onClick={() => { setActiveTab('compound'); setCalcResult(null); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'compound' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            Compound Interest
          </button>
          <button
            onClick={() => { setActiveTab('quick-ratio'); setCalcResult(null); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'quick-ratio' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            Quick Ratio
          </button>
          <button
            onClick={() => { setActiveTab('cagr'); setCalcResult(null); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'cagr' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            CAGR
          </button>
          <button
            onClick={() => { setActiveTab('break-even'); setCalcResult(null); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'break-even' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            Break-Even Point
          </button>
          <button
            onClick={() => { setActiveTab('dti'); setCalcResult(null); setError(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${activeTab === 'dti' ? 'bg-emerald-600 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
          >
            Debt-to-Income (DTI)
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-4 pt-2">
          {activeTab === 'compound' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Principal ($)</label>
                <input type="number" value={principal} onChange={(e) => setPrincipal(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Annual Interest Rate (%)</label>
                <input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Time Horizon (Years)</label>
                <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Monthly Deposit ($)</label>
                <input type="number" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
            </div>
          )}

          {activeTab === 'quick-ratio' && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Cash ($)</label>
                <input type="number" value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Marketable Securities ($)</label>
                <input type="number" value={securities} onChange={(e) => setSecurities(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Receivables ($)</label>
                <input type="number" value={receivables} onChange={(e) => setReceivables(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Current Liabilities ($)</label>
                <input type="number" value={liabilities} onChange={(e) => setLiabilities(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
            </div>
          )}

          {activeTab === 'cagr' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Initial Value ($)</label>
                <input type="number" value={initialValue} onChange={(e) => setInitialValue(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Final Value ($)</label>
                <input type="number" value={finalValue} onChange={(e) => setFinalValue(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Years</label>
                <input type="number" value={cagrYears} onChange={(e) => setCagrYears(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
            </div>
          )}

          {activeTab === 'break-even' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Total Fixed Costs ($)</label>
                <input type="number" value={fixedCosts} onChange={(e) => setFixedCosts(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Price Per Unit ($)</label>
                <input type="number" value={pricePerUnit} onChange={(e) => setPricePerUnit(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Variable Cost Per Unit ($)</label>
                <input type="number" value={varCostPerUnit} onChange={(e) => setVarCostPerUnit(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
            </div>
          )}

          {activeTab === 'dti' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Monthly Gross Income ($)</label>
                <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Monthly Debt Payments ($)</label>
                <input type="number" value={monthlyDebt} onChange={(e) => setMonthlyDebt(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200" />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (activeTab === 'compound') runCalculator('compound-interest', { principal, annualRatePercent: rate, years, monthlyContribution });
              if (activeTab === 'quick-ratio') runCalculator('quick-ratio', { cash, marketableSecurities: securities, receivables, currentLiabilities: liabilities });
              if (activeTab === 'cagr') runCalculator('cagr', { initialValue, finalValue, years: cagrYears });
              if (activeTab === 'break-even') runCalculator('break-even', { fixedCosts, pricePerUnit, variableCostPerUnit: varCostPerUnit });
              if (activeTab === 'dti') runCalculator('dti', { monthlyGrossIncome: monthlyIncome, monthlyDebtPayments: monthlyDebt });
            }}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            <span>Calculate Deterministic Result</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Validation Error: {error}</span>
        </div>
      )}

      {calcResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Deterministic Engine Calculation Output</span>
          </h3>
          <pre className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-emerald-400 overflow-x-auto">
            {JSON.stringify(calcResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
