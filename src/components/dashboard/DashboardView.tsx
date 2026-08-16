import React, { useState, useEffect } from 'react';
import {
  Zap,
  FlaskConical,
  MessageSquare,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  LineChart,
  Newspaper,
  ShieldCheck,
  Bot,
  Activity,
  Layers
} from 'lucide-react';
import { EconomicIndicator, NavigationDestination, ProviderDiagnostic } from '../../types';
import { BentoCard } from '../BentoCard';
import { SafetyBanner } from '../SafetyBanner';
import { getOverallProgressPercentage, getPaperPortfolio } from '../../services/learningStorage';
import { fetchBusinessNews, fetchEconomicOverview, fetchMarketOverview } from '../../services/learningApi';

interface DashboardViewProps {
  onNavigate: (destination: NavigationDestination) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [progress, setProgress] = useState(0);
  const [portfolioBalance, setPortfolioBalance] = useState(100000);
  const [topNews, setTopNews] = useState<any[]>([]);
  const [topQuotes, setTopQuotes] = useState<any[]>([]);
  const [economicIndicators, setEconomicIndicators] = useState<EconomicIndicator[]>([]);
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setProgress(getOverallProgressPercentage());
    const port = getPaperPortfolio();
    setPortfolioBalance(port.cashBalance);

    fetchBusinessNews()
      .then((items) => setTopNews(Array.isArray(items) ? items.slice(0, 2) : []))
      .catch(() => setTopNews([]));

    fetchMarketOverview(['AAPL', 'NVDA', 'SPY'])
      .then((quotes) => setTopQuotes(Array.isArray(quotes) ? quotes : []))
      .catch(() => setTopQuotes([]));

    fetchEconomicOverview()
      .then((indicators) => setEconomicIndicators(indicators.slice(0, 5)))
      .catch(() => setEconomicIndicators([]));

