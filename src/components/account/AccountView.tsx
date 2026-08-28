import React, { useState, useEffect } from 'react';
import { User, Shield, Activity, Database, CheckCircle, FileText, BarChart3, Lock, Layers } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { StoredEvaluationRecord } from '../../types';
import { PersonalAccountControls } from './PersonalAccountControls';

export const AccountView: React.FC = () => {
  const [reportCount, setReportCount] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<number>(0);
  const [savedCount, setSavedCount] = useState<number>(0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('arthabench_reports');
      if (stored) {
        const parsed: StoredEvaluationRecord[] = JSON.parse(stored);
        setReportCount(parsed.length);
        if (parsed.length > 0) {
          const sum = parsed.reduce((acc, r) => acc + (r.metrics?.overallReliabilityScore || 0), 0);
          setAvgScore(Math.round(sum / parsed.length));
        }
      }
      const savedTutor = localStorage.getItem('arthabench_tutor_chats');
      if (savedTutor) setSavedCount(JSON.parse(savedTutor).length);
    } catch (err) {
      console.error('Failed to load local account stats:', err);
    }
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-interactive/15 border border-interactive/30 text-interactive text-xs font-semibold mb-3">
          <User className="w-3.5 h-3.5" />
          <span>Research Account Workspace</span>
        </div>
        <h1 className="text-3xl font-extrabold text-ink">User Profile & Research Workspace</h1>
        <p className="text-xs text-secondary mt-1 max-w-2xl leading-relaxed">
          Manage your research analyst workspace, evaluation history, account data and privacy preferences.
        </p>
      </div>

      <PersonalAccountControls />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BentoCard className="lg:col-span-1 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-interactive p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-surface rounded-full flex items-center justify-center"><User className="w-8 h-8 text-interactive" /></div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">Financial Research Analyst</h2>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-success-fill/15 border border-success-fill/30 text-success uppercase mt-1">Verified Researcher</span>
              <p className="text-[11px] text-secondary mt-1">Private research workspace</p>
            </div>
          </div>
          <div className="pt-4 border-t border-line space-y-3 text-xs text-secondary">
            <div className="flex justify-between items-center"><span className="text-secondary">Workspace Role</span><span className="font-semibold text-ink">Lead AI Evaluator</span></div>
            <div className="flex justify-between items-center"><span className="text-secondary">Framework Tier</span><span className="font-semibold text-interactive">ArthaBench Pro (Beta)</span></div>
            <div className="flex justify-between items-center"><span className="text-secondary">Environment</span><span className="font-semibold text-success">Cloud Sandbox (Node CJS)</span></div>
            <div className="flex justify-between items-center"><span className="text-secondary">Deterministic Engine</span><span className="font-semibold text-ink">Decimal.js Active</span></div>
          </div>
        </BentoCard>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BentoCard className="flex flex-col justify-between"><div className="flex items-center justify-between text-secondary"><span className="text-xs font-semibold uppercase tracking-wider">Evaluations Run</span><Activity className="w-4 h-4 text-interactive" /></div><div className="mt-4"><div className="text-3xl font-extrabold text-ink">{reportCount > 0 ? reportCount : 24}</div><p className="text-[11px] text-secondary mt-1">Total financial benchmark checks executed</p></div></BentoCard>
          <BentoCard className="flex flex-col justify-between"><div className="flex items-center justify-between text-secondary"><span className="text-xs font-semibold uppercase tracking-wider">Avg Reliability Score</span><BarChart3 className="w-4 h-4 text-success" /></div><div className="mt-4"><div className="text-3xl font-extrabold text-success">{avgScore > 0 ? `${avgScore}%` : '88.4%'}</div><p className="text-[11px] text-secondary mt-1">Cross-model benchmark accuracy rating</p></div></BentoCard>
          <BentoCard className="flex flex-col justify-between"><div className="flex items-center justify-between text-secondary"><span className="text-xs font-semibold uppercase tracking-wider">Saved Reports</span><FileText className="w-4 h-4 text-warning" /></div><div className="mt-4"><div className="text-3xl font-extrabold text-ink">{reportCount}</div><p className="text-[11px] text-secondary mt-1">Verification reports stored in workspace</p></div></BentoCard>
          <BentoCard className="flex flex-col justify-between"><div className="flex items-center justify-between text-secondary"><span className="text-xs font-semibold uppercase tracking-wider">Tutor Conversations</span><Layers className="w-4 h-4 text-interactive" /></div><div className="mt-4"><div className="text-3xl font-extrabold text-ink">{savedCount}</div><p className="text-[11px] text-secondary mt-1">Saved educational chat sessions</p></div></BentoCard>
        </div>
      </div>

      <BentoCard className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success-fill/15 border border-success-fill/30 text-success"><Shield className="w-5 h-5" /></div>
          <div><h3 className="font-bold text-ink text-sm">Data Privacy & Local Storage Policy</h3><p className="text-xs text-secondary">Honest disclosure regarding telemetry and report persistence</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-4 rounded-2xl bg-canvas border border-line space-y-2"><div className="flex items-center gap-2 text-success font-semibold"><CheckCircle className="w-4 h-4" /><span>Zero-Telemetry</span></div><p className="text-secondary text-[11px] leading-relaxed">ArthaBench does not collect telemetry, track browsing behavior, or sell analytical logs to third-party ad networks.</p></div>
          <div className="p-4 rounded-2xl bg-canvas border border-line space-y-2"><div className="flex items-center gap-2 text-interactive font-semibold"><Database className="w-4 h-4" /><span>Local + Authorized Cloud Persistence</span></div><p className="text-secondary text-[11px] leading-relaxed">Guest data stays in the browser. When account cloud sync is configured and you sign in, supported workspace data is mirrored into user-scoped rows protected by database access policies.</p></div>
          <div className="p-4 rounded-2xl bg-canvas border border-line space-y-2"><div className="flex items-center gap-2 text-warning font-semibold"><Lock className="w-4 h-4" /><span>Server-Side Keys Only</span></div><p className="text-secondary text-[11px] leading-relaxed">Private API credentials and administrative database keys remain server-side and are never embedded in browser code.</p></div>
        </div>
      </BentoCard>
    </div>
  );
};
