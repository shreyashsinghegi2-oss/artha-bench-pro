import React, { useState } from 'react';
import { CheckCircle2, MessageSquareText, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { FeedbackCategory, FeedbackRating, saveFeedback } from '../../services/feedbackStorage';

export const PageFeedback: React.FC<{ module: string; compact?: boolean }> = ({ module, compact = false }) => {
  const auth = useAuth();
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>('other');
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);

  if (saved) return <div className="flex items-center gap-2 rounded-xl border border-success-fill/25 bg-success-soft px-3 py-2 text-xs text-success"><CheckCircle2 className="h-4 w-4" /> Feedback saved. Thank you.</div>;

  const submit = () => {
    if (!rating) return;
    saveFeedback({ userId: auth.user?.id ?? null, kind: 'page', module, rating, category, comment: comment.trim().slice(0, 1000) });
    setSaved(true);
  };

  return <section className={`rounded-2xl border border-line bg-surface ${compact ? 'p-3' : 'p-4'}`} aria-label="Page feedback">
    <div className="flex flex-wrap items-center gap-2"><MessageSquareText className="h-4 w-4 text-interactive" /><span className="text-xs font-black text-ink">Was this page useful?</span><button type="button" onClick={() => setRating('helpful')} aria-pressed={rating === 'helpful'} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${rating === 'helpful' ? 'border-success-fill/30 bg-success-soft text-success' : 'border-line text-secondary'}`}><ThumbsUp className="mr-1 inline h-3 w-3" />Helpful</button><button type="button" onClick={() => setRating('not-helpful')} aria-pressed={rating === 'not-helpful'} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${rating === 'not-helpful' ? 'border-warning-fill/30 bg-warning-soft text-warning' : 'border-line text-secondary'}`}><ThumbsDown className="mr-1 inline h-3 w-3" />Not helpful</button></div>
    {rating && <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select aria-label="Feedback category" value={category} onChange={(e) => setCategory(e.target.value as FeedbackCategory)} className="rounded-lg border border-line bg-canvas px-2 py-2 text-[10px] text-ink"><option value="source">Source issue</option><option value="calculation">Calculation issue</option><option value="explanation">Explanation issue</option><option value="ui">UI issue</option><option value="other">Other</option></select><input aria-label="Optional feedback comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" className="rounded-lg border border-line bg-canvas px-3 py-2 text-[10px] text-ink" /><button type="button" onClick={submit} className="rounded-lg bg-brand px-3 py-2 text-[10px] font-black text-white">Send feedback</button></div>}
  </section>;
};
