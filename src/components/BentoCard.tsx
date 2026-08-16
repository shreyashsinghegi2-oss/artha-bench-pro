import React from 'react';

interface BentoCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: string;
  badgeColor?: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate' | 'purple';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  title,
  subtitle,
  icon,
  badge,
  badgeColor = 'purple',
  children,
  className = '',
  onClick,
}) => {
  const badgeStyles = {
    purple: 'bg-[#4F32FF]/20 text-[#665CFF] border-[#4F32FF]/40',
    cyan: 'bg-[#16C7E8]/20 text-[#16C7E8] border-[#16C7E8]/40',
    emerald: 'bg-[#00D68F]/20 text-[#00D68F] border-[#00D68F]/40',
    amber: 'bg-[#F5B800]/20 text-[#F5B800] border-[#F5B800]/40',
    rose: 'bg-[#FF3B65]/20 text-[#FF3B65] border-[#FF3B65]/40',
    slate: 'bg-[#1A1A23] text-[#9A9AAA] border-[#1A1A23]',
  };

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return <IconComponent className="w-4 h-4" />;
  };

  return (
    <div
      onClick={onClick}
      className={`bg-[#08080E] border border-[#1A1A23] rounded-2xl p-5 shadow-xl transition-all ${
        onClick ? 'cursor-pointer hover:border-[#4F32FF]/50 hover:bg-[#07070B]' : ''
      } ${className}`}
    >
      {(title || icon || badge) && (
        <div className="flex items-center justify-between gap-3 mb-4 border-b border-[#1A1A23] pb-3">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-xl bg-[#030303] border border-[#1A1A23] flex items-center justify-center text-[#665CFF] shrink-0">
                {renderIcon()}
              </div>
            )}
            <div>
              {title && <h3 className="font-semibold text-[#F7F7FB] text-sm">{title}</h3>}
              {subtitle && <p className="text-xs text-[#9A9AAA] mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {badge && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyles[badgeColor]}`}>
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
};
