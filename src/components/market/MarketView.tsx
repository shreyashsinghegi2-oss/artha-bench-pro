import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, DollarSign, Calculator, RefreshCw, BarChart2, Briefcase, Plus, Trash2 } from 'lucide-react';
import { fetchMarketOverview, fetchTickerQuote, calculateFinancialMetrics, fetchCompanyIntelligence } from '../../services/learningApi';
import { getPaperPortfolio, executePaperTrade, getWatchlist, saveWatchlist } from '../../services/learningStorage';
import { CompanyIntelligence } from '../../types';
import { SafetyBanner } from '../SafetyBanner';
import { CompanyIntelligencePanel } from './CompanyIntelligencePanel';

export const MarketView: React.FC = () => {
  const [marketQuotes, setMarketQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTicker, setSearchTicker] = useState('');
  const [searchedQuote, setSearchedQuote] = useState<any | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [companyIntelligence, setCompanyIntelligence] = useState<CompanyIntelligence | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  // Paper Trading State
  const [portfolio, setPortfolio] = useState(getPaperPortfolio());
  const [watchlist, setWatchlist] = useState<string[]>(getWatchlist());

  // Interactive Calculators State
  const [calcInput, setCalcInput] = useState({
    price: 150,
    earningsPerShare: 5.5,
    totalDebt: 500000,
    totalEquity: 1000000,
    cash: 200000,
    totalAssets: 2000000,
  });

  const [calcResult, setCalcResult] = useState<{
    peRatio: number;
    debtToEquity: number;
    quickRatio: number;
    interpretation: string;
  } | null>(null);

  useEffect(() => {
    loadOverview();
    loadCompanyIntelligence('AAPL');
  }, []);

  const loadCompanyIntelligence = async (symbol: string) => {
    setCompanyLoading(true);
    try {
      setCompanyIntelligence(await fetchCompanyIntelligence(symbol));
    } catch {
      setCompanyIntelligence(null);
    } finally {
      setCompanyLoading(false);
    }
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await fetchMarketOverview(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'SPY', 'QQQ']);
      setMarketQuotes(data);
    } catch (err) {
      console.error('Failed to load market overview:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTicker.trim()) return;
    setSearchError(null);
    setSearchedQuote(null);
    const normalizedSymbol = searchTicker.trim().toUpperCase();
    setCompanyLoading(true);

    const [quoteResult, companyResult] = await Promise.allSettled([
      fetchTickerQuote(normalizedSymbol),
      fetchCompanyIntelligence(normalizedSymbol),
    ]);

    if (quoteResult.status === 'fulfilled') setSearchedQuote(quoteResult.value);
    else setSearchError(`Ticker ${normalizedSymbol} not found or unavailable.`);

    setCompanyIntelligence(
      companyResult.status === 'fulfilled' ? companyResult.value : null,
    );
    setCompanyLoading(false);
  };

  const toggleWatchlist = (symbol: string) => {
    let updated: string[];
    if (watchlist.includes(symbol)) {
      updated = watchlist.filter((s) => s !== symbol);
    } else {
      updated = [...watchlist, symbol];
    }
    setWatchlist(updated);
    saveWatchlist(updated);
  };

  const handlePaperBuy = (symbol: string, name: string, price: number) => {
    const res = executePaperTrade(symbol, name, 'equity', 'buy', 10, price);
    if (!res.success) {
      alert(res.message);
      return;
    }
    setPortfolio(res.portfolio);
  };

  const handleRunCalculator = async () => {
    try {
      const res = await calculateFinancialMetrics(calcInput);
      setCalcResult(res);
    } catch (err) {
      console.error('Calculator error:', err);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-medium mb-2">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Educational Market Lab</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Financial Market Data & Simulation</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Practice market analysis using real-time quotes, virtual paper trading balances, and fundamental financial calculation models.
          </p>
        </div>

        <button
          onClick={loadOverview}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Quotes</span>
        </button>
      </div>

      <SafetyBanner />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Ticker Search, Market Overview & Paper Trading */}
        <div className="lg:col-span-2 space-y-8">
          {/* Search Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Lookup Financial Ticker</span>
            </h2>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter symbol (e.g. AAPL, NVDA, SPY)..."
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs rounded-xl transition-all"
              >
                Search
              </button>
            </form>

            {searchError && <p className="text-xs text-rose-400 mt-2">{searchError}</p>}

            {searchedQuote && (
              <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-sm">{searchedQuote.symbol}</span>
                    <span className="text-xs text-slate-400">{searchedQuote.name}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Currency: {searchedQuote.currency}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-slate-100">${searchedQuote.price.toFixed(2)}</div>
                  <div
                    className={`text-xs font-medium flex items-center justify-end gap-1 ${
                      searchedQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {searchedQuote.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{searchedQuote.changePercent.toFixed(2)}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWatchlist(searchedQuote.symbol)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700"
                  >
                    {watchlist.includes(searchedQuote.symbol) ? 'Remove Watch' : '+ Watchlist'}
                  </button>
                  <button
                    onClick={() => handlePaperBuy(searchedQuote.symbol, searchedQuote.name, searchedQuote.price)}
                    className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-800"
                  >
                    Paper Buy 10
                  </button>
                </div>
              </div>
            )}
          </div>

          <CompanyIntelligencePanel
            data={companyIntelligence}
            loading={companyLoading}
          />

          {/* Market Overview Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
              <span>Tracked Market Overview</span>
              <span className="text-xs text-slate-500">Live Simulation Data</span>
            </h2>

            {loading ? (
              <div className="text-center py-8 text-xs text-slate-500">Loading market prices...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {marketQuotes.map((q) => (
                  <div
                    key={q.symbol}
                    className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-xs">{q.symbol}</span>
                        <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{q.name}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-200 mt-1">${q.price.toFixed(2)}</div>
                    </div>

                    <div className="text-right space-y-2">
                      <div
                        className={`text-xs font-semibold flex items-center justify-end gap-1 ${
                          q.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {q.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{q.changePercent.toFixed(2)}%</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleWatchlist(q.symbol)}
                          className={`text-[10px] px-2 py-0.5 rounded ${
                            watchlist.includes(q.symbol)
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {watchlist.includes(q.symbol) ? 'Saved' : 'Watch'}
                        </button>

                        <button
                          onClick={() => handlePaperBuy(q.symbol, q.name, q.price)}
                          className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold"
                        >
                          Buy 10
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial Metrics Calculator */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <span>Financial Metrics & Valuation Calculator</span>
            </h2>

            <p className="text-xs text-slate-400 leading-relaxed">
              Input corporate financials below to compute key fundamental metrics: Price-to-Earnings (P/E), Debt-to-Equity, and Quick Ratio.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Stock Price ($)</label>
                <input
                  type="number"
                  value={calcInput.price}
                  onChange={(e) => setCalcInput({ ...calcInput, price: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">EPS ($)</label>
                <input
                  type="number"
                  value={calcInput.earningsPerShare}
                  onChange={(e) => setCalcInput({ ...calcInput, earningsPerShare: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Total Debt ($)</label>
                <input
                  type="number"
                  value={calcInput.totalDebt}
                  onChange={(e) => setCalcInput({ ...calcInput, totalDebt: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Total Equity ($)</label>
                <input
                  type="number"
                  value={calcInput.totalEquity}
                  onChange={(e) => setCalcInput({ ...calcInput, totalEquity: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Cash & Equivalents ($)</label>
                <input
                  type="number"
                  value={calcInput.cash}
                  onChange={(e) => setCalcInput({ ...calcInput, cash: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Total Assets ($)</label>
                <input
                  type="number"
                  value={calcInput.totalAssets}
                  onChange={(e) => setCalcInput({ ...calcInput, totalAssets: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                />
              </div>
            </div>

            <button
              onClick={handleRunCalculator}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all"
            >
              Calculate Financial Ratios
            </button>

            {calcResult && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">P/E Ratio</div>
                    <div className="font-bold text-emerald-400 mt-0.5">{calcResult.peRatio.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Debt to Equity</div>
                    <div className="font-bold text-emerald-400 mt-0.5">{calcResult.debtToEquity.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Quick Ratio</div>
                    <div className="font-bold text-emerald-400 mt-0.5">{calcResult.quickRatio.toFixed(2)}</div>
                  </div>
                </div>

                <div className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <span className="font-bold text-slate-200 block mb-1">Educational Assessment:</span>
                  {calcResult.interpretation}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Paper Trading Portfolio & Watchlist */}
        <div className="space-y-8">
          {/* Paper Portfolio Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <span>Paper Trading Sandbox</span>
              </h2>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Risk-Free</span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Virtual Balance</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  ${portfolio.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-slate-800" />
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-300">Simulated Positions</h3>

              {portfolio.positions.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No paper positions yet. Buy tickers from quotes!</p>
              ) : (
                <div className="space-y-2">
                  {portfolio.positions.map((p) => (
                    <div
                      key={p.symbol}
                      className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200">{p.symbol}</div>
                        <div className="text-[10px] text-slate-500">{p.quantity} shares @ ${p.averageCost.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-300">
                          ${(p.quantity * p.averageCost).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Watchlist */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Personal Watchlist</h2>

            {watchlist.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Watchlist is empty. Click "+ Watchlist" on tickers.</p>
            ) : (
              <div className="space-y-2">
                {watchlist.map((sym) => (
                  <div
                    key={sym}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-200">{sym}</span>
                    <button
                      onClick={() => toggleWatchlist(sym)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
