import React from 'react';
import { Target, Flame, Bookmark, FileText } from 'lucide-react';
import { LearningProgress } from '../../types';

interface ProgressSummaryProps {
  progress: LearningProgress;
  totalLessons: number;
}

export const ProgressSummary: React.FC<ProgressSummaryProps> = ({ progress, totalLessons }) => {
  const completedCount = progress.completedLessonIds.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const savedNotesCount = Object.keys(progress.savedNotes || {}).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* Card 1: Course Progress */}
      <div className="bg-surface border border-line hover:border-interactive/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
            Progress
          </span>
          <div className="w-8 h-8 rounded-xl bg-interactive/15 border border-interactive/30 flex items-center justify-center text-interactive">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-ink">{progressPercent}%</div>
          <p className="text-[11px] text-secondary mt-0.5 whitespace-nowrap">
            {completedCount} of {totalLessons} lessons
          </p>
        </div>
        {/* Thin ArthaBench Purple Progress Bar */}
        <div className="w-full bg-subtle h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-interactive h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </div>

      {/* Card 2: Learning Streak */}
      <div className="bg-surface border border-line hover:border-warning-fill/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
            Learning Streak
          </span>
          <div className="w-8 h-8 rounded-xl bg-warning-fill/15 border border-warning-fill/30 flex items-center justify-center text-warning">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-ink">{progress.streakDays}</div>
          <p className="text-[11px] text-secondary mt-0.5">days</p>
        </div>
        <div className="h-1.5" />
      </div>

      {/* Card 3: Bookmarks */}
      <div className="bg-surface border border-line hover:border-success-fill/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
            Bookmarks
          </span>
          <div className="w-8 h-8 rounded-xl bg-success-fill/15 border border-success-fill/30 flex items-center justify-center text-success">
            <Bookmark className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-ink">
            {progress.bookmarkedLessonIds.length}
          </div>
          <p className="text-[11px] text-secondary mt-0.5">Saved lessons</p>
        </div>
        <div className="h-1.5" />
      </div>

      {/* Card 4: Study Notes */}
      <div className="bg-surface border border-line hover:border-interactive/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">
            Study Notes
          </span>
          <div className="w-8 h-8 rounded-xl bg-interactive/15 border border-interactive/30 flex items-center justify-center text-interactive">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-ink">{savedNotesCount}</div>
          <p className="text-[11px] text-secondary mt-0.5">Saved notes</p>
        </div>
        <div className="h-1.5" />
      </div>
    </div>
  );
};
