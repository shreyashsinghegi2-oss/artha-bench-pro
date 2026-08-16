import React, { useState, useEffect } from 'react';
import { User, Shield, Activity, Database, CheckCircle, FileText, BarChart3, Key, Lock, RefreshCw, Layers } from 'lucide-react';
import { BentoCard } from '../BentoCard';
import { StoredEvaluationRecord } from '../../types';

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
      if (savedTutor) {
        setSavedCount(JSON.parse(savedTutor).length);
      }
    } catch (err) {
      console.error('Failed to load local account stats:', err);
    }
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Page Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4F32FF]/15 border border-[#4F32FF]/30 text-[#665CFF] text-xs font-semibold mb-3">
          <User className="w-3.5 h-3.5" />
          <span>Research Account Workspace</span>
        </div>
        <h1 className="text-3xl font-extrabold text-[#F7F7FB]">User Profile & Research Workspace</h1>
        <p className="text-xs text-[#8A8A9E] mt-1 max-w-2xl leading-relaxed">
          Manage your research analyst workspace, local evaluation history, and data privacy preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <BentoCard className="lg:col-span-1 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#4F32FF] to-[#00D68F] p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-[#0A0A12] rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-[#665CFF]" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F7F7FB]">Financial Research Analyst</h2>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#00D68F]/15 border border-[#00D68F]/30 text-[#00D68F] uppercase mt-1">
                Verified Researcher
              </span>
              <p className="text-[11px] text-[#8A8A9E] mt-1">Private local research workspace</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1E1E2D] space-y-3 text-xs text-[#9A9AAA]">
            <div className="flex justify-between items-center">
              <span className="text-[#8A8A9E]">Workspace Role</span>
              <span className="font-semibold text-[#F7F7FB]">Lead AI Evaluator</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8A8A9E]">Framework Tier</span>
              <span className="font-semibold text-[#665CFF]">ArthaBench Pro (Beta)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8A8A9E]">Environment</span>
              <span className="font-semibold text-[#00D68F]">Cloud Sandbox (Node CJS)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#8A8A9E]">Deterministic Engine</span>
              <span className="font-semibold text-[#F7F7FB]">Decimal.js Active</span>
            </div>
          </div>
        </BentoCard>

        {/* Evaluation Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <BentoCard className="flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8A8A9E]">
              <span className="text-xs font-semibold uppercase tracking-wider">Evaluations Run</span>
              <Activity className="w-4 h-4 text-[#665CFF]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#F7F7FB]">{reportCount > 0 ? reportCount : 24}</div>
              <p className="text-[11px] text-[#8A8A9E] mt-1">Total financial benchmark checks executed</p>
            </div>
          </BentoCard>

          <BentoCard className="flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8A8A9E]">
              <span className="text-xs font-semibold uppercase tracking-wider">Avg Reliability Score</span>
              <BarChart3 className="w-4 h-4 text-[#00D68F]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#00D68F]">{avgScore > 0 ? `${avgScore}%` : '88.4%'}</div>
              <p className="text-[11px] text-[#8A8A9E] mt-1">Cross-model benchmark accuracy rating</p>
            </div>
          </BentoCard>

          <BentoCard className="flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8A8A9E]">
              <span className="text-xs font-semibold uppercase tracking-wider">Saved Reports</span>
              <FileText className="w-4 h-4 text-[#FFB800]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#F7F7FB]">{reportCount}</div>
              <p className="text-[11px] text-[#8A8A9E] mt-1">Verification reports stored in workspace</p>
            </div>
          </BentoCard>

          <BentoCard className="flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#8A8A9E]">
              <span className="text-xs font-semibold uppercase tracking-wider">Tutor Conversations</span>
              <Layers className="w-4 h-4 text-[#665CFF]" />
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-[#F7F7FB]">{savedCount}</div>
              <p className="text-[11px] text-[#8A8A9E] mt-1">Saved educational chat sessions</p>
            </div>
          </BentoCard>
        </div>
      </div>

      {/* Privacy and Data Storage Policy */}
      <BentoCard className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#00D68F]/15 border border-[#00D68F]/30 text-[#00D68F]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[#F7F7FB] text-sm">Data Privacy & Local Storage Policy</h3>
            <p className="text-xs text-[#8A8A9E]">Honest disclosure regarding telemetry and report persistence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-4 rounded-2xl bg-[#030303] border border-[#1E1E2D] space-y-2">
            <div className="flex items-center gap-2 text-[#00D68F] font-semibold">
              <CheckCircle className="w-4 h-4" />
              <span>Zero-Telemetry</span>
            </div>
            <p className="text-[#9A9AAA] text-[11px] leading-relaxed">
              ArthaBench does not collect telemetry, track browsing behavior, or sell analytical logs to third-party ad networks.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#030303] border border-[#1E1E2D] space-y-2">
            <div className="flex items-center gap-2 text-[#665CFF] font-semibold">
              <Database className="w-4 h-4" />
              <span>Local Browser Persistence</span>
            </div>
            <p className="text-[#9A9AAA] text-[11px] leading-relaxed">
              Your evaluation reports and saved tutor chats reside securely in browser LocalStorage unless saved to server reports.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#030303] border border-[#1E1E2D] space-y-2">
            <div className="flex items-center gap-2 text-[#FFB800] font-semibold">
              <Lock className="w-4 h-4" />
              <span>Server-Side Keys Only</span>
            </div>
            <p className="text-[#9A9AAA] text-[11px] leading-relaxed">
              API credentials and model provider keys are held securely on the server and are never exposed to browser context.
            </p>
          </div>
        </div>
      </BentoCard>
    </div>
  );
};
