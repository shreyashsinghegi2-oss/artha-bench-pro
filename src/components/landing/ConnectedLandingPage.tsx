import React,{useEffect,useRef,useState}from'react';
import { installTilt } from '../../lib/tilt3d';
import { LandingModulePipeline } from './LandingModulePipeline';
import { PhoneShowcase } from './PhoneShowcase';
import { MoneyCheck } from './MoneyCheck';
import{ArrowDown,ArrowRight,ArrowUp,CheckCircle2,Menu,Sparkles,X}from'lucide-react';
import type{AppNavigationDestination}from'../../navigationTypes';
import type{NormalizedMarketQuote}from'../../types';
import{fetchBusinessNews}from'../../services/learningApi';
import { ArthaMindMark } from './ArthaMindMark';
import { LandingHero } from './LandingHero';
import{LiveMarketTicker}from'./LiveMarketTicker';
import{LazyCryptoMarketPreview as CryptoMarketPreview}from'./LazyCryptoMarketPreview';
import{BusinessBrief,normalizeBusinessNews}from'./BusinessBrief';
import{LanguageSelector}from'../LanguageSelector';
import'./connectedLanding.css';
import'./landingMotion.css';
import{useLandingMotion}from'./useLandingMotion';
import{LandingAiCfo}from'./LandingAiCfo';
import{LandingReviews}from'./LandingReviews';
import{LandingIntelligenceSection}from'./LandingIntelligenceSection';
import{LandingMarketDashboard}from'./LandingMarketDashboard';

