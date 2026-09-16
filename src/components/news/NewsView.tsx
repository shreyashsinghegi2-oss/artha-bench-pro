import React, { useEffect, useState } from 'react';
import { AlertCircle, Filter, Newspaper, RefreshCw, Search } from 'lucide-react';
import { fetchBusinessNews } from '../../services/learningApi';
import { NormalizedNewsItem } from '../../types';
import { NewsCard } from './NewsCard';
import { SafetyBanner } from '../SafetyBanner';

export const NewsView: React.FC = () => {
  const [news, setNews] = useState<NormalizedNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const categories = [
    { id: 'all', label: 'All Intelligence' }, { id: 'macroeconomics', label: 'Macroeconomics' },
    { id: 'corporate', label: 'Corporate & Earnings' }, { id: 'tech', label: 'Tech & AI Markets' }, { id: 'policy', label: 'Central Banking & Rates' },
  ];
  const loadNews = async () => {
    setLoading(true); setLoadError('');
    try { const categoryParam = selectedCategory === 'all' ? undefined : selectedCategory; const data = await fetchBusinessNews(categoryParam); setNews(Array.isArray(data) ? data : []); setUpdatedAt(new Date().toISOString()); if (!data?.length) setLoadError('The configured news provider returned no usable headlines right now.'); }
    catch (error) { console.error('Failed to load business news:', error); setNews([]); setLoadError(error instanceof Error ? error.message : 'Business news is temporarily unavailable.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadNews(); const timer = window.setInterval(() => void loadNews(), 60_000); return () => window.clearInterval(timer); }, [selectedCategory]);
  const filteredNews = news.filter((item) => { if (!searchQuery.trim()) return true; const q = searchQuery.toLowerCase(); return (item.title || '').toLowerCase().includes(q) || (item.summary || '').toLowerCase().includes(q) || (item.sourceName || '').toLowerCase().includes(q); });
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-6 shadow-sm md:flex-row md:items-center"><div><div className="mb-2 inline-flex items-center gap-2 rounded-md border border-success-fill/60 bg-success-soft/60 px-2.5 py-1 text-xs font-medium text-success"><Newspaper className="h-3.5 w-3.5"/>Business News Intelligence</div><h1 className="text-2xl font-bold text-ink">Financial News & Educational Analysis</h1><p className="mt-1 max-w-2xl text-xs leading-relaxed text-secondary">Curated provider-backed financial news with AI analysis, source links, timestamps and honest data-state handling.</p></div><button onClick={()=>void loadNews()} disabled={loading} className="flex items-center gap-2 self-start rounded-xl border border-line-strong bg-hover px-4 py-2 text-xs font-semibold text-ink transition-all md:self-auto"><RefreshCw className={`h-3.5 w-3.5 ${loading?'animate-spin':''}`}/>Refresh Feed</button></div>
    <SafetyBanner/>
    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4 md:flex-row"><div className="flex w-full flex-wrap items-center gap-2 md:w-auto">{categories.map((cat)=><button key={cat.id} onClick={()=>setSelectedCategory(cat.id)} className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${selectedCategory===cat.id?'bg-interactive-soft text-interactive shadow-sm':'border border-line bg-surface text-secondary hover:text-ink'}`}><Filter className="h-3 w-3"/>{cat.label}</button>)}</div><div className="relative w-full md:w-72"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"/><input type="text" placeholder="Search news headline or summary..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} className="w-full rounded-xl border border-line bg-surface py-1.5 pl-9 pr-4 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"/></div></div>
    <div className="flex items-center justify-between text-[10px] font-semibold text-secondary"><span>{updatedAt?`Updated ${new Date(updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'Waiting for provider'}</span><span>{news.length} provider headlines loaded</span></div>
    {loading?<div className="space-y-3 py-16 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-success"/><p className="text-xs text-secondary">Fetching latest business news and images…</p></div>:filteredNews.length===0?<div className="space-y-3 rounded-2xl border border-line bg-surface p-12 text-center"><AlertCircle className="mx-auto h-8 w-8 text-secondary"/><p className="text-sm font-semibold text-secondary">No news articles found for this filter.</p><p className="text-xs text-secondary">{loadError||'Try another category or refresh the feed.'}</p></div>:<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{filteredNews.map((article)=><NewsCard key={article.id} article={article}/>)}</div>}
  </div>;
};
