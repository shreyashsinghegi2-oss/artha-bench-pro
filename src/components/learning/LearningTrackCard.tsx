import React from 'react';
import {
  Wallet,
  TrendingUp,
  ShieldAlert,
  Coins,
  Building2,
  Briefcase,
  LineChart,
  DollarSign,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { LearningTrack } from '../../types';

interface LearningTrackCardProps {
  track: LearningTrack;
  completedLessonCount: number;
  totalLessonCount: number;
  onSelectTrack: (trackId: string) => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wallet,
  TrendingUp,
  ShieldAlert,
  Coins,
  Building2,
  Briefcase,
  LineChart,
  DollarSign,
};

export const LearningTrackCard: React.FC<LearningTrackCardProps> = ({
  track,
  completedLessonCount,
  totalLessonCount,
  onSelectTrack,
}) => {
  const Icon = ICON_MAP[track.iconName] || Wallet;
  const progressPercent =
    totalLessonCount > 0 ? Math.round((completedLessonCount / totalLessonCount) * 100) : 0;

  return (
    <div
      onClick={() => onSelectTrack(track.id)}
      className="bg-surface border border-line hover:border-line-strong/80 rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-sm flex flex-col justify-between group"
    >
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-hover border border-line-strong/80 flex items-center justify-center text-success group-hover:bg-success-soft/60 group-hover:border-success-fill/60 transition-colors">
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-hover text-secondary border border-line-strong">
            {track.riskLabel}
          </span>
        </div>

        <h3 className="font-bold text-ink text-base group-hover:text-success transition-colors">
          {track.title}
        </h3>
        <p className="text-xs text-secondary mt-1.5 line-clamp-2 leading-relaxed">
          {track.description}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-line/80">
        <div className="flex items-center justify-between text-xs text-secondary mb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-secondary" />
            <span>~{track.estimatedHours} hrs</span>
          </div>
          <span className="font-semibold text-secondary">{progressPercent}% Completed</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-hover rounded-full overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs font-semibold text-success group-hover:translate-x-0.5 transition-transform">
          <span>{progressPercent === 100 ? 'Completed' : 'Explore Curriculum'}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
