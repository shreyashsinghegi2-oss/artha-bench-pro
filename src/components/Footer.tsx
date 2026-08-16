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
    <footer className="bg-[#030303] border-t border-[#1A1A23] py-8 px-4 text-[#9A9AAA] text-xs">
      <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
        <div>
          <p className="font-semibold text-[#F7F7FB]">ArthaBench Pro — AI Financial Reliability Benchmark V2.0</p>
          <p className="text-[#9A9AAA] mt-1">
            Created and architected by <span className="text-[#F7F7FB] font-medium">Shreyash Singh</span> · Developed with the <button onClick={() => setShowContributors(true)} className="text-[#665CFF] underline font-medium hover:text-[#7137F2] transition-all">ArthaBench Research Team</button>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 text-[#9A9AAA]">
          <button
            onClick={() => setShowContributors(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#1A1A23] hover:bg-[#2A2A38] text-[#F7F7FB] rounded-lg transition-all text-[11px] font-medium border border-[#2A2A38]"
          >
            <Users className="w-3.5 h-3.5 text-[#665CFF]" />
            <span>Team & Workstreams</span>
          </button>
          <span className="hidden sm:inline">•</span>
          <span>Deterministic Decimal.js Math</span>
          <span className="hidden sm:inline">•</span>
          <span>Zero Hardcoded Scores</span>
        </div>
      </div>

      {showContributors && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#08080E] border border-[#1A1A23] rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowContributors(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-[#1A1A23] text-[#9A9AAA] hover:text-[#F7F7FB] transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#1A1A23] pb-4">
              <div className="p-3 bg-[#4F32FF]/20 border border-[#4F32FF]/40 rounded-2xl text-[#665CFF]">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#F7F7FB]">Architecture & Team Credits</h2>
                <p className="text-xs text-[#9A9AAA]">
                  ArthaBench Pro V2.0 Research & Engineering Workstreams
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {teamMembers.map((m, idx) => {
                const IconComponent = m.icon;
                return (
                  <div key={idx} className="p-4 bg-[#030303] border border-[#1A1A23] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4 text-[#665CFF]" />
                        <h3 className="text-sm font-bold text-[#F7F7FB]">{m.name}</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#4F32FF]/10 text-[#665CFF] text-[10px] font-semibold border border-[#4F32FF]/30">
                        {m.role}
                      </span>
                    </div>
                    <p className="text-xs text-[#9A9AAA] leading-relaxed pl-6">
                      <strong className="text-[#F7F7FB]">Key Contributions:</strong> {m.workstream}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-[#1A1A23]/50 rounded-2xl border border-[#1A1A23] text-center">
              <p className="text-xs text-[#9A9AAA]">
                ArthaBench Pro V2.0 is built under the MIT Open Source License for research and benchmark reproducibility.
              </p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
