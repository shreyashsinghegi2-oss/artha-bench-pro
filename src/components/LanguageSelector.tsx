import React, { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  ['en','English'],['hi','हिन्दी'],['mr','मराठी'],['gu','ગુજરાતી'],['bn','বাংলা'],['ta','தமிழ்'],['te','తెలుగు'],['kn','ಕನ್ನಡ'],['ml','മലയാളം'],['pa','ਪੰਜਾਬੀ'],['ur','اردو'],['or','ଓଡ଼ିଆ'],['as','অসমীয়া'],['es','Español'],['fr','Français'],['de','Deutsch'],['ar','العربية'],['pt','Português'],['it','Italiano'],['ja','日本語']
] as const;

const STORAGE_KEY='artha-bench-global-language';
const GOOGLE_SELECT='google_translate_element_select';

declare global { interface Window { google?: any; __arthaTranslateReady?: boolean; } }

function applyGoogleLanguage(code:string){
  const select=document.querySelector<HTMLSelectElement>(`.goog-te-combo`);
  if(select){select.value=code;select.dispatchEvent(new Event('change'));return true;}
  return false;
}

export const LanguageSelector:React.FC<{compact?:boolean}>=({compact=false})=>{
 const [language,setLanguage]=useState(()=>typeof window==='undefined'?'en':window.localStorage.getItem(STORAGE_KEY)||'en');
 useEffect(()=>{
   const timer=window.setInterval(()=>{ if(window.google?.translate?.TranslateElement){window.clearInterval(timer);window.__arthaTranslateReady=true;applyGoogleLanguage(language);} },250);
   return()=>window.clearInterval(timer);
 },[language]);
 const change=(code:string)=>{setLanguage(code);window.localStorage.setItem(STORAGE_KEY,code);document.documentElement.lang=code;if(!applyGoogleLanguage(code)){window.setTimeout(()=>applyGoogleLanguage(code),700);}};
 const currentName=SUPPORTED_LANGUAGES.find(([code])=>code===language)?.[1]||'English';
 return <div className="relative flex items-center" title={`Language: ${currentName}`}>
   <div id={GOOGLE_SELECT} className="hidden" aria-hidden="true" />
   <Languages className="pointer-events-none absolute left-2.5 h-4 w-4 text-secondary" aria-hidden="true" />
   <label className="sr-only" htmlFor="artha-global-language">Select language</label>
   <select id="artha-global-language" value={language} onChange={e=>change(e.target.value)} className={`appearance-none rounded-xl border border-line bg-surface pl-8 pr-7 text-xs font-bold text-ink outline-none transition hover:border-interactive/50 focus:border-interactive focus:ring-2 focus:ring-interactive/20 ${compact?'h-9 w-[120px]':'h-10 w-[150px]'}`}>
     {SUPPORTED_LANGUAGES.map(([code,name])=><option key={code} value={code}>{name}</option>)}
   </select>
 </div>;
};

export function installGoogleTranslate(){
 if(typeof window==='undefined'||document.getElementById('google-translate-script'))return;
 const callback='arthaGoogleTranslateInit';
 (window as any)[callback]=()=>{window.__arthaTranslateReady=true;};
 const script=document.createElement('script');script.id='google-translate-script';script.src=`https://translate.google.com/translate_a/element.js?cb=${callback}`;script.async=true;document.head.appendChild(script);
 const host=document.getElementById(GOOGLE_SELECT);
 if(host && !host.querySelector('.gtranslate-host')){const el=document.createElement('div');el.className='gtranslate-host';host.appendChild(el);new MutationObserver(()=>{});}
}
