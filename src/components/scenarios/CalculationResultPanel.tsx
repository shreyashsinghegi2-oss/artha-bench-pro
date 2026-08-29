import React from 'react';
import { Calculator, CheckCircle2, Fingerprint, Info } from 'lucide-react';
import type { CalculatorTab, ScenarioCurrency } from './ScenarioAssistantPanel';

const number = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const money = (value: number, currency: ScenarioCurrency) => new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

export const CalculationResultPanel: React.FC<{ activeTab: CalculatorTab; result: Record<string, unknown>; currency: ScenarioCurrency }> = ({ activeTab, result, currency }) => {
  const definition = buildDefinition(activeTab, result, currency);
  return (
    <section className="space-y-5 rounded-3xl border border-line bg-surface p-6 shadow-sm" aria-label="Deterministic calculation result">
      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="flex items-center gap-2 text-sm font-black text-ink"><CheckCircle2 className="h-4 w-4 text-success" /> Deterministic Engine Result</h3><p className="mt-1 text-[10px] text-secondary">Calculated on the server by Decimal.js. The AI assistant receives this result as evidence; it does not generate the calculation.</p></div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-success-fill/25 bg-success-soft px-3 py-1 text-[10px] font-black uppercase tracking-wider text-success"><Calculator className="h-3.5 w-3.5" /> Verified calculation</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {definition.metrics.map((metric) => <Metric key={metric.label} label={metric.label} value={metric.value} emphasize={metric.emphasize} />)}
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-interactive/20 bg-interactive-soft/50 p-4"><div className="text-[9px] font-black uppercase tracking-wider text-interactive">Formula / method</div><div className="mt-2 font-mono text-xs font-bold leading-6 text-ink">{definition.formula}</div></div>
        <div className="rounded-2xl border border-line bg-canvas p-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-secondary"><Info className="h-3.5 w-3.5" /> Interpretation</div><p className="mt-2 text-xs leading-6 text-ink">{definition.interpretation}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-[10px] text-secondary">
        <span className="font-bold text-ink">Engine: {String(result.engine || 'Decimal.js')}</span>
        {result.verificationCode && <span className="inline-flex items-center gap-1"><Fingerprint className="h-3 w-3" /> {String(result.verificationCode)}</span>}
        {result.calculatedAt && <span>Calculated: {new Date(String(result.calculatedAt)).toLocaleString()}</span>}
      </div>

      <p className="text-[10px] leading-5 text-secondary">This calculator uses only the values entered in the scenario. External market, company, economic, tax, or lender data is never silently inserted into the deterministic formula. ArthaMind may show connected context separately when you ask it to analyze the result.</p>
    </section>
  );
};

function buildDefinition(activeTab: CalculatorTab, result: Record<string, unknown>, currency: ScenarioCurrency) {
  const n = (key: string) => Number(result[key] ?? 0);
  if (activeTab === 'compound') {
    return {
      metrics: [
        { label: 'Final balance', value: money(n('finalBalance'), currency), emphasize: true },
        { label: 'Total contributions', value: money(n('totalContributions'), currency) },
        { label: 'Interest earned', value: money(n('totalInterestEarned'), currency), emphasize: true },
        { label: 'Annual rate', value: `${number(n('annualRatePercent'))}%` },
      ],
      formula: `A = P(1 + r/n)^(nt); recurring deposits are modeled monthly. n = ${number(n('compoundingFrequencyPerYear'))}.`,
      interpretation: `Starting from ${money(n('principal'), currency)}, the entered assumptions produce a final balance of ${money(n('finalBalance'), currency)}. Calculated interest above recorded contributions is ${money(n('totalInterestEarned'), currency)}.`,
    };
  }
  if (activeTab === 'quick-ratio') {
    return {
      metrics: [
        { label: 'Quick ratio', value: number(n('quickRatio')), emphasize: true },
        { label: 'Cash', value: money(n('cash'), currency) },
        { label: 'Quick assets', value: money(n('cash') + n('marketableSecurities') + n('receivables'), currency) },
        { label: 'Current liabilities', value: money(n('currentLiabilities'), currency) },
      ],
      formula: 'Quick Ratio = (Cash + Marketable Securities + Receivables) / Current Liabilities',
      interpretation: `${String(result.assessment || 'The quick ratio compares readily available assets with current liabilities.')} Industry norms and balance-sheet definitions can differ, so the ratio should be interpreted with the underlying statements.`,
    };
  }
  if (activeTab === 'cagr') {
    return {
      metrics: [
        { label: 'CAGR', value: `${number(n('cagrPercent'))}%`, emphasize: true },
        { label: 'Initial value', value: money(n('initialValue'), currency) },
        { label: 'Final value', value: money(n('finalValue'), currency) },
        { label: 'Period', value: `${number(n('years'))} years` },
      ],
      formula: 'CAGR = (Final Value / Initial Value)^(1 / Years) − 1',
      interpretation: `The entered start and end values correspond to an annualized compound growth rate of ${number(n('cagrPercent'))}% over ${number(n('years'))} years. CAGR smooths the path and is not a forecast of future returns.`,
    };
  }
  if (activeTab === 'break-even') {
    return {
      metrics: [
        { label: 'Break-even units', value: number(n('breakEvenUnits')), emphasize: true },
        { label: 'Break-even revenue', value: money(n('breakEvenRevenue'), currency), emphasize: true },
        { label: 'Contribution margin', value: money(n('contributionMargin'), currency) },
        { label: 'Fixed costs', value: money(n('fixedCosts'), currency) },
      ],
      formula: 'Break-even Units = Fixed Costs / (Price per Unit − Variable Cost per Unit)',
      interpretation: `At the entered price and variable cost, contribution margin is ${money(n('contributionMargin'), currency)} per unit. Required modeled volume is rounded up to ${number(n('breakEvenUnits'))} units, corresponding to ${money(n('breakEvenRevenue'), currency)} of revenue.`,
    };
  }
  return {
    metrics: [
      { label: 'Debt-to-income', value: `${number(n('dtiPercent'))}%`, emphasize: true },
      { label: 'Educational tier', value: String(result.healthCategory || '—') },
      { label: 'Monthly gross income', value: money(n('monthlyGrossIncome'), currency) },
      { label: 'Monthly debt payments', value: money(n('monthlyDebtPayments'), currency) },
    ],
    formula: 'DTI = Monthly Debt Payments / Monthly Gross Income × 100',
    interpretation: `The entered debt payments equal ${number(n('dtiPercent'))}% of gross monthly income. The displayed tier is an educational calculator classification; actual lender definitions, qualifying debts, and thresholds can differ.`,
  };
}

const Metric: React.FC<{ label: string; value: React.ReactNode; emphasize?: boolean }> = ({ label, value, emphasize }) => (
  <div className="rounded-2xl border border-line bg-canvas p-4"><div className="text-[9px] font-black uppercase tracking-wider text-secondary">{label}</div><div className={`mt-1 break-words text-lg font-black ${emphasize ? 'text-success' : 'text-ink'}`}>{value}</div></div>
);
