import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, Search, RefreshCw, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import { StoredEvaluationRecord } from '../../types';

export const ReportsView: React.FC = () => {
  const [reports, setReports] = useState<StoredEvaluationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<StoredEvaluationRecord | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (res.ok && Array.isArray(data.reports)) {
        setReports(data.reports);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const reportsList = Array.isArray(reports) ? reports : [];

  const filteredReports = reportsList.filter(
    (r) =>
      (r.verificationCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.query || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.verdict || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    window.open('/api/reports/export?format=csv', '_blank');
  };

  const handleExportJSON = () => {
    window.open('/api/reports/export?format=json', '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#4F32FF]/20 border border-[#4F32FF]/40 rounded-2xl text-[#665CFF]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#F7F7FB]">Evaluation Reports & Verification History</h1>
              <p className="text-xs text-[#9A9AAA]">
                Audit past multi-model evaluations, ground truth verifications, and 7-dimension scoring logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#1A1A23] hover:bg-[#2A2A38] text-[#F7F7FB] text-xs font-bold rounded-xl flex items-center gap-1.5 border border-[#2A2A38] transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#00D68F]" />
              <span>Export All CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3.5 py-2 bg-[#1A1A23] hover:bg-[#2A2A38] text-[#F7F7FB] text-xs font-bold rounded-xl flex items-center gap-1.5 border border-[#2A2A38] transition-all"
            >
              <FileText className="w-4 h-4 text-[#665CFF]" />
              <span>Export All JSON</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#030303] border border-[#1A1A23] rounded-2xl px-4 py-2.5">
          <Search className="w-4 h-4 text-[#9A9AAA]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by verification code, query keyword, or verdict..."
            className="w-full bg-transparent text-xs text-[#F7F7FB] placeholder-[#9A9AAA] focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-[#9A9AAA] gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#665CFF]" />
            <span>Loading verification audit logs...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#1A1A23] rounded-2xl p-6">
            <p className="text-xs text-[#9A9AAA]">No verification reports recorded yet. Run evaluations in Quick Check or Evaluation Lab.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((item) => (
              <div
                key={item.verificationCode}
                onClick={() => setSelectedReport(item)}
                className={`p-4 bg-[#030303] border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                  selectedReport?.verificationCode === item.verificationCode
                    ? 'border-[#4F32FF] bg-[#4F32FF]/5'
                    : 'border-[#1A1A23] hover:border-[#4F32FF]/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#665CFF]">{item.verificationCode}</span>
                    <span className="text-[10px] text-[#9A9AAA]">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#F7F7FB] font-medium">{item.query}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                      item.verdict === 'HIGHLY_RELIABLE'
                        ? 'bg-[#00D68F]/10 text-[#00D68F] border-[#00D68F]/30'
                        : item.verdict === 'MODERATE_RELIABILITY'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-[#FF3B65]/10 text-[#FF3B65] border-[#FF3B65]/30'
                    }`}
                  >
                    {item.verdict} ({item.metrics?.overallReliabilityScore ?? 0}%)
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#9A9AAA]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedReport && (
        <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-[#1A1A23] pb-4">
            <div>
              <span className="text-[10px] text-[#9A9AAA] font-mono block">VERIFICATION DETAILS</span>
              <h2 className="text-lg font-bold text-[#F7F7FB]">{selectedReport.verificationCode}</h2>
            </div>
            <span className="text-xs text-[#9A9AAA]">
              {selectedReport.createdAt ? new Date(selectedReport.createdAt).toLocaleString() : (selectedReport.timestamp ? new Date(selectedReport.timestamp).toLocaleString() : '')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl">
              <span className="text-[10px] text-[#9A9AAA] block">Overall Score</span>
              <span className="text-lg font-extrabold text-[#00D68F]">
                {selectedReport.metrics?.overallReliabilityScore ?? 0}%
              </span>
            </div>
            <div className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl">
              <span className="text-[10px] text-[#9A9AAA] block">Formula Accuracy</span>
              <span className="text-lg font-extrabold text-[#00D68F]">
                {selectedReport.metrics?.formulaAccuracyScore ?? 0}%
              </span>
            </div>
            <div className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl">
              <span className="text-[10px] text-[#9A9AAA] block">Consensus Score</span>
              <span className="text-lg font-extrabold text-[#665CFF]">
                {selectedReport.metrics?.dualModelConsensusScore ?? 0}%
              </span>
            </div>
            <div className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl">
              <span className="text-[10px] text-[#9A9AAA] block">Safety Compliance</span>
              <span className="text-lg font-extrabold text-[#00D68F]">
                {selectedReport.metrics?.safetyComplianceScore ?? 0}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#F7F7FB]">Primary Response Output</h4>
            <div className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl text-xs text-[#9A9AAA] whitespace-pre-wrap leading-relaxed">
              {selectedReport.primaryResponse}
            </div>
          </div>

          {selectedReport.secondaryResponse && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-[#F7F7FB]">Secondary Evaluator Output</h4>
              <div className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl text-xs text-[#9A9AAA] whitespace-pre-wrap leading-relaxed">
                {selectedReport.secondaryResponse}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
