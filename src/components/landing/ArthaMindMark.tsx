import React from 'react';
import { ArthaMindLogoMark, type MarkTone } from '../branding/ArthaMindBrand';

/** Official ArthaMind AI mark (kept under this name for existing call sites). */
export const ArthaMindMark: React.FC<{ size?: number; className?: string; title?: string; tone?: MarkTone }> = ({ size = 24, className = '', title, tone = 'ink' }) => (
  <ArthaMindLogoMark size={size} tone={tone} className={className} title={title} />
);
