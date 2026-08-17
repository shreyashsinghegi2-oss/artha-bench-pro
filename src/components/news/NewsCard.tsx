import React, { useState } from 'react';
import { ExternalLink, Sparkles, Clock, Newspaper } from 'lucide-react';
import { NewsExplanationResponse, NormalizedNewsItem } from '../../types';
import { explainNewsArticleAI } from '../../services/learningApi';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

interface NewsCardProps {
  article: NormalizedNewsItem;
}

export const NewsCard: React.FC<NewsCardProps> = ({ article }) => {
  const [isExplaining, setIsExplaining] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [explanation, setExplanation] = useState<NewsExplanationResponse | null>(null);

  const getCategorySurface = () => {
    const cat = (article.category || '').toLowerCase();
    if (cat.includes('macro') || cat.includes('economy')) return 'bg-interactive-soft text-interactive';
    if (cat.includes('corporate') || cat.includes('earning')) return 'bg-success-soft text-success';
    if (cat.includes('policy') || cat.includes('bank') || cat.includes('rate')) return 'bg-premium-soft text-premium';
    return 'bg-subtle text-interactive';
  };

  const handleExplain = async () => {
    if (explanation) {
      setExplanation(null);
      return;
    }

    setIsExplaining(true);
    try {
      const res = await explainNewsArticleAI(article);
      setExplanation(res);
    } catch (err) {
      console.error('Failed to explain news:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="bg-surface border border-line hover:border-interactive/40 rounded-3xl p-5 shadow-sm space-y-4 flex flex-col justify-between overflow-hidden transition-all">
      <div>
        {/* Category Thumbnail Image */}
        <div className="relative w-full h-40 rounded-2xl overflow-hidden mb-3 bg-canvas">
          {article.imageUrl && !imageFailed ? (
            <img
              src={article.imageUrl}
              alt={article.title}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full ${getCategorySurface()} flex items-center justify-center`}>
              <Newspaper className="w-12 h-12 opacity-55" aria-hidden="true" />
            </div>
          )}
          <span className="absolute bottom-2 left-2 font-bold text-[10px] text-success bg-success-soft border border-success-fill/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
            {article.category || 'Financial Intelligence'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-secondary mb-2">
          <span className="font-semibold text-interactive bg-interactive/15 border border-interactive/30 px-2 py-0.5 rounded-full text-[10px]">
            {article.sourceName}
          </span>
          <div className="flex items-center gap-1.5 text-secondary text-[11px]">
            <Clock className="w-3 h-3" />
            <span>
              {article.publishedAt
                ? new Date(article.publishedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent'}
            </span>
          </div>
        </div>

        <h3 className="font-bold text-ink text-sm leading-snug hover:text-interactive transition-colors">
          {article.title}
        </h3>

        <p className="text-xs text-secondary mt-2 line-clamp-3 leading-relaxed">
          {article.summary}
        </p>
      </div>

      <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
        <button
          onClick={handleExplain}
          disabled={isExplaining}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-interactive/20 hover:bg-interactive/30 text-interactive border border-interactive/40 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-interactive" />
          <span>{explanation ? 'Hide Explanation' : isExplaining ? 'Analyzing...' : 'AI Business Analysis'}</span>
        </button>

        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-secondary hover:text-ink transition-colors"
        >
          <span>Source</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {explanation && (
        <div className="mt-3">
          <StructuredFinancialAnswerView
            answer={explanation.structuredAnswer}
            disclaimer={explanation.disclaimer}
            compact
          />
        </div>
      )}
    </div>
  );
};
