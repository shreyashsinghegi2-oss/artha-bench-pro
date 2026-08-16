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
      <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#665CFF]/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xl transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider">
            Progress
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#4F32FF]/15 border border-[#4F32FF]/30 flex items-center justify-center text-[#665CFF]">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-[#F7F7FB]">{progressPercent}%</div>
          <p className="text-[11px] text-[#9A9AAA] mt-0.5 whitespace-nowrap">
            {completedCount} of {totalLessons} lessons
          </p>
        </div>
        {/* Thin ArthaBench Purple Progress Bar */}
        <div className="w-full bg-[#1A1A23] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#4F32FF] to-[#665CFF] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </div>

      {/* Card 2: Learning Streak */}
      <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#F5B800]/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xl transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider">
            Learning Streak
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#F5B800]/15 border border-[#F5B800]/30 flex items-center justify-center text-[#F5B800]">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-[#F7F7FB]">{progress.streakDays}</div>
          <p className="text-[11px] text-[#9A9AAA] mt-0.5">days</p>
        </div>
        <div className="h-1.5" />
      </div>

      {/* Card 3: Bookmarks */}
      <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#00D68F]/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xl transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider">
            Bookmarks
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#00D68F]/15 border border-[#00D68F]/30 flex items-center justify-center text-[#00D68F]">
            <Bookmark className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-[#F7F7FB]">
            {progress.bookmarkedLessonIds.length}
          </div>
          <p className="text-[11px] text-[#9A9AAA] mt-0.5">Saved lessons</p>
        </div>
        <div className="h-1.5" />
      </div>

      {/* Card 4: Study Notes */}
      <div className="bg-[#0A0A12] border border-[#1E1E2D] hover:border-[#8F3BFF]/40 rounded-2xl p-5 flex flex-col justify-between space-y-3 shadow-xl transition-all">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[#8A8A9E] uppercase tracking-wider">
            Study Notes
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#8F3BFF]/15 border border-[#8F3BFF]/30 flex items-center justify-center text-[#8F3BFF]">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-[#F7F7FB]">{savedNotesCount}</div>
          <p className="text-[11px] text-[#9A9AAA] mt-0.5">Saved notes</p>
        </div>
        <div className="h-1.5" />
      </div>
    </div>
  );
};
