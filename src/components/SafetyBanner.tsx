import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface SafetyBannerProps {
  title?: string;
  message?: string;
  type?: 'warning' | 'info' | 'error';
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({
  title = 'Educational & Learning Safety Notice',
  message = 'Artha Bench content, AI tutoring, news explanations, and market analytics are for educational and benchmarking purposes only. Nothing here constitutes personalized financial, investment, legal, or tax advice. Past performance does not guarantee future results.',
  type = 'warning',
}) => {
  const isWarning = type === 'warning';
  const Icon = isWarning ? AlertTriangle : Info;

  return (
    <div
      className={`rounded-xl border p-3.5 mb-6 text-xs flex items-start gap-3 ${
        isWarning
          ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
          : 'bg-slate-900 border-slate-700/60 text-slate-300'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${isWarning ? 'text-amber-400' : 'text-cyan-400'}`} />
      <div>
        <h4 className="font-semibold text-slate-100">{title}</h4>
        <p className="mt-0.5 leading-relaxed opacity-90">{message}</p>
      </div>
    </div>
  );
};
