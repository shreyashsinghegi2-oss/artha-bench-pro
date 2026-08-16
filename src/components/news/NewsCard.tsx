import React, { useState } from 'react';
import { ExternalLink, Sparkles, Clock, Newspaper } from 'lucide-react';
import { NormalizedNewsItem } from '../../types';
import { explainNewsArticleAI } from '../../services/learningApi';

interface NewsCardProps {
  article: NormalizedNewsItem;
}

export const NewsCard: React.FC<NewsCardProps> = ({ article }) => {
  const [isExplaining, setIsExplaining] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [explanation, setExplanation] = useState<{
    explanation: string;
    keyTakeaways: string[];
    disclaimer: string;
  } | null>(null);

  const getCategoryGradient = () => {
    const cat = (article.category || '').toLowerCase();
    if (cat.includes('macro') || cat.includes('economy')) return 'from-[#4F32FF] via-[#39239A] to-[#08080E]';
    if (cat.includes('corporate') || cat.includes('earning')) return 'from-[#7137F2] via-[#351B70] to-[#08080E]';
    if (cat.includes('tech') || cat.includes('ai')) return 'from-[#335CFF] via-[#182A72] to-[#08080E]';
    if (cat.includes('policy') || cat.includes('bank') || cat.includes('rate')) return 'from-[#6547D9] via-[#2B205C] to-[#08080E]';
    return 'from-[#4F32FF] via-[#24186B] to-[#08080E]';
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
    <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#665CFF]/40 rounded-3xl p-5 shadow-xl space-y-4 flex flex-col justify-between overflow-hidden transition-all">
      <div>
        {/* Category Thumbnail Image */}
        <div className="relative w-full h-40 rounded-2xl overflow-hidden mb-3 bg-[#030303]">
          {article.imageUrl && !imageFailed ? (
            <img
              src={article.imageUrl}
              alt={article.title}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${getCategoryGradient()} flex items-center justify-center`}>
              <Newspaper className="w-12 h-12 text-white/55" aria-hidden="true" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A12] via-transparent to-transparent opacity-80" />
          <span className="absolute bottom-2 left-2 font-bold text-[10px] text-[#00D68F] bg-[#00D68F]/15 border border-[#00D68F]/30 px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md">
            {article.category || 'Financial Intelligence'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-[#8A8A9E] mb-2">
          <span className="font-semibold text-[#665CFF] bg-[#4F32FF]/15 border border-[#4F32FF]/30 px-2 py-0.5 rounded-full text-[10px]">
            {article.sourceName}
          </span>
          <div className="flex items-center gap-1.5 text-[#8A8A9E] text-[11px]">
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

        <h3 className="font-bold text-[#F7F7FB] text-sm leading-snug hover:text-[#665CFF] transition-colors">
          {article.title}
        </h3>

        <p className="text-xs text-[#9A9AAA] mt-2 line-clamp-3 leading-relaxed">
          {article.summary}
        </p>
      </div>

      <div className="pt-3 border-t border-[#1E1E2D] flex items-center justify-between gap-2">
        <button
          onClick={handleExplain}
          disabled={isExplaining}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#4F32FF]/20 hover:bg-[#4F32FF]/30 text-[#665CFF] border border-[#4F32FF]/40 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#665CFF]" />
          <span>{explanation ? 'Hide Explanation' : isExplaining ? 'Analyzing...' : 'AI Business Analysis'}</span>
        </button>

        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#8A8A9E] hover:text-[#F7F7FB] transition-colors"
        >
          <span>Source</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {explanation && (
        <div className="mt-3 bg-[#030303] border border-[#1E1E2D] rounded-2xl p-4 text-xs space-y-3">
          <h4 className="font-bold text-[#00D68F] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Educational Analysis</span>
          </h4>
          <div className="text-[#F7F7FB] leading-relaxed whitespace-pre-line">
            {explanation.explanation}
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-[#8A8A9E]">Key Student Takeaways:</span>
            <ul className="list-disc list-inside text-[#9A9AAA] space-y-0.5">
              {explanation.keyTakeaways.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
