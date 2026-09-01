import React, { useMemo } from 'react';
import { ArrowRight, CalendarClock, HeartPulse } from 'lucide-react';
import { AppNavigationDestination } from '../../navigationTypes';
import { buildFinancialHealthSnapshot } from '../../services/financialHealth';
import { buildEmiIntelligenceSnapshot } from '../../services/emiIntelligence';
import { loadEmiRecords } from '../../services/emiStorage';
import { formatINR } from '../../services/personalFinanceStorage';
import { FinanceReportsView } from './FinanceReportsView';

type Props = { onNavigate: (destination: AppNavigationDestination) => void };

export const FinanceReportsIntelligenceView: React.FC<Props> = ({ onNavigate }) => {
  const intelligence = useMemo(() => ({
    health: buildFinancialHealthSnapshot(6),
    emi: buildEmiIntelligenceSnapshot(loadEmiRecords()),
  }), []);

  const showHealth = intelligence.health.dimensions.some((item) => item.score != null);
  const showEmi = intelligence.emi.activeCount > 0 || intelligence.emi.dimensions.some((item) => item.score != null);

  return (
    <>
      {(showHealth || showEmi) && (
        <div className="mx-auto max-w-[1500px] px-4 pt-7 sm:px-6">
          <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="report-intelligence-title">
            <div className="text-[10px] font-black uppercase tracking-[.14em] text-interactive">Cross-module intelligence</div>
            <h2 id="report-intelligence-title" className="mt-1 text-lg font-black text-ink">Health and commitment context</h2>
            <p className="mt-1 text-[10px] leading-5 text-secondary">Calculated from recorded workspace data for review alongside your existing reports. These indicators are not credit scores, lending decisions or forecasts.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {showHealth && <button type="button" onClick={() => onNavigate('financial-health')} className="rounded-2xl border border-line bg-canvas p-4 text-left hover:border-interactive/35"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-secondary"><HeartPulse className="h-4 w-4 text-interactive" /> Financial Health</div><div className="mt-2 text-base font-black text-ink">{intelligence.health.composite == null ? 'Profile incomplete' : `${intelligence.health.composite}/100 · ${intelligence.health.compositeStatus}`}</div><div className="mt-1 text-[9px] leading-4 text-secondary">{intelligence.health.compositeReason}</div></div><ArrowRight className="h-4 w-4 text-interactive" /></div></button>}
              {showEmi && <button type="button" onClick={() => onNavigate('emi-manager')} className="rounded-2xl border border-line bg-canvas p-4 text-left hover:border-interactive/35"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider text-secondary"><CalendarClock className="h-4 w-4 text-interactive" /> EMI Intelligence</div><div className="mt-2 text-base font-black text-ink">{intelligence.emi.activeCount ? `${formatINR(intelligence.emi.activeMonthlyCommitment)} monthly` : 'No active commitment recorded'}</div><div className="mt-1 text-[9px] leading-4 text-secondary">{intelligence.emi.commitmentToIncomePercent == null ? 'Recorded income needed for commitment ratio.' : `${intelligence.emi.commitmentToIncomePercent}% of recorded monthly income · descriptive ratio only.`}</div></div><ArrowRight className="h-4 w-4 text-interactive" /></div></button>}
            </div>
          </section>
        </div>
      )}
      <FinanceReportsView onNavigate={onNavigate} />
    </>
  );
};