    fetch('/api/diagnostics')
      .then((res) => res.json())
      .then((data) => {
        if (data.modelsConfig?.primaryModel) {
          setGroqModel(data.modelsConfig.primaryModel);
        }
        if (Array.isArray(data.diagnostics)) {
          const primary = data.diagnostics.find((d: ProviderDiagnostic) => d.id === 'groq-primary');
          setIsConnected(primary?.status === 'connected');
        }
      })
      .catch(() => {});
  }, []);

  const reliabilityDimensions = [
    {
      weight: '25%',
      title: 'Numerical Accuracy',
      desc: 'Verifies exact mathematical formula output using deterministic calculations.',
      color: 'text-[#665CFF]',
    },
    {
      weight: '20%',
      title: 'Safety & Risk Awareness',
      desc: 'Detects non-advisory violations, guaranteed profit claims, and risk disclaimers.',
      color: 'text-[#FF3B65]',
    },
    {
      weight: '15%',
      title: 'Reasoning Consistency',
      desc: 'Evaluates logical coherence, step-by-step clarity, and assumption transparency.',
      color: 'text-[#16C7E8]',
    },
    {
      weight: '10%',
      title: 'Localization Accuracy',
      desc: 'Validates tax codes, currency units, and jurisdiction-specific financial rules.',
      color: 'text-[#7137F2]',
    },
    {
      weight: '10%',
      title: 'Source Verification',
      desc: 'Cross-references regulatory frameworks like SEC, CFPB, and IRS guidelines.',
      color: 'text-[#665CFF]',
    },
    {
      weight: '10%',
      title: 'Dual-Model Consensus',
      desc: 'Measures structural and formula agreement between primary and secondary AI evaluators.',
      color: 'text-[#00D68F]',
    },
    {
      weight: '10%',
      title: 'Prompt Injection Resistance',
      desc: 'Tests system prompt defense and resistance to malicious adversarial inputs.',
      color: 'text-[#F5B800]',
    },
  ];

  return (
    <div className="space-y-10 max-w-[1700px] mx-auto px-4 py-8">
      {/* Top Hero Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Hero Card */}
        <div className="lg:col-span-7 hero-gradient rounded-[28px] p-8 sm:p-10 border border-[#665CFF]/30 flex flex-col justify-between shadow-2xl purple-glow relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur border border-white/20 rounded-full text-white/90 text-[11px] font-bold uppercase tracking-wider">
              EVALUATION & RELIABILITY BENCHMARK
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
              Measuring Trust in AI Financial Intelligence
            </h1>

            <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
              Artha Bench evaluates AI-generated personal finance answers across 7 core reliability dimensions using deterministic math checks, authoritative regulatory evidence, and dual Groq model consensus.
            </p>

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                onClick={() => onNavigate('quick-check')}
                className="px-6 py-3 bg-white text-[#21118A] hover:bg-slate-100 font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-black/20"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Run Quick Check</span>
              </button>

              <button
                onClick={() => onNavigate('evaluation-lab')}
                className="px-6 py-3 bg-[#4F32FF]/40 hover:bg-[#4F32FF]/60 text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/30 flex items-center gap-2 transition-all"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Open Evaluation Lab</span>
              </button>

              <button
                onClick={() => onNavigate('tutor')}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/20 flex items-center gap-2 transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Learn with Financial Tutor</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 2x2 Grid Information Cards */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Groq Engine */}
          <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#665CFF]/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#4F32FF]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#4F32FF]/10 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-9 h-9 rounded-xl bg-[#4F32FF]/15 border border-[#4F32FF]/30 flex items-center justify-center text-[#665CFF] group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border tracking-wide uppercase ${
                  isConnected
                    ? 'bg-[#00D68F]/10 text-[#00D68F] border-[#00D68F]/30 shadow-sm shadow-[#00D68F]/10'
                    : 'bg-[#F5B800]/10 text-[#F5B800] border-[#F5B800]/30'
                }`}
              >
                {isConnected ? '● Active' : '○ Demo Mode'}
              </span>
            </div>
            <div className="relative z-10 space-y-1">
              <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider block">
                DUAL MODEL GROQ ENGINE
              </span>
              <h3 className="text-base font-bold text-[#F7F7FB] font-mono truncate tracking-tight">{groqModel}</h3>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#665CFF]" />
                <p className="text-[11px] text-[#9A9AAA]">Cross-check: llama-3.1-8b-instant</p>
              </div>
            </div>
          </div>

          {/* Card 2: Deterministic Engine */}
          <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#00D68F]/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D68F]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#00D68F]/10 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <div className="w-9 h-9 rounded-xl bg-[#00D68F]/15 border border-[#00D68F]/30 flex items-center justify-center text-[#00D68F] group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#00D68F]/10 text-[#00D68F] border border-[#00D68F]/30 tracking-wide uppercase shadow-sm shadow-[#00D68F]/10">
                ● Verified
              </span>
            </div>
            <div className="relative z-10 space-y-1">
              <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider block">
                DETERMINISTIC MATH ENGINE
              </span>
              <h3 className="text-base font-bold text-[#F7F7FB] tracking-tight">Decimal.js v2.0</h3>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D68F]" />
                <p className="text-[11px] text-[#9A9AAA]">5 Precision Financial Formulas</p>
              </div>
            </div>
          </div>

          {/* Card 3: Creator Platform Info */}
          <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#F5B800]/50 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#F5B800] to-amber-600 font-extrabold text-[#030303] flex items-center justify-center text-xs shadow-md shrink-0">
                SS
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#F7F7FB] tracking-tight">Shreyash Singh</h4>
                <p className="text-[10px] font-medium text-[#8A8A9E]">Creator & Lead Architect</p>
              </div>
            </div>
            <p className="text-[11px] text-[#9A9AAA] leading-relaxed relative z-10">
              Artha Bench eliminates financial AI hallucinations and enforces strict non-advisory safety guardrails.
            </p>
          </div>

          {/* Card 4: Research Disclaimer */}
          <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#FF3B65]/50 rounded-2xl p-5 flex flex-col justify-between space-y-2.5 shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-center gap-2 text-[#F5B800] relative z-10">
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#F5B800]" />
              <span className="text-[10px] font-bold uppercase tracking-wider">RESEARCH BENCHMARK</span>
            </div>
            <p className="text-[11px] text-[#9A9AAA] leading-relaxed relative z-10">
              Artha Bench is a <strong className="text-[#F7F7FB] font-medium">reliability framework</strong>. It does not provide certified financial, legal, or investment advice.
            </p>
          </div>
        </div>
      </div>

      {/* The 7 Dimensions of Financial AI Reliability */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1A1A23] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#F7F7FB] tracking-tight">The 7 Dimensions of Financial AI Reliability</h2>
            <p className="text-xs text-[#9A9AAA]">Every response is evaluated against rigorous multi-metric criteria</p>
          </div>
          <button
            onClick={() => onNavigate('methodology')}
            className="text-xs font-semibold text-[#665CFF] hover:text-[#7137F2] flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            <span>Read Methodology</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reliabilityDimensions.map((dim, idx) => (
            <div
              key={idx}
              className="bg-[#08080E] border border-[#1A1A23] rounded-2xl p-5 hover:border-[#4F32FF]/50 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className={`text-xl font-extrabold ${dim.color}`}>{dim.weight}</span>
                <span className="text-[10px] text-[#9A9AAA] font-mono">DIM-{idx + 1}</span>
              </div>
              <h3 className="text-sm font-bold text-[#F7F7FB]">{dim.title}</h3>
              <p className="text-xs text-[#9A9AAA] leading-relaxed">{dim.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <SafetyBanner />

      {/* Feature Bento Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Structured Learning */}
        <BentoCard
          title="Structured Learning Tracks"
          subtitle="Interactive modules with instant AI feedback"
          icon={<BookOpen className="w-5 h-5 text-[#665CFF]" />}
          badge="Educational"
          badgeColor="cyan"
          onClick={() => onNavigate('learning')}
        >
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex items-center justify-between text-xs text-[#9A9AAA] mb-1">
                <span>Overall Track Completion</span>
                <span className="font-bold text-[#665CFF]">{progress}%</span>
              </div>
              <div className="w-full bg-[#030303] rounded-full h-2 overflow-hidden border border-[#1A1A23]">
                <div
                  className="bg-[#4F32FF] h-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-[#9A9AAA] leading-relaxed">
              Explore tracks in Valuation, Corporate Finance, Risk Management, and Financial Accounting.
            </p>
          </div>
        </BentoCard>

        {/* Card 2: Market & Paper Sandbox */}
        <BentoCard
          title="Market Data & Paper Sandbox"
          subtitle="Real-time quotes and virtual portfolio testing"
          icon={<LineChart className="w-5 h-5 text-[#16C7E8]" />}
          badge="Simulated"
          badgeColor="cyan"
          onClick={() => onNavigate('markets')}
        >
          <div className="space-y-3 mt-2">
            <div className="flex items-center justify-between p-3 bg-[#030303] border border-[#1A1A23] rounded-xl text-xs">
              <span className="text-[#9A9AAA]">Paper Balance</span>
              <span className="font-bold text-[#00D68F]">
                ${portfolioBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {topQuotes.length > 0 && (
              <div className="space-y-1.5">
                {topQuotes.map((q) => (
                  <div key={q.symbol} className="flex items-center justify-between text-xs text-[#F7F7FB]">
                    <span className="font-semibold">{q.symbol}</span>
                    <span className="text-[#9A9AAA]">${q.price.toFixed(2)}</span>
                    <span className={q.change >= 0 ? 'text-[#00D68F] font-medium' : 'text-[#FF3B65] font-medium'}>
                      {q.changePercent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </BentoCard>

        {/* Card 3: Business News Feed */}
        <BentoCard
          title="Business News Feed"
          subtitle="Educational AI breakdowns for market news"
          icon={<Newspaper className="w-5 h-5 text-[#665CFF]" />}
          badge="Feed"
          badgeColor="cyan"
          onClick={() => onNavigate('news')}
        >
          <div className="space-y-3 mt-2">
            {topNews.length > 0 ? (
              topNews.map((n) => (
                <div key={n.id} className="p-3 bg-[#030303] border border-[#1A1A23] rounded-xl space-y-1">
                  <span className="text-[10px] text-[#665CFF] font-semibold">{n.sourceName}</span>
                  <h4 className="text-xs font-semibold text-[#F7F7FB] line-clamp-1">{n.title}</h4>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#9A9AAA]">Loading business news preview...</p>
            )}
          </div>
        </BentoCard>

        {/* Card 4: Prompt Safety Validator */}
        <BentoCard
          title="Prompt Safety Validator"
          subtitle="Detect financial advice traps & injection risks"
          icon={<ShieldCheck className="w-5 h-5 text-[#665CFF]" />}
          badge="Defense Layer"
          badgeColor="cyan"
          onClick={() => onNavigate('quick-check')}
        >
          <div className="space-y-2 mt-2 text-xs text-[#9A9AAA]">
            <p className="leading-relaxed">
              Test any prompt against non-advisory safety rules before deployment or user inquiry.
            </p>
            <div className="flex items-center gap-1.5 text-[#665CFF] font-semibold">
              <span>Run Quick Check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </BentoCard>

        {/* Card 5: Financial Tutor */}
        <BentoCard
          title="ArthaBench AI Tutor"
          subtitle="Non-advisory tutoring for corporate finance"
          icon={<Bot className="w-5 h-5 text-[#665CFF]" />}
          badge="AI Powered"
          badgeColor="cyan"
          onClick={() => onNavigate('tutor')}
        >
          <div className="space-y-2 mt-2 text-xs text-[#9A9AAA]">
            <p className="leading-relaxed">
              Ask deep questions about formulas, market mechanics, and accounting principles.
            </p>
            <div className="flex items-center gap-1.5 text-[#665CFF] font-semibold">
              <span>Start Conversation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </BentoCard>

        {/* Card 6: United States and India Economic Dashboard */}
        <BentoCard
          title="US & India Economic Dashboard"
          subtitle="Official indicators from FRED and the World Bank"
          icon={<Activity className="w-5 h-5 text-[#00D68F]" />}
          badge={economicIndicators.some((item) => item.status === 'connected') ? 'Live Data' : 'Connecting'}
          badgeColor={economicIndicators.some((item) => item.status === 'connected') ? 'emerald' : 'amber'}
          onClick={() => onNavigate('economy')}
        >
          <div className="space-y-2 mt-2">
            {economicIndicators.length > 0 ? (
              economicIndicators.map((indicator) => (
                <div
                  key={indicator.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-[#9A9AAA] truncate">{indicator.label}</span>
                  <span className="font-semibold text-[#F7F7FB] whitespace-nowrap">
                    {indicator.value === null ? '—' : indicator.value.toLocaleString()}{' '}
                    <span className="text-[10px] text-[#8A8A9E]">{indicator.unit}</span>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#9A9AAA]">Loading economic indicators...</p>
            )}
            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#665CFF] pt-1">
              <span>Open full US & India dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
};
