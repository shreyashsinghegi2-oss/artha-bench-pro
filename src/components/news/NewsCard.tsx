import React, { useMemo, useState } from 'react';
import { ExternalLink, Sparkles, Clock, Newspaper } from 'lucide-react';
import { NewsExplanationResponse, NormalizedNewsItem } from '../../types';
import { explainNewsArticleAI } from '../../services/learningApi';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

interface NewsCardProps { article: NormalizedNewsItem; }
const proxyImage = (article: NormalizedNewsItem) => {
  const target = article.imageUrl || article.sourceUrl || '';
  const source = article.sourceUrl || '';
  return target ? `/api/news/image?url=${encodeURIComponent(target)}${source ? `&source=${encodeURIComponent(source)}` : ''}` : '';
};

export const NewsCard: React.FC<NewsCardProps> = ({ article }) => {
  const [isExplaining, setIsExplaining] = useState(false);
  const [imageSrc, setImageSrc] = useState(proxyImage(article));
  const [imageFailed, setImageFailed] = useState(false);
  const [explanation, setExplanation] = useState<NewsExplanationResponse | null>(null);
  const category = (article.category || '').toLowerCase();
  const categorySurface = useMemo(() => category.includes('macro') || category.includes('economy') ? 'bg-interactive-soft text-interactive' : category.includes('corporate') || category.includes('earning') ? 'bg-success-soft text-success' : category.includes('policy') || category.includes('bank') || category.includes('rate') ? 'bg-premium-soft text-premium' : 'bg-subtle text-interactive', [category]);
  const handleExplain = async () => { if (explanation) { setExplanation(null); return; } setIsExplaining(true); try { setExplanation(await explainNewsArticleAI(article)); } finally { setIsExplaining(false); } };
  const sourceFallback = article.sourceUrl ? `/api/news/image?url=${encodeURIComponent(article.sourceUrl)}` : '';
  const handleImageError = () => {
    if (sourceFallback && imageSrc !== sourceFallback) { setImageSrc(sourceFallback); return; }
    setImageFailed(true);
  };

  return <div className="bg-surface border border-line hover:border-interactive/40 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between overflow-hidden transition-all">
    <div>
      <div className="relative w-full h-40 rounded-2xl overflow-hidden mb-3 bg-canvas">
        {imageSrc && !imageFailed ? <img src={imageSrc} alt={article.title} onError={handleImageError} className="w-full h-full object-cover transition-transform duration-500"/> : <div className={`w-full h-full ${categorySurface} flex items-center justify-center`}><Newspaper className="w-12 h-12 opacity-55" aria-hidden="true"/></div>}
        <span className="absolute bottom-2 left-2 font-bold text-[10px] text-success bg-success-soft border border-success-fill/25 px-2 py-0.5 rounded-full uppercase tracking-wider">{article.category || 'Financial Intelligence'}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-secondary mb-2"><span className="font-semibold text-interactive bg-interactive/15 border border-interactive/30 px-2 py-0.5 rounded-full text-[10px]">{article.sourceName}</span><div className="flex items-center gap-1.5 text-secondary text-[11px]"><Clock className="w-3 h-3"/><span>{article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'Recent'}</span></div></div>
      <h3 className="font-bold text-ink text-sm leading-snug hover:text-interactive transition-colors">{article.title}</h3><p className="text-xs text-secondary mt-2 line-clamp-3 leading-relaxed">{article.summary}</p>
    </div>
    <div className="pt-3 border-t border-line flex items-center justify-between gap-2"><button onClick={handleExplain} disabled={isExplaining} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-interactive/20 hover:bg-interactive/30 text-interactive border border-interactive/40 transition-all"><Sparkles className="w-3.5 h-3.5"/><span>{explanation?'Hide Explanation':isExplaining?'Analyzing...':'AI Business Analysis'}</span></button><a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-secondary hover:text-ink"><span>Source</span><ExternalLink className="w-3.5 h-3.5"/></a></div>
    {explanation && <div className="mt-3"><StructuredFinancialAnswerView answer={explanation.structuredAnswer} disclaimer={explanation.disclaimer} compact/></div>}
  </div>;
};
