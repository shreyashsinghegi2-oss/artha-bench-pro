import React, { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  ['en','English'],['hi','हिन्दी'],['mr','मराठी'],['gu','ગુજરાતી'],['bn','বাংলা'],['ta','தமிழ்'],['te','తెలుగు'],['kn','ಕನ್ನಡ'],['ml','മലയാളം'],['pa','ਪੰਜਾਬੀ'],['ur','اردو'],['or','ଓଡ଼ିଆ'],['as','অসমীয়া'],['es','Español'],['fr','Français'],['de','Deutsch'],['ar','العربية'],['pt','Português'],['it','Italiano'],['ja','日本語']
] as const;
const STORAGE_KEY='artha-bench-global-language';
declare global { interface Window { google?: any; } }

function applyGoogleLanguage(code:string){
  if(code==='en'){
    document.cookie='googtrans=/en/en;path=/';
    const select=document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if(select){select.value='en';select.dispatchEvent(new Event('change'));return true;}
    return false;
  }
  const select=document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if(select){select.value=code;select.dispatchEvent(new Event('change'));return true;}
  return false;
}

export const LanguageSelector:React.FC<{compact?:boolean}>=({compact=false})=>{
 const [language,setLanguage]=useState(()=>typeof window==='undefined'?'en':window.localStorage.getItem(STORAGE_KEY)||'en');
 useEffect(()=>{
   if(typeof window==='undefined')return;
   const init=()=>{
     if(!window.google?.translate?.TranslateElement||document.querySelector('.artha-google-widget'))return;
     const host=document.createElement('div');host.className='artha-google-widget';host.style.display='none';host.setAttribute('aria-hidden','true');document.body.appendChild(host);
     new window.google.translate.TranslateElement({pageLanguage:'en',includedLanguages:SUPPORTED_LANGUAGES.map(([code])=>code).filter(code=>code!=='en').join(','),autoDisplay:false},host);
   };
   const callback='arthaGoogleTranslateInit';
   (window as any)[callback]=init;
   if(!document.getElementById('artha-google-translate')){const script=document.createElement('script');script.id='artha-google-translate';script.src=`https://translate.google.com/translate_a/element.js?cb=${callback}`;script.async=true;document.head.appendChild(script);}
   const timer=window.setInterval(()=>{init();if(applyGoogleLanguage(language))window.clearInterval(timer);},300);
   return()=>window.clearInterval(timer);
 },[language]);
 const change=(code:string)=>{setLanguage(code);window.localStorage.setItem(STORAGE_KEY,code);document.documentElement.lang=code;applyGoogleLanguage(code);window.setTimeout(()=>applyGoogleLanguage(code),400);window.setTimeout(()=>applyGoogleLanguage(code),1200);};
 const currentName=SUPPORTED_LANGUAGES.find(([code])=>code===language)?.[1]||'English';
 return <div className="relative flex items-center" title={`Language: ${currentName}`}>
   <Languages className="pointer-events-none absolute left-2.5 h-4 w-4 text-secondary" aria-hidden="true" />
   <label className="sr-only" htmlFor="artha-global-language">Select language</label>
   <select id="artha-global-language" value={language} onChange={e=>change(e.target.value)} className={`appearance-none rounded-xl border border-line bg-surface pl-8 pr-7 text-xs font-bold text-ink outline-none transition hover:border-interactive/50 focus:border-interactive focus:ring-2 focus:ring-interactive/20 ${compact?'h-9 w-[120px]':'h-10 w-[150px]'}`}>
     {SUPPORTED_LANGUAGES.map(([code,name])=><option key={code} value={code}>{name}</option>)}
   </select>
 </div>;
};
