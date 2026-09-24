import React from 'react';
import { ArthaMindLogoMark, BRAND } from './ArthaMindBrand';

interface ArthaBenchLogoProps {
  iconOnly?: boolean;
  className?: string;
  compact?: boolean;
  /** Light text for dark backgrounds. */
  onDark?: boolean;
}

/** Workspace brand mark: the official ArthaMind AI app icon. Size it with className (e.g. "h-10 w-10"). */
export const ArthaBenchMark: React.FC<{ className?: string }> = ({ className = 'h-10 w-10' }) => (
  <ArthaMindLogoMark tone="app" size={40} className={className} title="ArthaMind AI" />
);

/** Workspace header brand: ArthaMind AI mark and name, with the Artha Bench Pro parent label. */
export const ArthaBenchLogo: React.FC<ArthaBenchLogoProps> = ({
  iconOnly = false,
  className = '',
  compact = false,
  onDark = false,
}) => (
  <div className={`inline-flex items-center gap-2.5 ${className}`.trim()}>
    <ArthaBenchMark className={`${compact ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 rounded-[10px] shadow-sm`} />
    {!iconOnly && (
      <div className="min-w-0 leading-none">
        <span className={`${compact ? 'text-sm' : 'text-base'} font-black tracking-tight ${onDark ? 'text-white' : 'text-ink'} whitespace-nowrap`}>
          ArthaMind <span style={{ color: BRAND.green }}>AI</span>
        </span>
        {!compact && (
          <p className="mt-1 hidden text-[10px] font-semibold tracking-wide text-secondary sm:block">
            by Artha Bench Pro
          </p>
        )}
      </div>
    )}
  </div>
);
