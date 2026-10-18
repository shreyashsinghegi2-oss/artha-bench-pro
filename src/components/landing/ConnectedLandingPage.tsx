import React,{useEffect,useRef,useState}from'react';
import { installTilt } from '../../lib/tilt3d';
import { lazyOnView } from './lazyOnView';
const PhoneShowcase=lazyOnView(()=>import('./PhoneShowcase').then(m=>({default:m.PhoneShowcase})),{minHeight:900,anchorId:'phone-tour'});
const MoneyCheck=lazyOnView(()=>import('./MoneyCheck').then(m=>({default:m.MoneyCheck})),{minHeight:900,anchorId:'money-check'});
import{ArrowDown,ArrowRight,ArrowUp,CheckCircle2,Menu,Sparkles,X}from'lucide-react';
import type{AppNavigationDestination}from'../../navigationTypes';
import type{NormalizedMarketQuote}from'../../types';
import{fetchBusinessNews}from'../../services/learningApi';
import { ArthaMindMark } from './ArthaMindMark';
import { LandingHero } from './LandingHero';
const LiveMarketTicker=lazyOnView(()=>import('./LiveMarketTicker').then(m=>({default:m.LiveMarketTicker})),{minHeight:120});
import{LazyCryptoMarketPreview as CryptoMarketPreview}from'./LazyCryptoMarketPreview';
const BusinessNewsTicker=lazyOnView(()=>import('./BusinessBrief').then(m=>({default:m.BusinessNewsTicker})),{minHeight:48});type LandingNews=ReturnType<typeof import('./BusinessBrief')['normalizeBusinessNews']>;
import{LandingPricing}from'./LandingPricing';
import{LandingProducts}from'./LandingProducts';
import{ContactLinks}from'../common/ContactLinks';
import'./connectedLanding.css';
import'./landingMotion.css';
import{useLandingMotion}from'./useLandingMotion';
import{MENU,NavMenu}from'./NavMenu';
import{pathForDestination}from'../../appRoutes';
import{WAITLIST_AS_OF,WAITLIST_COUNT}from'../../data/waitlist';
const LandingAiCfo=lazyOnView(()=>import('./LandingAiCfo').then(m=>({default:m.LandingAiCfo})),{minHeight:900,anchorId:'ai-cfo'});
const LandingPurpose=lazyOnView(()=>import('./LandingPurpose').then(m=>({default:m.LandingPurpose})),{minHeight:700,anchorId:'purpose'});
const LanguagesStory=lazyOnView(()=>import('./LanguagesStory').then(m=>({default:m.LanguagesStory})),{minHeight:700,anchorId:'languages'});
const ReviewsStory=lazyOnView(()=>import('./ReviewsStory').then(m=>({default:m.ReviewsStory})),{minHeight:700});

