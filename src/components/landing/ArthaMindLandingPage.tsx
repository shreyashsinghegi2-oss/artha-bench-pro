import React,{useEffect,useMemo,useState}from'react';
import{ArrowRight,BookOpen,BrainCircuit,CheckCircle2,FlaskConical,GraduationCap,LineChart,LockKeyhole,ShieldCheck,WalletCards}from'lucide-react';
import{NavigationDestination}from'../../types';
import{fetchBusinessNews,fetchMarketOverview,fetchMarketQuote}from'../../services/learningApi';
import{INDIA_MARKET_UNIVERSE}from'../../data/indiaMarketUniverse';
import{NormalizedMarketQuote}from'../../types';
import{ArthaMindLogo}from'./ArthaMindLogo';
import{HeroProductMockup}from'./HeroProductMockup';
import{LiveMarketTicker}from'./LiveMarketTicker';
import{CryptoMarketPreview}from'./CryptoMarketPreview';
import{BusinessBrief,BusinessNewsTicker,normalizeBusinessNews}from'./BusinessBrief';
import{InteractiveFeatureCard,MotionReveal,SectionMood}from'./LandingPrimitives';
import{LanguageSelector}from'../LanguageSelector';
import'./landingAnimations.css';import'./landingPolish.css';

type Props={signedIn:boolean;onEnter:(destination?:NavigationDestination)=>void;onSignIn:()=>void};
const features=[
 {icon:FlaskConical,title:'AI Reliability Lab',text:'Compare financial AI answers, inspect evidence and see where verification is still required.',accent:'indigo' as const,visual:<div className="preview-compare"><span>Answer A</span><i/><span>Answer B</span></div>},
 {icon:GraduationCap,title:'Financial Learning',text:'Learn concepts, ask follow-ups, take quizzes and keep progress without turning education into trading signals.',accent:'amber' as const,visual:<div className="preview-progress"><span>Concept progress</span><b/></div>},
 {icon:LineChart,title:'Markets & Crypto',text:'Research market, company, economic and crypto context with source and freshness labels kept visible.',accent:'emerald' as const,visual:<div className="preview-spark"><svg viewBox="0 0 120 34" role="img" aria-label="Decorative sample sparkline"><path d="M2 27 L18 23 L30 26 L45 17 L58 20 L74 11 L91 15 L118 5" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div>},
 {icon:WalletCards,title:'Personal Finance',text:'Organize income, expenses, budgets, EMIs and goals. Personal records stay out of AI context until you enable them.',accent:'coral' as const,visual:<div className="preview-bars"><span/><span/><span/></div>},
 {icon:BrainCircuit,title:'ArthaMind Assistant',text:'Ask questions using public context or only the personal finance categories you explicitly authorize.',accent:'teal' as const,visual:<div className="preview-context"><LockKeyhole className="h-4 w-4"/> Personal context: opt-in</div>},
 {icon:BookOpen,title:'Reports & Methodology',text:'Review calculations, transaction evidence, evaluation methodology and saved work without invented confidence claims.',accent:'navy' as const,visual:<div className="preview-checks"><span>Source basis</span><CheckCircle2 className="landing-check h-4 w-4"/></div>},
];
export const ArthaMindLandingPage:React.FC<Props>=({signedIn,onEnter,onSignIn})=>{const[scrolled,setScrolled]=useState(false);const[activeSection,setActiveSection]=useState('research');const[news,setNews]=useState<ReturnType<typeof normalizeBusinessNews>>([]);const[tickerNews,setTickerNews]=useState<ReturnType<typeof normalizeBusinessNews>>([]);useEffect(()=>{const f=()=>setScrolled(window.scrollY>12);f();window.addEventListener('scroll',f,{passive:true});return()=>window.removeEventListener('scroll',f)},[]);useEffect(()=>{let active=true;const load=async()=>{try{const [general,business]=await Promise.all([fetchBusinessNews(undefined,'all'),fetchBusinessNews(undefined,'business')]);const businessItems=normalizeBusinessNews(business).filter((item)=>/business|finance|financial|market|markets|company|companies|corporate|earnings|revenue|profit|merger|acquisition|ipo|stock|stocks|economy|economic|inflation|interest rate|central bank|banking|trade|retail|oil|commodit|startup|investment|investing|funding|venture|technology|tech|manufactur|supply chain|consumer|real estate|housing|energy|currency|forex|bond|bonds|tariff|export|import|gdp|jobs|employment|layoff|regulation|regulatory/i.test(`${item.category} ${item.title} ${item.description}`));if(active){const generalItems=normalizeBusinessNews(general);const merged=[...businessItems,...generalItems];const seen=new Set<string>();const liveTicker=merged.filter((item)=>{const key=(item.url||item.title).toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).slice(0,12);setTickerNews(liveTicker);setNews(businessItems)}}catch{if(active){setTickerNews([]);setNews([])}}};void load();const timer=window.setInterval(()=>void load(),45000);return()=>{active=false;window.clearInterval(timer)}},[]);useEffect(()=>{const ids=['research','capabilities','trust'];const nodes=ids.map(id=>document.getElementById(id)).filter(Boolean)as HTMLElement[];if(!nodes.length||!('IntersectionObserver'in window))return;const observer=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)setActiveSection((visible.target as HTMLElement).id)},{rootMargin:'-25% 0px -55% 0px',threshold:[0,.15,.35,.6]});nodes.forEach(node=>observer.observe(node));return()=>observer.disconnect()},[]);return <div className="landing-shell min-h-screen overflow-x-hidden text-[#172033] selection:bg-teal-200 selection:text-slate-950">
<header className={`sticky top-0 z-50 border-b transition-all duration-200 ${scrolled?'border-slate-200 bg-white/95 shadow-sm backdrop-blur':'border-transparent bg-white/80 backdrop-blur'}`}><div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"><a href="#top" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"><ArthaMindLogo className="h-9 w-9" compact/><div><div className="text-sm font-black tracking-[.14em] text-[#172033]">ARTHAMIND AI</div><div className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-500">Financial Intelligence</div></div></a><nav className="hidden gap-7 text-xs font-semibold text-slate-600 md:flex"><a className="landing-link" href="#research" aria-current={activeSection==='research'?'true':undefined}>Research workspace</a><a className="landing-link" href="#capabilities" aria-current={activeSection==='capabilities'?'true':undefined}>Capabilities</a><a className="landing-link" href="#trust" aria-current={activeSection==='trust'?'true':undefined}>Trust & privacy</a></nav><div className="flex items-center gap-2"><LanguageSelector compact/>{!signedIn&&<button onClick={onSignIn} className="landing-button hidden rounded-xl px-3 py-2 text-xs font-bold text-slate-700 sm:inline-flex">Sign in</button>}<button onClick={()=>onEnter('overview')} className="landing-button inline-flex items-center gap-2 rounded-xl bg-[#0F9D8A] px-4 py-2.5 text-xs font-black text-white">{signedIn?'Open my workspace':'Open Artha Bench Pro'}<ArrowRight className="h-3.5 w-3.5"/></button></div></div></header>
<main id="top">
<SectionMood mood="hero" className="border-b border-slate-200"><div className="hero-depth-bg" aria-hidden="true"><span className="hero-grid-lines"/><span className="hero-orb hero-orb-1"/><span className="hero-orb hero-orb-2"/><span className="hero-orb hero-orb-3"/></div><div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[.86fr_1.14fr] lg:px-8 lg:py-20"><div className="artha-hero-stagger relative z-10"><div className="inline-flex rounded-full border border-teal-400/20 bg-white/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-teal-200">Financial intelligence you can inspect</div><h1 className="mt-6 max-w-4xl text-5xl font-black leading-[.98] tracking-[-.045em] text-white sm:text-6xl">Understand finance.<span className="mt-2 block text-teal-300">Test the AI answer.</span>See what it used.</h1><p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">ArthaMind AI is the financial-intelligence layer. Artha Bench Pro is the workspace where you can learn, inspect evidence, organize personal finance, research markets and test financial AI without turning the product into a brokerage.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={()=>onEnter('overview')} className="landing-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#14B8A6] px-5 py-3 text-sm font-black text-slate-950">Explore Artha Bench Pro<ArrowRight className="h-4 w-4"/></button><button onClick={()=>onEnter('evaluation-lab')} className="landing-button inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.06] px-5 py-3 text-sm font-black text-white backdrop-blur"><FlaskConical className="h-4 w-4 text-indigo-300"/>Open AI Reliability Lab</button></div><div className="mt-7 flex flex-wrap gap-4 text-[11px] font-semibold text-slate-400"><span>✓ Public tools before sign-in</span><span>✓ Personal context stays opt-in</span><span>✓ Educational & research scope</span></div></div><MotionReveal delay={100}><HeroProductMockup onEnter={onEnter}/></MotionReveal></div></SectionMood>
<SectionMood id="research" mood="research" className="border-y border-slate-200"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><MotionReveal><div className="mx-auto mb-9 max-w-3xl text-center"><div className="text-[10px] font-black uppercase tracking-[.15em] text-teal-700">ArthaMind intelligence layer</div><h2 className="mt-2 text-3xl font-black sm:text-4xl">A serious financial research workspace—not a generic AI graphic.</h2><p className="mt-3 text-sm leading-7 text-slate-600">The hero preview shows the flow from market context to an inspectable answer. The chart is deterministic sample data and is not presented as live.</p></div><div className="research-secondary-note"><div className="research-node"><span>01</span><b>Question</b><small>Market context</small></div><div className="research-connector"/><div className="research-node"><span>02</span><b>Context</b><small>Chart + evidence</small></div><div className="research-connector"/><div className="research-node"><span>03</span><b>Answer</b><small>ArthaMind response</small></div><div className="research-connector"/><div className="research-node"><span>04</span><b>Verify</b><small>Sources required</small></div></div></MotionReveal></div></SectionMood>
<LiveMarketTicker/>
<CryptoMarketPreview/>
<BusinessBrief articles={news} tickerArticles={tickerNews}/><IndiaMarketPulse/>
<section id="capabilities"><FeatureSection mood="reliability" eyebrow="AI Reliability Lab" title="Compare answers without pretending confidence equals correctness." feature={features[0]} delay={0}/><FeatureSection mood="learning" eyebrow="Financial Learning" title="Build understanding with calm progress, not gain-chasing visuals." feature={features[1]} delay={60}/><FeatureSection mood="markets" eyebrow="Markets & Crypto" title="Finance-native market research with honest source states." feature={features[2]} delay={80}/><FeatureSection mood="finance" eyebrow="Personal Finance" title="Income, expenses, budgets, reports and EMIs connected under one workspace." feature={features[3]} delay={80}/><FeatureSection mood="reports" eyebrow="Evidence & methodology" title="Reports and methodology make the basis easier to inspect." feature={features[5]} delay={80}/></section>
<SectionMood id="trust" mood="trust" className="border-y border-teal-100"><div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><MotionReveal><div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]"><div><ShieldCheck className="h-8 w-8 text-[#0F766E]"/><div className="mt-4 text-[10px] font-black uppercase tracking-[.15em] text-[#0F766E]">Trust & privacy</div><h2 className="mt-2 text-3xl font-black">Personalization should be a switch, not a surprise.</h2><p className="mt-3 text-sm leading-7 text-slate-600">Public context and your private finance records are different data categories. ArthaMind only receives personal categories you enable.</p><a href="/trust" className="landing-link mt-5 inline-flex items-center gap-1 text-sm font-black text-[#0F766E]">Open Trust Centre<ArrowRight className="h-4 w-4"/></a></div><div className="grid gap-3 sm:grid-cols-2"><Trust title="User-scoped workspace" text="Signed-in cloud records remain associated with the authenticated user and existing access policies."/><Trust title="Context by category" text="Income, expenses, budgets, EMIs, goals and other supported categories can be controlled independently."/><Trust title="No brokerage layer" text="Artha Bench does not execute trades, approve loans or present generated text as guaranteed advice."/><Trust title="Visible limitations" text="Source failures, unavailable rate references and incomplete personal data are stated instead of filled with fake values."/></div></div></MotionReveal></div></SectionMood>
</main><footer className="bg-[#172033] text-slate-300"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8"><div className="flex items-start gap-3"><ArthaMindLogo className="h-9 w-9" compact/><div><div className="text-sm font-black text-white">ArthaMind AI × Artha Bench Pro</div><p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">India-focused financial intelligence, education and AI reliability. Educational/research use only—not investment, tax, legal or lending advice.</p></div></div><nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold"><a href="/about">About</a><a href="/trust">Trust Centre</a><a href="/methodology">Methodology</a><a href="/roadmap">Roadmap</a><a href="/support">Support</a><a href="/changelog">What’s new</a><a href="/access">Beta access</a></nav></div></footer></div>};
const IndiaMarketPulse: React.FC = () => {
  const [quotes, setQuotes] = useState<NormalizedMarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const symbols = INDIA_MARKET_UNIVERSE.map((company) => company.providerSymbol);
      const chunks = Array.from(
        { length: Math.ceil(symbols.length / 20) },
        (_, index) => symbols.slice(index * 20, index * 20 + 20)
      );
      const received = (
        await Promise.all(chunks.map((chunk) => fetchMarketOverview(chunk)))
      ).flat();

      let valid = received.filter(
        (quote) =>
          quote &&
          quote.freshness !== "demo" &&
          quote.freshness !== "stale" &&
          quote.currency === "INR" &&
          Number.isFinite(Number(quote.price)) &&
          quote.changePercent != null &&
          Number.isFinite(Number(quote.changePercent)) &&
          quote.change != null &&
          Number.isFinite(Number(quote.change))
      );

      // Direct fallback through the same existing market quote API/provider used by the dashboard.
      // Accept every non-demo INR quote that has a usable price, rupee change and percentage.
      const fallbackResults = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const result = await fetchMarketQuote(symbol, "equity");
            const quote = result.quote;
            if (
              result.status === "connected" &&
              quote &&
              quote.freshness !== "demo" &&
              quote.currency === "INR" &&
              Number.isFinite(Number(quote.price)) &&
              quote.change != null &&
              Number.isFinite(Number(quote.change)) &&
              quote.changePercent != null &&
              Number.isFinite(Number(quote.changePercent))
            ) {
              return quote;
            }
          } catch {}
          return null;
        })
      );

      const mergedBySymbol = new Map(
        valid.map((quote) => [normalizeSymbol(String(quote.symbol)), quote])
      );
      fallbackResults.forEach((quote) => {
        if (quote) {
          const key = normalizeSymbol(String(quote.symbol));
          if (!mergedBySymbol.has(key)) mergedBySymbol.set(key, quote);
        }
      });
      valid = Array.from(mergedBySymbol.values());

      setQuotes(valid);
      setUpdatedAt(new Date().toISOString());
    } catch {
      setQuotes([]);
      setError(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const normalizeSymbol = (symbol: string) =>
    symbol.toUpperCase().replace(/\.(NS|BO)$/, "");

  const quoteBySymbol = useMemo(() => {
    const map = new Map<string, NormalizedMarketQuote>();
    quotes.forEach((quote) => {
      map.set(normalizeSymbol(String(quote.symbol)), quote);
    });
    return map;
  }, [quotes]);

  const availableCompanies = useMemo(
    () =>
      INDIA_MARKET_UNIVERSE.map((company) => ({
        company,
        quote: quoteBySymbol.get(normalizeSymbol(company.providerSymbol)),
      }))
        .filter(
          (
            item
          ): item is {
            company: (typeof INDIA_MARKET_UNIVERSE)[number];
            quote: NormalizedMarketQuote;
          } => Boolean(item.quote)
        )
        .sort(
          (a, b) =>
            Number(b.quote.changePercent) - Number(a.quote.changePercent)
        ),
    [quoteBySymbol]
  );

  const gainers = availableCompanies.filter(
    ({ quote }) => Number(quote.changePercent) > 0
  );
  const decliners = availableCompanies.filter(
    ({ quote }) => Number(quote.changePercent) < 0
  );

  const provider =
    quotes[0]?.providerName || "Connected market-data provider";
  const providerStamp =
    quotes.map((quote) => quote.providerTimestamp).filter(Boolean).sort().at(-1) ||
    quotes.map((quote) => quote.retrievedAt).filter(Boolean).sort().at(-1) ||
    updatedAt;

  const formatPrice = (quote: NormalizedMarketQuote) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(quote.price));

  const formatChange = (quote: NormalizedMarketQuote) => {
    const value = Number(quote.change);
    return `${value >= 0 ? "+" : "-"}₹${Math.abs(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (quote: NormalizedMarketQuote) => {
    const value = Number(quote.changePercent);
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const CompanyRow = ({
    company,
    quote,
  }: {
    company: (typeof INDIA_MARKET_UNIVERSE)[number];
    quote: NormalizedMarketQuote;
  }) => {
    const change = Number(quote.changePercent);
    const isUp = change > 0;
    const isFlat = change === 0;
    const movementClass = isUp
      ? "bg-[#F0FDF4] text-[#15803D]"
      : isFlat
        ? "bg-slate-50 text-[#64748B]"
        : "bg-[#FEF2F2] text-[#B91C1C]";

    return (
      <li
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[#E2E8F0] px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1.6fr)_minmax(110px,.7fr)_minmax(190px,auto)] sm:px-5"
        aria-label={`${company.officialName}, ${isUp ? "up" : isFlat ? "unchanged" : "down"} ${Math.abs(change).toFixed(2)} percent`}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-[#0F172A]">
            {company.officialName}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.08em] text-[#64748B]">
            {quote.symbol}
          </div>
        </div>
        <div className="text-right font-black tabular-nums text-[#0F172A]">
          {formatPrice(quote)}
        </div>
        <div
          className={`col-span-2 flex items-center justify-end gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-black tabular-nums sm:col-span-1 ${movementClass}`}
        >
          <span aria-hidden="true">{isUp ? "↑" : isFlat ? "→" : "↓"}</span>
          <span>{formatChange(quote)}</span>
          <span>{formatPercent(quote)}</span>
        </div>
      </li>
    );
  };

  return (
    <section
      id="india-market-pulse"
      className="border-y border-[#E2E8F0] bg-white"
      aria-labelledby="india-market-pulse-title"
    >
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[.18em] text-[#0F766E]">
              INDIA MARKET PULSE
            </div>
            <h2
              id="india-market-pulse-title"
              className="mt-2 text-3xl font-black tracking-[-.025em] text-[#0F172A] sm:text-4xl"
            >
              Today’s intraday movers
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569]">
              Showing only companies for which the existing market-data connection returned a verified INR intraday quote.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="text-right text-[10px] leading-5 text-[#64748B]">
              <div>
                {providerStamp
                  ? `Last updated: ${new Date(providerStamp).toLocaleString("en-IN")}`
                  : "Last updated: unavailable"}
              </div>
              <div>Provider: {provider}</div>
              <div>
                {availableCompanies.length} available · {gainers.length} ↑ · {decliners.length} ↓
              </div>
            </div>
            <a
              href="/finance/markets/intraday"
              className="inline-flex items-center rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-black text-[#0F172A] transition hover:border-[#0F766E] hover:bg-[#F8FAFC]"
            >
              Open intraday markets →
            </a>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl !border !border-[#E2E8F0] !bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-base font-black text-[#0F172A]">
                Available intraday companies
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold text-[#64748B]">
                Only provider-returned INR quotes are listed. Sorted by percentage movement. Up/down values come directly from the connected market API.
              </p>
            </div>
            <span className="rounded-full border border-[#CBD5E1] bg-white px-2.5 py-1 text-[10px] font-black text-[#0F172A]">
              {availableCompanies.length}
            </span>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#E2E8F0] px-4 py-2 text-[9px] font-black uppercase tracking-[.12em] text-[#64748B] sm:grid-cols-[minmax(0,1.6fr)_minmax(110px,.7fr)_minmax(190px,auto)] sm:px-5">
            <span>Company</span>
            <span className="text-right">Price</span>
            <span className="col-span-2 text-right sm:col-span-1">Today</span>
          </div>

          {loading ? (
            <div className="divide-y divide-[#E2E8F0]">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-5"
                >
                  <div>
                    <div className="h-4 w-44 animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-2.5 w-20 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : availableCompanies.length > 0 ? (
            <ul>
              {availableCompanies.map(({ company, quote }) => (
                <CompanyRow key={company.id} company={company} quote={quote} />
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center text-sm font-semibold text-[#64748B]">
              Verified intraday ranking data is currently unavailable.
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
            <span>Market quotes could not be refreshed right now.</span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[10px] font-black text-[#0F172A] hover:border-[#0F766E]"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-4 text-[9px] leading-5 text-[#64748B]">
          Prices, rupee changes and percentage movements come only from the existing connected market-data path. The section refreshes every 15 seconds and falls back to the same India-market provider path used by the main dashboard; a real-time claim is made only when the provider itself reports real-time freshness.
        </div>
      </div>
    </section>
  );
};

function FeatureSection({mood,eyebrow,title,feature,delay}:{mood:'reliability'|'learning'|'markets'|'finance'|'reports',eyebrow:string,title:string,feature:typeof features[number],delay:number}){const Icon=feature.icon;return <SectionMood mood={mood} className="border-b border-slate-200/70"><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><MotionReveal delay={delay}><div className="grid items-center gap-8 lg:grid-cols-[1fr_.8fr]"><div><div className="text-[10px] font-black uppercase tracking-[.15em] text-slate-600">{eyebrow}</div><h2 className="mt-2 max-w-3xl text-3xl font-black">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{feature.text}</p></div><InteractiveFeatureCard accent={feature.accent} className="bg-white p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-50 p-3"><Icon className="h-5 w-5"/></div><div className="font-black">{feature.title}</div></div><div className="mt-5">{feature.visual}</div></InteractiveFeatureCard></div></MotionReveal></div></SectionMood>}
const Trust=({title,text}:{title:string,text:string})=><div className="rounded-2xl border border-teal-100 bg-white p-4"><div className="text-sm font-black">{title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{text}</p></div>;
