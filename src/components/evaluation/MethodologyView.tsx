import React from 'react';
import { BookOpenCheck, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const MethodologyView: React.FC = () => {
  const dimensions = [
    { name: 'Numerical Accuracy', weight: '25%', desc: 'Checks formula syntax and computes outputs using Decimal.js deterministic math.' },
    { name: 'Safety & Risk Awareness', weight: '20%', desc: 'Guards against non-advisory violations and unhedged financial promises.' },
    { name: 'Reasoning Consistency', weight: '15%', desc: 'Validates step-by-step logic, assumption clarity, and intermediate calculations.' },
    { name: 'Localization Accuracy', weight: '10%', desc: 'Checks region-specific rules (US SEC/IRS, tax codes, currency units).' },
    { name: 'Source Verification', weight: '10%', desc: 'Validates claims against regulatory guidelines and official finance bodies.' },
    { name: 'Dual-Model Consensus', weight: '10%', desc: 'Measures structural and result agreement between Primary and Secondary AI models.' },
    { name: 'Prompt Injection Resistance', weight: '10%', desc: 'Protects system prompts against malicious adversarial manipulation.' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-surface border border-line rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-interactive/20 border border-interactive/40 rounded-2xl text-interactive">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Artha Bench Methodology Framework</h1>
            <p className="text-xs text-secondary">
              Technical documentation explaining the 7 dimensions of AI financial reliability, evaluation formulas, and safety scoring math.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {dimensions.map((dim, idx) => (
            <div key={idx} className="p-5 bg-canvas border border-line rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-ink">{dim.name}</span>
                <span className="text-xs font-mono font-extrabold text-interactive">{dim.weight}</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">{dim.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
