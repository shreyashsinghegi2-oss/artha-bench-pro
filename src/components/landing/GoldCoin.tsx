import React from 'react';

/** Gold coin face: polished metal with a bevelled rim, engraved brand name and a specular highlight. */
export const CoinFace: React.FC<{ id: string }> = ({ id }) => <svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c2"/><stop offset=".22" stopColor="#f0c75a"/><stop offset=".5" stopColor="#9a6a12"/><stop offset=".72" stopColor="#f6d77a"/><stop offset="1" stopColor="#7a5410"/></linearGradient>
    <radialGradient id={`${id}-g`} cx="36%" cy="30%" r="78%"><stop offset="0" stopColor="#fff1b8"/><stop offset=".35" stopColor="#f2c451"/><stop offset=".7" stopColor="#c8921f"/><stop offset="1" stopColor="#8f6310"/></radialGradient>
    <radialGradient id={`${id}-c`} cx="42%" cy="36%" r="72%"><stop offset="0" stopColor="#ffe28a"/><stop offset=".6" stopColor="#dca63a"/><stop offset="1" stopColor="#b07c1c"/></radialGradient>
    <radialGradient id={`${id}-spec`} cx="32%" cy="24%" r="38%"><stop offset="0" stopColor="#fffdf2" stopOpacity=".95"/><stop offset="1" stopColor="#fffdf2" stopOpacity="0"/></radialGradient>
    <path id={`${id}-t`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/>
  </defs>
  <circle cx="60" cy="60" r="59" fill={`url(#${id}-rim)`}/>
  <circle cx="60" cy="60" r="54.5" fill={`url(#${id}-g)`}/>
  <circle cx="60" cy="60" r="53" fill="none" stroke="#7a5410" strokeWidth="1.1" strokeDasharray="1 2.1" opacity=".75"/>
  <text fontSize="7" fontWeight="900" letterSpacing="2.1" fill="#6b4a0c" opacity=".9"><textPath href={`#${id}-t`}>ARTHAMIND AI · ARTHA BENCH PRO · INDIA ·</textPath></text>
  <circle cx="60" cy="60" r="36" fill={`url(#${id}-c)`} stroke="#8f6310" strokeWidth="1.4"/>
  <circle cx="60" cy="60" r="34.5" fill="none" stroke="#fff3c4" strokeWidth=".8" opacity=".55"/>
  <ellipse cx="46" cy="36" rx="30" ry="18" fill={`url(#${id}-spec)`}/>
</svg>;

