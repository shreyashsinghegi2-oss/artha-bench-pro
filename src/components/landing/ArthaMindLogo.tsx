import React from 'react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';

type Props = { className?: string; compact?: boolean };

/** Landing brand mark: the official ArthaMind AI app icon. Size it with className. */
export const ArthaMindLogo: React.FC<Props> = ({ className = '' }) => (
  <ArthaMindLogoMark tone="app" size={40} className={className} title="ArthaMind AI" />
);
