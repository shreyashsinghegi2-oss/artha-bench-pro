import React, { useState, useEffect } from 'react';
import { Newspaper, Filter, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { fetchBusinessNews } from '../../services/learningApi';
import { NormalizedNewsItem } from '../../types';
import { NewsCard } from './NewsCard';
import { SafetyBanner } from '../SafetyBanner';

export const NewsView: React.FC = () => {
  const [news, setNews] = useState<NormalizedNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', label: 'All Intelligence' },
    { id: 'macroeconomics', label: 'Macroeconomics' },
    { id: 'corporate', label: 'Corporate & Earnings' },
    { id: 'tech', label: 'Tech & AI Markets' },
    { id: 'policy', label: 'Central Banking & Rates' },
  ];

  useEffect(() => {
    loadNews();
  }, [selectedCategory]);

  const loadNews = async () => {
    setLoading(true);
    try {
      const categoryParam = selectedCategory === 'all' ? undefined : selectedCategory;
      const data = await fetchBusinessNews(categoryParam);
      setNews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load business news:', err);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  const newsList = Array.isArray(news) ? news : [];

  const filteredNews = newsList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.title || '').toLowerCase().includes(q) ||
      (item.summary || '').toLowerCase().includes(q) ||
      (item.sourceName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-line p-6 rounded-2xl shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-success-soft/60 border border-success-fill/60 text-success text-xs font-medium mb-2">
            <Newspaper className="w-3.5 h-3.5" />
            <span>Business News Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">Financial News & Educational Analysis</h1>
          <p className="text-xs text-secondary mt-1 max-w-2xl leading-relaxed">
            Curated financial news feed with AI analysis explaining economic principles, valuation impact, and macro learning concepts without offering trade advice.
          </p>
        </div>

        <button
          onClick={loadNews}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-hover hover:bg-hover text-ink text-xs font-semibold rounded-xl border border-line-strong transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      <SafetyBanner />

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-surface border border-line p-4 rounded-2xl">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-interactive-soft text-interactive shadow-sm'
                  : 'bg-surface text-secondary hover:text-ink border border-line'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search news headline or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-line rounded-xl pl-9 pr-4 py-1.5 text-xs text-ink placeholder:text-secondary focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
          />
        </div>
      </div>

      {/* News Feed Grid */}
      {loading ? (
        <div className="text-center py-16 space-y-3">
          <RefreshCw className="w-6 h-6 text-success animate-spin mx-auto" />
          <p className="text-xs text-secondary">Fetching latest business news and educational breakdowns...</p>
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-secondary mx-auto" />
          <p className="text-sm font-semibold text-secondary">No news articles found for this filter.</p>
          <p className="text-xs text-secondary">Try adjusting your search query or choosing another category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNews.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
};
