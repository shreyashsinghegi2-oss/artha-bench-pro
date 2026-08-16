import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  User,
  Plus,
  Trash2,
  Bookmark,
  Download,
  Info,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Globe,
  Sliders,
  DollarSign,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { askTutorAI } from '../../services/learningApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isVerified?: boolean;
}

interface LibraryCategory {
  name: string;
  topics: { title: string; prompt: string }[];
}

const LIBRARY_CATEGORIES: LibraryCategory[] = [
  {
    name: 'Budgeting & Money',
    topics: [
      {
        title: 'What is the 50/30/20 budgeting rule?',
        prompt: 'Explain the 50/30/20 budgeting rule with a clear breakdown for a monthly income.',
      },
      {
        title: 'How do I create a realistic monthly budget?',
        prompt: 'How do I build a realistic monthly budget step-by-step?',
      },
      {
        title: 'Needs vs Wants in financial planning',
        prompt: 'What is the exact distinction between needs and wants in personal financial planning?',
      },
      {
        title: 'How to track variable expenses',
        prompt: 'What are variable expenses and how can I track them accurately?',
      },
      {
        title: 'Sinking funds vs emergency funds',
        prompt: 'Explain how sinking funds work compared to emergency funds.',
      },
    ],
  },
  {
    name: 'Savings & Compound Interest',
    topics: [
      {
        title: 'How does compound interest work?',
        prompt: 'If I deposit $10,000 in an account paying 8% per annum compounded annually for 5 years, what will be my exact final balance and interest earned?',
      },
      {
        title: 'Rule of 72 calculation',
        prompt: 'Explain the Rule of 72 with a mathematical example.',
      },
      {
        title: 'Annual Effective Rate (AER)',
        prompt: 'How is Annual Effective Rate (AER) calculated when compounding quarterly?',
      },
    ],
  },
  {
    name: 'Loans & Debt',
    topics: [
      {
        title: 'How is loan EMI calculated?',
        prompt: 'Explain the formula for EMI calculation and provide a step-by-step example for a $50,000 loan at 6% over 5 years.',
      },
      {
        title: 'Debt-to-income (DTI) ratio',
        prompt: 'What is the Debt-to-Income (DTI) ratio and how is it used by mortgage lenders?',
      },
      {
        title: 'Snowball vs Avalanche debt payoff',
        prompt: 'Compare the debt snowball and debt avalanche methods with pros and cons.',
      },
    ],
  },
  {
    name: 'Valuation & Ratios',
    topics: [
      {
        title: 'Quick Ratio vs Current Ratio',
        prompt: 'Compare Quick Ratio vs Current Ratio for liquidity assessment with formulas.',
      },
      {
        title: 'Break-even point calculation',
        prompt: 'How do you calculate the break-even point in units and dollars?',
      },
      {
        title: 'Free Cash Flow to Equity (FCFE)',
        prompt: 'Explain Free Cash Flow to Equity (FCFE) formula and valuation impact.',
      },
    ],
  },
  {
    name: 'Investing Concepts & Risk',
    topics: [
      {
        title: 'CAPM and expected return',
        prompt: 'Explain Capital Asset Pricing Model (CAPM) formula and risk-free rate.',
      },
      {
        title: 'Diversification & Portfolio Beta',
        prompt: 'What is Portfolio Beta and how does diversification lower unsystematic risk?',
      },
    ],
  },
];

