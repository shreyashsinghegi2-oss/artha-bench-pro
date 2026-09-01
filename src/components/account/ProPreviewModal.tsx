import React, { useEffect, useRef } from 'react';
import { BrainCircuit, CheckCircle2, Crown, FileDown, LineChart, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
};

const features = [
  { icon: BrainCircuit, name: 'Advanced ArthaMind Intelligence Briefs', description: 'Deeper, workspace-grounded financial analysis with evidence and explicit data limitations.', badge: 'Pro preview' },
  { icon: LineChart, name: 'Multi-period trend analysis', description: 'Compare recorded income and spending across longer periods with clearer driver analysis.', badge: 'Planned' },
  { icon: ShieldCheck, name: 'Advanced budget pressure diagnostics', description: 'Review configured budgets, recorded utilization and evidence-backed pressure signals.', badge: 'Pro preview' },
  { icon: LockKeyhole, name: 'EMI and commitment stress analysis', description: 'Examine recurring obligations against recorded cash-flow context without affordability claims.', badge: 'Pro preview' },
  { icon: Sparkles, name: 'Extended Decision Replay', description: 'Preview longer-horizon and scenario-comparison workflows while preserving deterministic calculations.', badge: 'Planned' },
  { icon: FileDown, name: 'Exportable intelligence reports', description: 'Create professional, traceable finance-workspace reports with evidence and limitation sections.', badge: 'Planned' },
  { icon: CheckCircle2, name: 'Advanced reliability trace', description: 'Expose more calculation, evidence, freshness and interpretation details for professional review.', badge: 'Pro preview' },
];

export const ProPreviewModal: React.FC<Props> = ({ open, onClose }) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-preview-title"
        aria-describedby="pro-preview-description"
        className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-5 py-5 backdrop-blur sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-interactive/25 bg-interactive-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-interactive">
              <Crown className="h-3.5 w-3.5" /> Signed-in Pro preview
            </div>
            <h2 id="pro-preview-title" className="mt-3 text-2xl font-black tracking-tight text-ink sm:text-3xl">Artha Bench Pro — Advanced Financial Intelligence</h2>
            <p id="pro-preview-description" className="mt-2 max-w-3xl text-sm leading-6 text-secondary">Explore advanced analysis, deeper reliability tools and professional finance-workspace capabilities.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="shrink-0 rounded-xl border border-line p-2 text-secondary transition hover:border-interactive/40 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive" aria-label="Close Pro preview">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <div className="rounded-2xl border border-line bg-canvas p-4 text-xs leading-5 text-secondary">
            <strong className="text-ink">Preview only.</strong> Feature availability depends on your plan and rollout status. This preview does not change your current access, request payment information, or claim that an upgrade has been completed.
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {features.map(({ icon: Icon, name, description, badge }) => (
              <article key={name} className="rounded-2xl border border-line bg-canvas p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-interactive/20 bg-interactive-soft text-interactive"><Icon className="h-4 w-4" /></div>
                  <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-secondary">{badge}</span>
                </div>
                <h3 className="mt-4 text-sm font-black text-ink">{name}</h3>
                <p className="mt-1 text-[11px] leading-5 text-secondary">{description}</p>
              </article>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-interactive/20 bg-interactive-soft p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black text-ink">Current access remains unchanged</div>
              <p className="mt-1 text-[10px] leading-5 text-secondary">Existing free and currently available features stay available exactly as they are unless a real server-side entitlement system is introduced later.</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-interactive/30 bg-surface px-4 py-2 text-xs font-black text-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-interactive">Continue with current access</button>
          </div>
        </div>
      </section>
    </div>
  );
};
