import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { loadMoneyProfile } from '../../services/moneyProfile';
import { buildCompleteDashboard } from '../../services/completeDashboard';
import { dashboardSummary } from './DashboardSections';

/** Downloads the complete ArthaMind financial report (PDF with the ArthaMind logo). */
export const DownloadReportButton: React.FC<{ className?: string }> = ({ className = 'mh-btn' }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const profile = loadMoneyProfile();
      if (!profile) throw new Error('Answer the setup questions first.');
      let summary = '';
      try { summary = dashboardSummary(profile, buildCompleteDashboard({ profile, loans: [], income: [], expenses: [] })); } catch { /* summary is optional */ }
      const { downloadFinancialReport } = await import('../../services/financialReport');
      await downloadFinancialReport(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The report could not be made. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <>
    <button type="button" className={className} onClick={() => void run()} disabled={busy} aria-busy={busy}>
      {busy ? <Loader2 size={15} className="animate-spin"/> : <FileDown size={15}/>} {busy ? 'Preparing your report…' : 'Download my report (PDF)'}
    </button>
    {error && <small role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</small>}
  </>;
};
