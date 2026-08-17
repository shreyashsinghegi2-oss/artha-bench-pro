import React, { useState } from 'react';
import { Users, X, Award, Shield, Cpu, BookOpen } from 'lucide-react';

export const Footer: React.FC = () => {
  const [showContributors, setShowContributors] = useState(false);

  const teamMembers = [
    {
      name: 'Shreyash Singh',
      role: 'Lead Architect & Creator',
      workstream: 'Core 7-Dimension Scoring Engine, Deterministic Decimal.js Math Core, Dual-Model Consensus Architecture, System Security & Rate Limiting',
      icon: Cpu,
    },
    {
      name: 'ArthaBench Research Team',
      role: 'Financial Reliability & Dataset Engineering',
      workstream: 'Benchmark V1 Scenario Dataset, Regulatory Evidence Verifier (SEBI/RBI/SEC), Prompt Injection Security Guardrails, Regional Localization Protocols',
      icon: Shield,
    },
  ];

  return (
    <footer className="bg-canvas border-t border-line py-8 px-4 text-secondary text-xs">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
        <div>
          <p className="font-semibold text-ink">ArthaBench Pro — AI Financial Reliability Benchmark V2.0</p>
          <p className="text-secondary mt-1">
            Created and architected by <span className="text-ink font-medium">Shreyash Singh</span> · Developed with the <button onClick={() => setShowContributors(true)} className="text-interactive underline font-medium hover:text-interactive transition-all">ArthaBench Research Team</button>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 text-secondary">
          <button
            onClick={() => setShowContributors(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-subtle hover:bg-hover text-ink rounded-lg transition-all text-[11px] font-medium border border-line-strong"
          >
            <Users className="w-3.5 h-3.5 text-interactive" />
            <span>Team & Workstreams</span>
          </button>
          <span className="hidden sm:inline">•</span>
          <span>Deterministic Decimal.js Math</span>
          <span className="hidden sm:inline">•</span>
          <span>Zero Hardcoded Scores</span>
        </div>
      </div>

      {showContributors && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-sm relative">
            <button
              onClick={() => setShowContributors(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-subtle text-secondary hover:text-ink transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div className="p-3 bg-interactive/20 border border-interactive/40 rounded-2xl text-interactive">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink">Architecture & Team Credits</h2>
                <p className="text-xs text-secondary">
                  ArthaBench Pro V2.0 Research & Engineering Workstreams
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {teamMembers.map((m, idx) => {
                const IconComponent = m.icon;
                return (
                  <div key={idx} className="p-4 bg-canvas border border-line rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4 text-interactive" />
                        <h3 className="text-sm font-bold text-ink">{m.name}</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-interactive/10 text-interactive text-[10px] font-semibold border border-interactive/30">
                        {m.role}
                      </span>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed pl-6">
                      <strong className="text-ink">Key Contributions:</strong> {m.workstream}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-subtle/50 rounded-2xl border border-line text-center">
              <p className="text-xs text-secondary">
                ArthaBench Pro V2.0 is built under the MIT Open Source License for research and benchmark reproducibility.
              </p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