type Props={signedIn:boolean;onEnter:(destination?:AppNavigationDestination)=>void;onSignIn:()=>void};
type MacroCard={label:string;value:string;delta:string;direction:'up'|'down'|'flat'|'none'};
const SAMPLE_CHECK_COUNT=6;
const NAV_LINKS=[['money-check','Money check'],['modules','Modules'],['market-data','Market data'],['how','How it works'],['lab','Reliability Lab'],['trust','Trust & privacy']] as const;
const CAPABILITIES=['Old vs new tax regime','80C · 80D · NPS room','EMI prepayment vs invest','6-month emergency runway','SIP for every goal','Retirement corpus','Term & health cover gap','Home-loan affordability','Business cash flow','Credit-card debt payoff','Hindi & Hinglish answers','Verified ₹ calculations'];
/** Cycles hero phrases with a slide-up transition; shows the first phrase only for reduced motion. */
/** Formats a provider quote for a macro card. A missing or non-finite change is shown as unavailable, never as +0.00%. */
export function macroCardFromQuote(label:string,quote:NormalizedMarketQuote|undefined):MacroCard{const price=quote?Number(quote.price):NaN;const change=quote&&quote.changePercent!=null?Number(quote.changePercent):NaN;const value=Number.isFinite(price)?price.toLocaleString('en-IN',{maximumFractionDigits:2}):'';if(!quote)return{label,value,delta:'Connect data source',direction:'none'};if(!Number.isFinite(change))return{label,value,delta:'Change unavailable',direction:'none'};const rounded=Math.round(change*100)/100;return{label,value,delta:(rounded>0?'+':rounded<0?'−':'')+Math.abs(rounded).toFixed(2)+'%',direction:rounded>0?'up':rounded<0?'down':'flat'};}
/** Share of the ring to leave unfilled for `passed` of `total` checks (0 = full ring). */
export function scoreRingOffset(passed:number,total:number):number{if(!(total>0))return 1;return 1-Math.min(Math.max(passed,0),total)/total;}
// Target is a workspace, or `ask:<question>` to hand the question to the AI CFO on this page.
const modules=[
 ['SD','Smart Dashboard','Income, expenses, savings rate and EMI burden in one live view.','Plan','dashboard'],
 ['GP','Goal Planner','The monthly SIP each goal needs, adjusted for inflation.','Plan','financial-twin'],
 ['HS','Financial Health Score','A 0 to 100 score with personal tips to improve it.','Plan','financial-health'],
 ['RP','Retirement Planner','The corpus you need, three scenarios and the gap to close.','Plan','ask:I am 32, earn ₹1.2 lakh a month take-home and spend ₹70,000. How big a retirement corpus do I need at 60 and what monthly SIP gets me there? Show three scenarios.'],
 ['EC','Education Cost Planner','Future education costs with inflation and the SIP to reach them.','Plan','ask:My child is 4. An engineering degree costs ₹20 lakh today. What will it cost in 14 years at 10% education inflation, and what monthly SIP do I need?'],
 ['CI','Career Income Projection','Ten-year salary and wealth paths: stay, switch or grow.','Plan','ask:I earn ₹18 lakh a year. Compare my 10-year income and wealth if I stay (8% raises), switch jobs now (30% hike, then 8%) or do an MBA costing ₹25 lakh.'],
 ['NW','Net Worth Tracker','Assets, liabilities and your wealth trajectory over time.','Plan','finance-reports'],
 ['PT','Portfolio Tracker','SIPs, funds, stocks, FDs, PPF and NPS with real returns.','Invest','market-watchlist'],
 ['MD','Market Data Dashboard','NIFTY 50, SENSEX, USD/INR and gold from available provider-backed market data.','Invest','markets'],
 ['TX','Tax Optimiser','Old versus new regime and unused 80C, 80D and NPS room.','Tax & Debt','income'],
 ['EM','EMI & Loan Manager','Amortisation, prepayment simulator and loan comparison.','Tax & Debt','emi-manager'],
 ['IN','Insurance Analyser','Human Life Value, cover gap and protection score.','Protect','ask:I am 35, earn ₹15 lakh a year, have a ₹45 lakh home loan and two kids. Estimate my Human Life Value, the term cover I need and my health cover gap.'],
 ['FA','Family Income Analyser','Dependency ratio and financial stress for each earner.','Protect','ask:Our family has two earners (₹90,000 and ₹45,000 a month take-home), three dependants and ₹38,000 in EMIs. Analyse our dependency ratio and financial stress per earner.'],
 ['RR','Financial Risk Radar','Five risk dimensions and three actions to reduce them.','Protect','quick-check'],
 ['AI','AI Financial Advisor','Ask in Hinglish or English and get numbers-backed answers.','AI','ask:'],
] as const;
const checks=[['Reasoning',true],['Numerical accuracy',true],['Grounding',true],['Risk awareness',true],['Explainability',true],['Evidence',false]] as const;
export const ConnectedLandingPage:React.FC<Props>=({signedIn,onEnter,onSignIn})=>{
 const[scrolled,setScrolled]=useState(false),[active,setActive]=useState('workspace'),[lab,setLab]=useState(false),[passedChecks,setPassedChecks]=useState(0),[news,setNews]=useState<ReturnType<typeof normalizeBusinessNews>>([]);
 const rootRef=useRef<HTMLDivElement>(null);const[menuOpen,setMenuOpen]=useState(false);useEffect(()=>{if(!menuOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenuOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[menuOpen]);const[cfoPrompt,setCfoPrompt]=useState<{id:number;text:string}|null>(null);const[showTop,setShowTop]=useState(false);useLandingMotion(rootRef);
 useEffect(()=>{const el=rootRef.current;if(!el)return;return installTilt(el,{selector:'.cl-card, .rv-card, .mk-card',maxWidth:560,maxDeg:7});},[]);
 useEffect(()=>{const f=()=>{setScrolled(window.scrollY>8);setShowTop(window.scrollY>900)};f();addEventListener('scroll',f,{passive:true});return()=>removeEventListener('scroll',f)},[]);
 useEffect(()=>{if(!lab)return;setPassedChecks(0);const timers:number[]=[];[0,1,2,3,4,5].forEach(i=>timers.push(window.setTimeout(()=>setPassedChecks(i+1),window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:i*450+400)));return()=>timers.forEach(window.clearTimeout)},[lab]);
 useEffect(()=>{const move=(e:MouseEvent)=>{const card=(e.target as HTMLElement)?.closest?.('.cl-card') as HTMLElement|null;if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--mx',e.clientX-r.left+'px');card.style.setProperty('--my',e.clientY-r.top+'px')};document.addEventListener('mousemove',move);return()=>document.removeEventListener('mousemove',move)},[]);
 useEffect(()=>{const ids=['top','money-check','ai-cfo','modules','market-data','how','lab','trust'];const els=ids.map(id=>document.getElementById(id)).filter(Boolean)as HTMLElement[];if(!els.length)return;const ob=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(v)setActive((v.target as HTMLElement).id==='top'?'workspace':(v.target as HTMLElement).id)},{rootMargin:'-20% 0px -60% 0px',threshold:[.15,.35,.6]});els.forEach(e=>ob.observe(e));const reveal=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)(e.target as HTMLElement).classList.add('in')}),{rootMargin:'0px 0px -8% 0px',threshold:.12});document.querySelectorAll('.cl-reveal,.cl-reveal-section').forEach(e=>reveal.observe(e));return()=>{ob.disconnect();reveal.disconnect()}},[]);
 useEffect(()=>{let alive=true;const load=async()=>{try{const [business,general]=await Promise.all([fetchBusinessNews(undefined,'business'),fetchBusinessNews(undefined,'all')]);if(alive){const items=[...normalizeBusinessNews(business),...normalizeBusinessNews(general)];const seen=new Set<string>();setNews(items.filter(x=>{const k=(x.url||x.title).toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,12))}}catch{if(alive)setNews([])}};void load();const t=window.setInterval(()=>void load(),45000);return()=>{alive=false;window.clearInterval(t)}},[]);

 const open=(d:AppNavigationDestination)=>onEnter(d);
 const scrollToId=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 const scrollToCfo=()=>scrollToId('ai-cfo');
 const askCfo=(text:string)=>{scrollToCfo();if(text.trim())setCfoPrompt({id:Date.now(),text});};
 return <div ref={rootRef} className="connected-landing">
 <div className="cl-progress" aria-hidden="true"/>
 <header className={'cl-header '+(scrolled?'is-scrolled':'')}><div className="cl-wrap cl-nav">
  <a href="#top" className="cl-brand" aria-label="ArthaMind AI by Artha Bench Pro, back to top"><ArthaMindMark size={28}/><span className="am-brand-text"><b>ArthaMind AI</b><small>by Artha Bench Pro</small></span></a>
  <nav className="cl-links" aria-label="Page sections">{NAV_LINKS.map(([id,label])=><a key={id} className={active===id?'on':''} href={'#'+id} aria-current={active===id?'true':undefined}>{label}</a>)}</nav>
  <div className="cl-right"><LanguageSelector compact/>{!signedIn&&<button type="button" className="cl-signin" onClick={onSignIn}>Sign in</button>}<button type="button" className="cl-menu-button" aria-label={menuOpen?'Close menu':'Open menu'} aria-expanded={menuOpen} aria-controls="cl-mobile-menu" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button></div>
 </div>
 <div id="cl-mobile-menu" className={'cl-mobile-menu '+(menuOpen?'open':'')} hidden={!menuOpen}><nav aria-label="Page sections">{NAV_LINKS.map(([id,label])=><a key={id} href={'#'+id} onClick={()=>setMenuOpen(false)}>{label}</a>)}</nav></div>
 </header>
 <main id="top">
 <LandingHero onSample={()=>scrollToId('money-check')} onExplore={()=>open('overview')}/>
 <div className="cl-stat-strip"><div className="cl-wrap cl-stats" data-stagger><div><b data-n="15">15</b><span>planning and research modules</span></div><div><b data-n="3">3</b><span>languages for CFO answers: English, Hindi and Hinglish</span></div><div><b>India</b><span>80C, 80D, NPS, PPF and SGB aware</span></div><div><b>Evidence</b><span>first: every answer shows what supports it</span></div></div></div>
 <div className="cl-marquee" aria-label="What the AI CFO covers"><div className="cl-marquee-track">{[...CAPABILITIES,...CAPABILITIES].map((c,i)=><span key={i} aria-hidden={i>=CAPABILITIES.length?true:undefined}><i/>{c}</span>)}</div></div>
 <PhoneShowcase onTry={()=>scrollToId('money-check')}/>
 <MoneyCheck onAsk={askCfo}/>
 <LandingIntelligenceSection/>
 <LandingAiCfo onEnter={open} externalPrompt={cfoPrompt}/>
 <section className="cl-section cl-reveal-section tone-sky"><div className="cl-wrap"><div className="cl-eyebrow">One platform</div><h2>Two products. One financial intelligence.</h2><p className="cl-sub">Planning tells you what to do. Research tells you why you can trust it.</p><div className="cl-two" data-stagger><button className="cl-card cl-card-button" onClick={()=>open('overview')}><span className="cl-eyebrow">ArthaMind AI</span><h3>Your personal finance intelligence</h3><p>Built for Indian households and investors. It connects income, loans, investments and goals, then explains what to consider next.</p><ul><li>Goals, tax, loans, retirement and insurance in one view</li><li>Answers in English or Hinglish, backed by numbers</li><li>Real returns after inflation, not just headline gains</li></ul><b>Explore ArthaMind AI <ArrowRight size={14}/></b></button><button className="cl-card cl-card-button" onClick={()=>open('overview')}><span className="cl-eyebrow">Artha Bench Pro</span><h3>The research and reliability workspace</h3><p>Where you learn finance, follow markets, test financial AI answers and see which evidence was used.</p><ul><li>Live markets, business news and economic data</li><li>AI Reliability Lab with transparent checks</li><li>Evidence, sources and calculations you can inspect</li></ul><b>Open Artha Bench Pro <ArrowRight size={14}/></b></button></div></div></section>
 <section id="modules" className="cl-section cl-reveal-section tone-night mp-section"><div className="cl-wrap"><div className="cl-eyebrow">How your money flows</div><h2>One pipeline from your numbers to a plan.</h2><p className="cl-sub">Fifteen modules work as four connected stages. Each stage uses what the one before it verified, and the AI CFO explains the result.</p><LandingModulePipeline modules={modules} onOpen={(target)=>open(target as AppNavigationDestination)} onAsk={askCfo}/></div></section>
 <LiveMarketTicker/><CryptoMarketPreview/><BusinessBrief articles={news} tickerArticles={news}/>
 <section id="how" className="cl-section cl-reveal-section tone-night"><div className="cl-wrap"><div className="cl-eyebrow">How it works</div><h2>From your numbers to a decision you can inspect.</h2><div className="cl-steps cl-step-animate">{[['1','Bring your details','Enter income, loans, investments and goals. You choose what to share.'],['2','Analyse','Everything is organised in one view using India-specific tax and product rules.'],['3','Inspect','See the sources, evidence and calculations behind every answer.'],['4','Decide','Get plans and next steps in English or Hinglish, then act on your own terms.']].map(s=><div key={s[0]}><span>{s[0]}</span><h4>{s[1]}</h4><p>{s[2]}</p></div>)}</div></div></section>
 <section id="lab" className="cl-section cl-soft cl-reveal-section tone-violet"><div className="cl-wrap"><div className="cl-eyebrow">AI Reliability Lab</div><h2>Answer. Evaluate. Evidence. Reliability.</h2><p className="cl-sub">Financial AI should be checked, not just believed. The workspace makes visible checks part of the answer.</p><div className="cl-lab"><div className="cl-card cl-question"><small>USER QUESTION</small><h3>What happens to my investment if inflation rises?</h3>{checks.map((c,i)=><div key={c[0]} className={"cl-check "+(i<passedChecks?"on":"")}><span>{c[0]}</span><b>{i<passedChecks&&c[1]?"✓ Pass":i===5&&passedChecks===6?"Needs evidence":"Checking"}</b></div>)}<div className="cl-score"><div className={'cl-score-ring '+(lab?'is-complete':'')}><svg className="cl-score-arc" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19.8" className="cl-score-track"/><circle id="arc" cx="22" cy="22" r="19.8" className="cl-score-progress" pathLength="1" style={{strokeDashoffset:String(scoreRingOffset(Math.min(passedChecks,checks.filter(c=>c[1]).length),SAMPLE_CHECK_COUNT))}}/></svg><span className="cl-score-value">{Math.min(passedChecks,checks.filter(c=>c[1]).length)}<small>of {SAMPLE_CHECK_COUNT}</small></span></div><div><b>checks passed</b><span>sample evaluation</span></div></div><button className="cl-primary cl-small" onClick={()=>setLab(true)}>{lab?'Evaluation complete':'Run sample evaluation'}</button></div><div className="cl-evidence cl-reveal">{[['Market data','Current financial information'],['Economic data','Rates, inflation and macro indicators'],['Structured knowledge','Verified financial concepts'],['Calculation','Deterministic financial computation']].map(x=><div className="cl-card" key={x[0]}><span className="cl-dot"/><div><b>{x[0]}</b><p>{x[1]}</p></div><CheckCircle2 size={17}/></div>)}</div></div></div></section>
 <LandingMarketDashboard/>
 <LandingReviews/>
 <section id="trust" className="cl-section cl-trust cl-reveal-section tone-forest"><div className="cl-wrap"><div className="cl-eyebrow">Trust & privacy</div><h2>Independent by design.</h2><p className="cl-sub">ArthaMind AI is not a brokerage and does not execute trades. It exists to help you understand, inspect and decide.</p><div className="cl-trust-grid" data-stagger>{[['01','Public tools first','Explore markets, learning and the Reliability Lab before you sign in.'],['02','Personal context is opt-in','Your personal data is off by default and only used when you turn it on.'],['03','Evidence, not opinion','Every answer shows what supports it, so you can verify it yourself.'],['04','Educational scope','Built for education and research. It is not investment advice.']].map(x=><div className="cl-card" key={x[0]}><span className="cl-module-icon">{x[0]}</span><h4>{x[1]}</h4><p>{x[2]}</p></div>)}</div><div className="cl-final"><h2>Your AI CFO is ready.</h2><p>Run a free health check, ask about taxes, EMIs or goals, then take the plan into your private workspace.</p><div className="cl-actions"><button className="cl-primary cl-glow" onClick={scrollToCfo}><Sparkles size={16}/>Ask your AI CFO</button><button className="cl-secondary" onClick={()=>open('overview')}>Open Artha Bench Pro <ArrowRight size={16}/></button><button className="cl-secondary" onClick={()=>open('evaluation-lab')}>Test an AI answer</button></div></div></div></section>
 </main><button type="button" className={'cl-top '+(showTop?'show':'')} aria-label="Back to top" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><ArrowUp size={17}/></button><footer className="cl-footer"><div className="cl-wrap"><b>ArthaMind AI × Artha Bench Pro</b><span>India-focused financial intelligence, education and AI reliability. Educational/research use only—not investment, tax, legal or lending advice.</span></div></footer>
 </div>
};