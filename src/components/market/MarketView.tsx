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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-line p-6 rounded-2xl shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-success-soft/60 border border-success-fill/60 text-success text-xs font-medium mb-2">
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Educational Market Lab</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">Financial Market Data & Simulation</h1>
          <p className="text-xs text-secondary mt-1 max-w-2xl leading-relaxed">
            Practice market analysis using provider-labelled quotes, virtual paper trading balances, and fundamental financial calculation models.
          </p>
        </div>

        <button
          onClick={loadOverview}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-hover hover:bg-hover text-ink text-xs font-semibold rounded-xl border border-line-strong transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Quotes</span>
        </button>
      </div>

      <SafetyBanner />

      <div className="bg-surface border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-interactive" />
              <span>Company Intelligence Search</span>
            </h2>
            <p className="text-[11px] text-secondary mb-3">
              Load a provider-labelled quote, Finnhub fundamentals, earnings, analyst trends, charts, and grounded AI explanation.
            </p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter AAPL or an Indian ticker such as RELIANCE:NSE or SBIN:NSE"
                value={searchTicker}
                onChange={(e) => setSearchTicker(e.target.value)}
                className="flex-1 bg-surface border border-line rounded-xl px-4 py-2.5 text-xs text-ink placeholder:text-secondary focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive uppercase"
              />
              <button
                type="submit"
                disabled={companyLoading}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-60 text-brand-foreground hover:text-white font-bold text-xs rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
              >
                Analyze Company
              </button>
            </form>
            {searchError && <p className="text-xs text-danger mt-2">{searchError}</p>}
          </div>

          {searchedQuote && (
            <div className="min-w-[280px] p-3.5 bg-surface border border-line rounded-xl flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink text-sm">{searchedQuote.symbol}</span>
                  <span className="text-[10px] text-secondary truncate max-w-28">{searchedQuote.name}</span>
                </div>
                <div className="text-lg font-extrabold text-ink mt-1">
                  ${searchedQuote.price.toFixed(2)}
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className={`text-xs font-bold flex items-center justify-end gap-1 ${searchedQuote.change >= 0 ? 'text-success' : 'text-danger'}`}>
                  {searchedQuote.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {searchedQuote.changePercent.toFixed(2)}%
                </div>
                <button
                  onClick={() => toggleWatchlist(searchedQuote.symbol)}
                  className="px-2.5 py-1 bg-hover text-secondary text-[10px] rounded-lg border border-line-strong"
                >
                  {watchlist.includes(searchedQuote.symbol) ? 'Remove watch' : '+ Watchlist'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CompanyIntelligencePanel
        data={companyIntelligence}
        loading={companyLoading}
      />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Market Overview & Financial Tools */}
        <div className="lg:col-span-2 space-y-8">
          {/* Market Overview Grid */}
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-ink flex items-center justify-between">
              <span>Tracked Market Overview</span>
              <span className="text-xs text-secondary">Live Simulation Data</span>
            </h2>

            {loading ? (
              <div className="text-center py-8 text-xs text-secondary">Loading market prices...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {marketQuotes.map((q) => (
                  <div
                    key={q.symbol}
                    className="p-4 bg-surface border border-line/80 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink text-xs">{q.symbol}</span>
                        <span className="text-[10px] text-secondary truncate max-w-[100px]">{q.name}</span>
                      </div>
                      <div className="text-sm font-bold text-ink mt-1">${q.price.toFixed(2)}</div>
                    </div>

                    <div className="text-right space-y-2">
                      <div
                        className={`text-xs font-semibold flex items-center justify-end gap-1 ${
                          q.change >= 0 ? 'text-success' : 'text-danger'
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
                              ? 'bg-warning-soft/80 text-warning border border-warning-fill/60'
                              : 'bg-hover text-secondary'
                          }`}
                        >
                          {watchlist.includes(q.symbol) ? 'Saved' : 'Watch'}
                        </button>

                        <button
                          onClick={() => handlePaperBuy(q.symbol, q.name, q.price)}
                          className="text-[10px] px-2 py-0.5 rounded bg-success-soft text-success border border-success-fill/60 font-semibold"
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
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
              <Calculator className="w-4 h-4 text-success" />
              <span>Financial Metrics & Valuation Calculator</span>
            </h2>

            <p className="text-xs text-secondary leading-relaxed">
              Input corporate financials below to compute key fundamental metrics: Price-to-Earnings (P/E), Debt-to-Equity, and Quick Ratio.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-secondary block mb-1">Stock Price ($)</label>
                <input
                  type="number"
                  value={calcInput.price}
                  onChange={(e) => setCalcInput({ ...calcInput, price: Number(e.target.value) })}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-[10px] text-secondary block mb-1">EPS ($)</label>
                <input
                  type="number"
                  value={calcInput.earningsPerShare}
                  onChange={(e) => setCalcInput({ ...calcInput, earningsPerShare: Number(e.target.value) })}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-[10px] text-secondary block mb-1">Total Debt ($)</label>
                <input
                  type="number"
                  value={calcInput.totalDebt}
                  onChange={(e) => setCalcInput({ ...calcInput, totalDebt: Number(e.target.value) })}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-[10px] text-secondary block mb-1">Total Equity ($)</label>
                <input
                  type="number"
                  value={calcInput.totalEquity}
                  onChange={(e) => setCalcInput({ ...calcInput, totalEquity: Number(e.target.value) })}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-[10px] text-secondary block mb-1">Cash & Equivalents ($)</label>
                <input
                  type="number"
                  value={calcInput.cash}
                  onChange={(e) => setCalcInput({ ...calcInput, cash: Number(e.target.value) })}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
                />
              </div>

              <div>
                <label className="text-[10px] text-secondary block mb-1">Total Assets ($)</label>
                <input
                  type="number"
                  value={calcInput.totalAssets}
                  onChange={(e) => setCalcInput({ ...calcInput, totalAssets: Number(e.target.value) })}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink"
                />
              </div>
            </div>

            <button
              onClick={handleRunCalculator}
              className="w-full py-2 bg-brand hover:bg-brand-hover text-brand-foreground hover:text-white font-bold text-xs rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
            >
              Calculate Financial Ratios
            </button>

            {calcResult && (
              <div className="p-4 bg-surface border border-line rounded-xl space-y-3 text-xs">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-subtle p-2 rounded-lg border border-line">
                    <div className="text-[10px] text-secondary">P/E Ratio</div>
                    <div className="font-bold text-success mt-0.5">{calcResult.peRatio.toFixed(2)}</div>
                  </div>
                  <div className="bg-subtle p-2 rounded-lg border border-line">
                    <div className="text-[10px] text-secondary">Debt to Equity</div>
                    <div className="font-bold text-success mt-0.5">{calcResult.debtToEquity.toFixed(2)}</div>
                  </div>
                  <div className="bg-subtle p-2 rounded-lg border border-line">
                    <div className="text-[10px] text-secondary">Quick Ratio</div>
                    <div className="font-bold text-success mt-0.5">{calcResult.quickRatio.toFixed(2)}</div>
                  </div>
                </div>

                <div className="text-secondary leading-relaxed bg-subtle/60 p-3 rounded-lg border border-line">
                  <span className="font-bold text-ink block mb-1">Educational Assessment:</span>
                  {calcResult.interpretation}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Paper Trading Portfolio & Watchlist */}
        <div className="space-y-8">
          {/* Paper Portfolio Box */}
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-success" />
                <span>Paper Trading Sandbox</span>
              </h2>
              <span className="text-[10px] text-secondary bg-hover px-2 py-0.5 rounded">Risk-Free</span>
            </div>

            <div className="bg-surface border border-line p-4 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-secondary uppercase tracking-wider">Virtual Balance</div>
                <div className="text-lg font-bold text-success mt-0.5">
                  ${portfolio.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-ink" />
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-ink">Simulated Positions</h3>

              {portfolio.positions.length === 0 ? (
                <p className="text-xs text-secondary py-4 text-center">No paper positions yet. Buy tickers from quotes!</p>
              ) : (
                <div className="space-y-2">
                  {portfolio.positions.map((p) => (
                    <div
                      key={p.symbol}
                      className="p-3 bg-surface border border-line/80 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-ink">{p.symbol}</div>
                        <div className="text-[10px] text-secondary">{p.quantity} shares @ ${p.averageCost.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-secondary">
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
          <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-ink">Personal Watchlist</h2>

            {watchlist.length === 0 ? (
              <p className="text-xs text-secondary py-4 text-center">Watchlist is empty. Click "+ Watchlist" on tickers.</p>
            ) : (
              <div className="space-y-2">
                {watchlist.map((sym) => (
                  <div
                    key={sym}
                    className="p-3 bg-surface border border-line rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-ink">{sym}</span>
                    <button
                      onClick={() => toggleWatchlist(sym)}
                      className="text-secondary hover:text-danger transition-colors p-1"
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