type Props={signedIn:boolean;onEnter:(destination?:AppNavigationDestination)=>void;onSignIn:()=>void;onSignUp?:()=>void};
type MacroCard={label:string;value:string;delta:string;direction:'up'|'down'|'flat'|'none'};
const CAPABILITIES=['Old vs new tax regime','80C · 80D · NPS room','EMI prepayment vs invest','6-month emergency runway','SIP for every goal','Retirement corpus','Term & health cover gap','Home-loan affordability','Business cash flow','Credit-card debt payoff','Hindi & Hinglish answers','Verified ₹ calculations'];
/** Cycles hero phrases with a slide-up transition; shows the first phrase only for reduced motion. */
/** Formats a provider quote for a macro card. A missing or non-finite change is shown as unavailable, never as +0.00%. */
export function macroCardFromQuote(label:string,quote:NormalizedMarketQuote|undefined):MacroCard{const price=quote?Number(quote.price):NaN;const change=quote&&quote.changePercent!=null?Number(quote.changePercent):NaN;const value=Number.isFinite(price)?price.toLocaleString('en-IN',{maximumFractionDigits:2}):'';if(!quote)return{label,value,delta:'Connect data source',direction:'none'};if(!Number.isFinite(change))return{label,value,delta:'Change unavailable',direction:'none'};const rounded=Math.round(change*100)/100;return{label,value,delta:(rounded>0?'+':rounded<0?'−':'')+Math.abs(rounded).toFixed(2)+'%',direction:rounded>0?'up':rounded<0?'down':'flat'};}
/** Share of the ring to leave unfilled for `passed` of `total` checks (0 = full ring). */
export function scoreRingOffset(passed:number,total:number):number{if(!(total>0))return 1;return 1-Math.min(Math.max(passed,0),total)/total;}
// Target is a workspace, or `ask:<question>` to hand the question to the AI CFO on this page.
export const ConnectedLandingPage:React.FC<Props>=({signedIn,onEnter,onSignIn,onSignUp})=>{
 const[scrolled,setScrolled]=useState(false),[active,setActive]=useState('workspace'),[news,setNews]=useState<LandingNews>([]);
 const rootRef=useRef<HTMLDivElement>(null);const[menuOpen,setMenuOpen]=useState(false);useEffect(()=>{if(!menuOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenuOpen(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[menuOpen]);const[cfoPrompt,setCfoPrompt]=useState<{id:number;text:string}|null>(null);const[showTop,setShowTop]=useState(false);useLandingMotion(rootRef);
 useEffect(()=>{const el=rootRef.current;if(!el)return;return installTilt(el,{selector:'.cl-card, .mk-card',maxWidth:560,maxDeg:7});},[]);
 useEffect(()=>{const f=()=>{setScrolled(window.scrollY>8);setShowTop(window.scrollY>900)};f();addEventListener('scroll',f,{passive:true});return()=>removeEventListener('scroll',f)},[]);
 useEffect(()=>{const move=(e:MouseEvent)=>{const card=(e.target as HTMLElement)?.closest?.('.cl-card') as HTMLElement|null;if(!card)return;const r=card.getBoundingClientRect();card.style.setProperty('--mx',e.clientX-r.left+'px');card.style.setProperty('--my',e.clientY-r.top+'px')};document.addEventListener('mousemove',move);return()=>document.removeEventListener('mousemove',move)},[]);
 useEffect(()=>{const ids=['top','purpose','money-check','ai-cfo','modules','how','lab','trust'];const els=ids.map(id=>document.getElementById(id)).filter(Boolean)as HTMLElement[];if(!els.length)return;const ob=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(v)setActive((v.target as HTMLElement).id==='top'?'workspace':(v.target as HTMLElement).id)},{rootMargin:'-20% 0px -60% 0px',threshold:[.15,.35,.6]});els.forEach(e=>ob.observe(e));const reveal=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)(e.target as HTMLElement).classList.add('in')}),{rootMargin:'0px 0px 10% 0px',threshold:0});document.querySelectorAll('.cl-reveal,.cl-reveal-section').forEach(e=>reveal.observe(e));return()=>{ob.disconnect();reveal.disconnect()}},[]);
 useEffect(()=>{let alive=true;const load=async()=>{try{const [business,general,{normalizeBusinessNews}]=await Promise.all([fetchBusinessNews(undefined,'business'),fetchBusinessNews(undefined,'all'),import('./BusinessBrief')]);if(alive){const items=[...normalizeBusinessNews(business),...normalizeBusinessNews(general)];const seen=new Set<string>();setNews(items.filter(x=>{const k=(x.url||x.title).toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,12))}}catch{if(alive)setNews([])}};void load();const t=window.setInterval(()=>void load(),45000);return()=>{alive=false;window.clearInterval(t)}},[]);

 // Visitors sign up first; the destination opens right after sign-in.
 const signUp=onSignUp??onSignIn;
 const open=(d:AppNavigationDestination)=>{if(signedIn)return onEnter(d);try{sessionStorage.setItem('arthabench_pending_private_return_v1',pathForDestination(d))}catch{/* storage blocked */}signUp();};
 const scrollToId=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 const scrollToCfo=()=>scrollToId('ai-cfo');
 const askCfo=(text:string)=>{scrollToCfo();if(text.trim())setCfoPrompt({id:Date.now(),text});};
 return <div ref={rootRef} className="connected-landing">
 <div className="cl-progress" aria-hidden="true"/>
 <header className={'cl-header '+(scrolled?'is-scrolled':'')}><div className="cl-wrap cl-nav">
  <a href="#top" className="cl-brand" aria-label="ArthaMind AI by Artha Bench Pro, back to top"><ArthaMindMark size={34}/><span className="am-brand-text"><b>ArthaMind <em>AI</em></b><small>by Artha Bench Pro</small></span></a>
  <div className="cl-links"><NavMenu onPick={open}/></div>
  <div className="cl-right">{signedIn?<button type="button" className="cl-signup" onClick={()=>onEnter('overview')}>Open workspace</button>:<button type="button" className="cl-signup" onClick={signUp}>Sign up</button>}<button type="button" className="cl-menu-button" aria-label={menuOpen?'Close menu':'Open menu'} aria-expanded={menuOpen} aria-controls="cl-mobile-menu" onClick={()=>setMenuOpen(v=>!v)}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button></div>
 </div>
 <div id="cl-mobile-menu" className={'cl-mobile-menu '+(menuOpen?'open':'')} hidden={!menuOpen}><nav aria-label="Products" className="nm-mobile">{MENU.map(g=><div key={g.id}><h4>{g.label}</h4>{g.items.map(it=><button key={it.label} type="button" onClick={()=>{setMenuOpen(false);open(it.to)}}>{it.label}</button>)}</div>)}</nav></div>
 </header>
 <main id="top">
 <LandingHero/>
 <LandingProducts onTryMind={()=>scrollToId('money-check')} onOpenBench={()=>open('overview')}/>
 <div className="cl-stat-strip"><div className="cl-wrap cl-stats" data-stagger><div><b data-n={WAITLIST_COUNT} data-suffix="+">{WAITLIST_COUNT.toLocaleString('en-IN')}+</b><span>joined the early-access waitlist ({WAITLIST_AS_OF})</span></div><div><b data-n="15">15</b><span>money modules in one app</span></div><div><b data-n="20">20</b><span>languages: 13 Indian and 7 international</span></div><div><b>Evidence</b><span>first: every answer shows what supports it</span></div></div></div>
 <div className="cl-marquee" aria-label="What the AI CFO covers"><div className="cl-marquee-track">{[...CAPABILITIES,...CAPABILITIES].map((c,i)=><span key={i} aria-hidden={i>=CAPABILITIES.length?true:undefined}><i/>{c}</span>)}</div></div>
 <LandingPurpose onSample={()=>scrollToId('money-check')} onExplore={()=>open('overview')}/>
 <PhoneShowcase onTry={()=>scrollToId('money-check')}/>
 <MoneyCheck onAsk={askCfo}/>
 <LandingAiCfo onEnter={open} externalPrompt={cfoPrompt}/>
 <LiveMarketTicker/><CryptoMarketPreview/><BusinessNewsTicker articles={news}/>
 <LandingPricing onStart={()=>open('overview')} onSample={()=>scrollToId('money-check')}/>
 <ReviewsStory/>
 {signedIn?<LanguagesStory ctaLabel="Open your workspace" onCta={()=>open('overview')}/>:<LanguagesStory ctaLabel="Sign up free" onCta={onSignUp??onSignIn} autoPrompt/>}
 </main><button type="button" className={'cl-top '+(showTop?'show':'')} aria-label="Back to top" onClick={()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}><ArrowUp size={17}/></button><footer className="cl-footer" id="contact"><div className="cl-wrap cl-footer-grid"><div className="cl-footer-brand"><b>ArthaMind AI</b><span>Your AI CFO for India and Indians abroad: tax, loans, goals and investments. App in 20 languages; AI CFO in 13 Indian languages.</span><nav className="cl-footer-links" aria-label="More"><a href="#pricing">Pricing</a><a href="/data-protection">Data protection</a><a href="/terms.html">Terms &amp; conditions</a><a href="/privacy.html">Privacy policy</a><button type="button" onClick={()=>open('evaluation-lab')}>Answer checker</button></nav></div><div className="cl-footer-contact"><h2>Talk to us</h2><ContactLinks/></div></div><div className="cl-wrap cl-footer-legal"><span>© {new Date().getFullYear()} ArthaMind AI. ArthaMind gives financial information and planning tools. It is not a SEBI-registered investment adviser, does not give personalised investment advice, and never places trades. By using ArthaMind you agree to our <a href="/terms.html">Terms &amp; conditions</a> and <a href="/privacy.html">Privacy policy</a>.</span></div></footer>
 </div>
};