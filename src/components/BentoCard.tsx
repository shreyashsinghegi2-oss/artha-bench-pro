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
    purple: 'bg-interactive/20 text-interactive border-interactive/40',
    cyan: 'bg-interactive/20 text-interactive border-interactive/40',
    emerald: 'bg-success-fill/20 text-success border-success-fill/40',
    amber: 'bg-warning-fill/20 text-warning border-warning-fill/40',
    rose: 'bg-danger/20 text-danger border-danger/40',
    slate: 'bg-subtle text-secondary border-line',
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
      className={`bg-surface border border-line rounded-2xl p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:border-interactive/50 hover:bg-surface' : ''
      } ${className}`}
    >
      {(title || icon || badge) && (
        <div className="flex items-center justify-between gap-3 mb-4 border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-xl bg-canvas border border-line flex items-center justify-center text-interactive shrink-0">
                {renderIcon()}
              </div>
            )}
            <div>
              {title && <h3 className="font-semibold text-ink text-sm">{title}</h3>}
              {subtitle && <p className="text-xs text-secondary mt-0.5">{subtitle}</p>}
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
