import React from 'react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';

/** The official ArthaMind AI mark used as the avatar of every AI assistant. */
export const AssistantLogo: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) =>
  <ArthaMindLogoMark tone="app" size={size} className={`shrink-0 rounded-[9px] ${className}`.trim()} title="ArthaMind AI"/>;