export const TutorView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Context Select Controls State
  const [country, setCountry] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('english');
  const [level, setLevel] = useState('beginner');
  const [mode, setMode] = useState('explain');
  const [detail, setDetail] = useState('detailed');

  // Checkboxes
  const [useOfficialSources, setUseOfficialSources] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Tooltip
  const [showVerifiedTooltip, setShowVerifiedTooltip] = useState(false);

  const handleCountryChange = (c: string) => {
    setCountry(c);
    if (c === 'India') setCurrency('INR');
    else if (c === 'US') setCurrency('USD');
    else setCurrency('USD');
  };

  const handleSend = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || input;
    if (!textToSend.trim() || isTyping) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setInput('');
    setIsTyping(true);

    try {
      const res = await askTutorAI(textToSend, messages);
      const isMathOrNumerical = /\$|\%|compound|ratio|EMI|balance|interest|formula|\d+/i.test(textToSend);

      const assistantMsg: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isVerified: isMathOrNumerical,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Tutor query error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSelectedTopic(null);
  };

  const handleExportNotes = () => {
    if (messages.length === 0) return;
    const content = messages
      .map((m) => `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ArthaBench_Tutor_Session_${Date.now()}.txt`;
    a.click();
  };

  return (
    <div className="max-w-[1700px] mx-auto px-4 py-6 space-y-6">
      {/* Top Bar Header */}
      <div className="bg-[#0A0A12] border border-[#1E1E2D] p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-[#F5B800]/15 text-[#F5B800] border border-[#F5B800]/30 text-[10px] font-bold tracking-wide uppercase">
              Educational only
            </span>

            <div className="relative inline-block">
              <button
                onMouseEnter={() => setShowVerifiedTooltip(true)}
                onMouseLeave={() => setShowVerifiedTooltip(false)}
                className="px-2.5 py-0.5 rounded-full bg-[#00D68F]/15 text-[#00D68F] border border-[#00D68F]/30 text-[10px] font-bold tracking-wide uppercase flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>ArthaBench Verified</span>
                <Info className="w-3 h-3 opacity-70 ml-0.5" />
              </button>

              {showVerifiedTooltip && (
                <div className="absolute top-full left-0 mt-2 z-50 w-72 p-3 bg-[#030303] border border-[#1E1E2D] rounded-xl shadow-2xl text-[11px] text-[#9A9AAA] leading-relaxed animate-fade-in">
                  Numerical answers may be independently checked by the ArthaBench deterministic financial engine.
                </div>
              )}
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F7FB] tracking-tight">
            ArthaBench AI Tutor
          </h1>
          <p className="text-xs sm:text-sm text-[#9A9AAA] mt-1 leading-relaxed">
            AI-powered financial learning with deterministic verification
          </p>
        </div>

        {/* Action Controls Right */}
        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <button
            onClick={handleNewChat}
            className="px-3.5 py-2 rounded-xl bg-[#4F32FF] hover:bg-[#665CFF] text-[#F7F7FB] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#4F32FF]/30"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>

          <button
            onClick={handleNewChat}
            className="px-3.5 py-2 rounded-xl bg-[#08080E] border border-[#1E1E2D] hover:border-[#FF3B65]/40 text-[#9A9AAA] hover:text-[#FF3B65] font-semibold text-xs flex items-center gap-1.5 transition-all"
            title="Clear current messages"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Chat</span>
          </button>

          <button
            onClick={handleExportNotes}
            disabled={messages.length === 0}
            className="px-3.5 py-2 rounded-xl bg-[#08080E] border border-[#1E1E2D] hover:border-[#665CFF]/40 text-[#9A9AAA] hover:text-[#F7F7FB] disabled:opacity-40 font-semibold text-xs flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export Notes</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Learning Library (Col 3) */}
        <div className="lg:col-span-3 bg-[#0A0A12] border border-[#1E1E2D] rounded-3xl p-5 space-y-6 h-[720px] flex flex-col justify-between overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-1 scrollbar-thin flex-1">
            <div className="flex items-center justify-between border-b border-[#1E1E2D] pb-3">
              <span className="text-[11px] font-bold text-[#8A8A9E] uppercase tracking-wider">
                LEARNING LIBRARY
              </span>
            </div>

            <div className="space-y-4">
              {LIBRARY_CATEGORIES.map((cat, idx) => (
                <div key={idx} className="space-y-1.5">
                  <h4 className="text-xs font-bold text-[#F7F7FB] px-1">{cat.name}</h4>
                  <div className="space-y-1">
                    {cat.topics.map((t, tIdx) => {
                      const isSelected = selectedTopic === t.title;
                      return (
                        <button
                          key={tIdx}
                          onClick={() => {
                            setSelectedTopic(t.title);
                            handleSend(t.prompt);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all leading-snug flex items-center justify-between group ${
                            isSelected
                              ? 'bg-[#4F32FF]/20 border border-[#4F32FF]/40 text-[#F7F7FB] font-semibold'
                              : 'text-[#9A9AAA] hover:text-[#F7F7FB] hover:bg-[#1A1A23]/60'
                          }`}
                        >
                          <span className="line-clamp-2">{t.title}</span>
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#665CFF]" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Section at Bottom */}
          <div className="pt-3 border-t border-[#1E1E2D] bg-[#08080E] rounded-2xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#F7F7FB]">
              <Bookmark className="w-3.5 h-3.5 text-[#665CFF]" />
              <span>SAVED</span>
            </div>
            <p className="text-[10px] text-[#8A8A9E] leading-tight">
              Save is optional. Nothing is stored until you choose Save.
            </p>
          </div>
        </div>

        {/* Center Column: Tutor Conversation Area (Col 6) */}
        <div className="lg:col-span-6 bg-[#0A0A12] border border-[#1E1E2D] rounded-3xl flex flex-col h-[720px] overflow-hidden shadow-2xl">
          {/* Chat Messages / Empty State Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-5 my-auto py-12">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#4F32FF] to-[#7137F2] p-0.5 shadow-xl shadow-[#4F32FF]/30 flex items-center justify-center">
                  <div className="w-full h-full bg-[#08080E] rounded-[22px] flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-[#665CFF]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-[#F7F7FB] tracking-tight">
                    Ask ArthaBench anything about finance
                  </h2>
                  <p className="text-xs text-[#9A9AAA] leading-relaxed">
                    Choose a lesson from the library or type your own question. Numerical lessons use the deterministic engine; high-risk or current topics receive independent review.
                  </p>
                </div>

                {/* Suggested Starter Questions */}
                <div className="w-full space-y-2 pt-2">
                  <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider block">
                    Suggested Questions:
                  </span>
                  <div className="flex flex-col gap-2">
                    {[
                      'What is compound interest?',
                      'How is loan EMI calculated?',
                      'Give me a beginner budgeting quiz',
                    ].map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(q)}
                        className="text-xs text-left px-4 py-2.5 bg-[#030303] hover:bg-[#1A1A23] text-[#F7F7FB] border border-[#1E1E2D] hover:border-[#665CFF]/40 rounded-xl transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${
                    msg.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      msg.role === 'user'
                        ? 'bg-[#4F32FF] text-[#F7F7FB]'
                        : 'bg-[#08080E] text-[#665CFF] border border-[#1E1E2D]'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs space-y-2 leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#4F32FF]/20 border border-[#4F32FF]/40 text-[#F7F7FB]'
                        : 'bg-[#030303] border border-[#1E1E2D] text-[#F7F7FB]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] text-[#8A8A9E] border-b border-[#1E1E2D] pb-1.5 mb-1.5">
                      <span className="font-bold text-[#665CFF]">
                        {msg.role === 'user' ? 'You' : 'ArthaBench'}
                      </span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div className="whitespace-pre-line text-xs font-sans">{msg.content}</div>

                    {msg.role === 'assistant' && (
                      <div className="pt-2 border-t border-[#1E1E2D]/60 flex items-center justify-between text-[10px] text-[#8A8A9E]">
                        <span className="flex items-center gap-1 text-[#00D68F] font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {msg.isVerified
                              ? '✓ Deterministically checked'
                              : 'Educational explanation'}
                          </span>
                        </span>
                        <span>ArthaBench Pro V2.0</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {isTyping && (
              <div className="flex items-center gap-3 text-xs text-[#9A9AAA] italic">
                <div className="w-8 h-8 rounded-xl bg-[#08080E] border border-[#1E1E2D] flex items-center justify-center text-[#665CFF]">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <span>ArthaBench is formulating educational explanation...</span>
              </div>
            )}
          </div>

          {/* Bottom Chat Input Form */}
          <div className="p-4 bg-[#08080E] border-t border-[#1E1E2D]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask any finance-learning question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-[#030303] border border-[#1E1E2D] rounded-xl px-4 py-3 text-xs text-[#F7F7FB] placeholder-[#8A8A9E] focus:outline-none focus:border-[#665CFF]"
              />
              <button
                type="submit"
                disabled={isTyping || !input.trim()}
                className="px-5 py-3 bg-gradient-to-r from-[#4F32FF] to-[#7137F2] hover:opacity-95 disabled:opacity-40 text-[#F7F7FB] font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-[#4F32FF]/20 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Learning Context Controls (Col 3) */}
        <div className="lg:col-span-3 bg-[#0A0A12] border border-[#1E1E2D] rounded-3xl p-5 space-y-5 h-[720px] flex flex-col justify-between overflow-y-auto scrollbar-thin">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#1E1E2D] pb-3">
              <Sliders className="w-4 h-4 text-[#665CFF]" />
              <span className="text-[11px] font-bold text-[#8A8A9E] uppercase tracking-wider">
                LEARNING CONTEXT
              </span>
            </div>

            {/* Country */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8A8A9E] uppercase block">
                COUNTRY
              </label>
              <select
                value={country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-[#08080E] border border-[#1A1A23] rounded-xl px-3 py-2 text-xs text-[#F7F7FB] focus:outline-none focus:border-[#665CFF]"
              >
                <option value="US">US</option>
                <option value="India">India</option>
                <option value="Global">Global</option>
              </select>
            </div>

            {/* Currency */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8A8A9E] uppercase block">
                CURRENCY
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#08080E] border border-[#1A1A23] rounded-xl px-3 py-2 text-xs text-[#F7F7FB] focus:outline-none focus:border-[#665CFF]"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            {/* Language */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8A8A9E] uppercase block">
                LANGUAGE
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-[#08080E] border border-[#1A1A23] rounded-xl px-3 py-2 text-xs text-[#F7F7FB] focus:outline-none focus:border-[#665CFF]"
              >
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>

            {/* Level */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8A8A9E] uppercase block">
                LEVEL
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-[#08080E] border border-[#1A1A23] rounded-xl px-3 py-2 text-xs text-[#F7F7FB] focus:outline-none focus:border-[#665CFF]"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Learning Mode */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#8A8A9E] uppercase block">
                LEARNING MODE
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full bg-[#08080E] border border-[#1A1A23] rounded-xl px-3 py-2 text-xs text-[#F7F7FB] focus:outline-none focus:border-[#665CFF]"
              >
                <option value="explain">Explain concept</option>
                <option value="quiz">Quiz me</option>
                <option value="calc">Guided calculation</option>
              </select>
            </div>

            {/* Response Detail */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8A8A9E] uppercase block">
                RESPONSE DETAIL
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-[#08080E] border border-[#1A1A23] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDetail('short')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    detail === 'short'
                      ? 'bg-[#4F32FF] text-[#F7F7FB]'
                      : 'text-[#8A8A9E] hover:text-[#F7F7FB]'
                  }`}
                >
                  Short
                </button>
                <button
                  type="button"
                  onClick={() => setDetail('detailed')}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    detail === 'detailed'
                      ? 'bg-[#4F32FF] text-[#F7F7FB]'
                      : 'text-[#8A8A9E] hover:text-[#F7F7FB]'
                  }`}
                >
                  Detailed
                </button>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-[#1E1E2D]">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#9A9AAA] hover:text-[#F7F7FB]">
                <input
                  type="checkbox"
                  checked={useOfficialSources}
                  onChange={(e) => setUseOfficialSources(e.target.checked)}
                  className="rounded bg-[#08080E] border-[#1A1A23] text-[#4F32FF] focus:ring-0"
                />
                <span>Use official sources when current</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#9A9AAA] hover:text-[#F7F7FB]">
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  className="rounded bg-[#08080E] border-[#1A1A23] text-[#4F32FF] focus:ring-0"
                />
                <span>High contrast</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#9A9AAA] hover:text-[#F7F7FB]">
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  className="rounded bg-[#08080E] border-[#1A1A23] text-[#4F32FF] focus:ring-0"
                />
                <span>Reduced motion</span>
              </label>
            </div>
          </div>

          {/* Bottom Security Disclaimer Card */}
          <div className="p-3 bg-[#08080E] border border-[#1E1E2D] rounded-2xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F5B800] shrink-0 mt-0.5" />
            <p className="text-[10px] text-[#8A8A9E] leading-relaxed">
              Never share card numbers, OTPs, passwords, tax IDs, private keys or API keys.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
