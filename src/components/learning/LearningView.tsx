import React, { useState, useEffect } from 'react';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { LEARNING_TRACKS } from '../../data/learningTracks';
import { LearningTrack, Module as LearningModule, Lesson } from '../../types';
import { LearningTrackCard } from './LearningTrackCard';
import { LearningModuleList } from './LearningModuleList';
import { LessonViewer } from './LessonViewer';
import { ProgressSummary } from './ProgressSummary';
import { SafetyBanner } from '../SafetyBanner';
import {
  saveUserProgress,
  getOverallProgressPercentage,
  getLearningProgress,
  markLessonCompleted,
  toggleBookmarkLesson,
  saveLessonNote,
} from '../../services/learningStorage';

export const LearningView: React.FC = () => {
  const [selectedTrack, setSelectedTrack] = useState<LearningTrack | null>(null);
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);

  const progressState = getLearningProgress();

  useEffect(() => {
    setOverallProgress(getOverallProgressPercentage());
  }, [selectedLesson]);

  const handleSelectTrack = (track: LearningTrack) => {
    setSelectedTrack(track);
    setSelectedModule(null);
    setSelectedLesson(null);
  };

  const handleSelectModule = (module: LearningModule) => {
    setSelectedModule(module);
    if (module.lessons.length > 0) {
      setSelectedLesson(module.lessons[0]);
    }
  };

  const handleCompleteLesson = (score: number) => {
    if (!selectedTrack || !selectedModule || !selectedLesson) return;

    saveUserProgress({
      trackId: selectedTrack.id,
      moduleId: selectedModule.id,
      lessonId: selectedLesson.id,
      completed: true,
      quizScore: score,
      completedAt: new Date().toISOString(),
    });

    setOverallProgress(getOverallProgressPercentage());

    // Advance to next lesson if available
    const currentIndex = selectedModule.lessons.findIndex((l) => l.id === selectedLesson.id);
    if (currentIndex < selectedModule.lessons.length - 1) {
      setSelectedLesson(selectedModule.lessons[currentIndex + 1]);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Header Banner & KPI Summary Section */}
      <div className="space-y-6">
        <div className="bg-[#0A0A12] border border-[#1E1E2D] p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4F32FF]/15 border border-[#4F32FF]/30 text-[#665CFF] text-[11px] font-bold tracking-wide uppercase">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Structured Finance Curriculum</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F7F7FB] tracking-tight">
              Financial AI Learning Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[#9A9AAA] max-w-2xl leading-relaxed">
              Interactive educational modules covering financial reasoning, valuation, reporting, corporate finance and risk.
            </p>
          </div>
        </div>

        {/* 4 Professional KPI Cards */}
        <ProgressSummary progress={progressState} totalLessons={16} />
      </div>

      <SafetyBanner />

      {/* Navigation Breadcrumb Controls */}
      {(selectedTrack || selectedModule) && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button
            onClick={() => {
              setSelectedTrack(null);
              setSelectedModule(null);
              setSelectedLesson(null);
            }}
            className="flex items-center gap-1 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Learning Tracks</span>
          </button>

          {selectedTrack && (
            <>
              <span>/</span>
              <span
                onClick={() => {
                  setSelectedModule(null);
                  setSelectedLesson(null);
                }}
                className="cursor-pointer hover:text-slate-200 font-medium text-slate-300"
              >
                {selectedTrack.title}
              </span>
            </>
          )}

          {selectedModule && (
            <>
              <span>/</span>
              <span className="font-semibold text-emerald-400">{selectedModule.title}</span>
            </>
          )}
        </div>
      )}

      {/* Level 1: Tracks List */}
      {!selectedTrack && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {LEARNING_TRACKS.map((track) => {
            const total = track.modules.reduce((acc, m) => acc + m.lessons.length, 0);
            const completed = progressState.completedLessonIds.filter((id) =>
              track.modules.some((m) => m.lessons.some((l) => l.id === id))
            ).length;

            return (
              <LearningTrackCard
                key={track.id}
                track={track}
                completedLessonCount={completed}
                totalLessonCount={total}
                onSelectTrack={() => handleSelectTrack(track)}
              />
            );
          })}
        </div>
      )}

      {/* Level 2: Modules List for Selected Track */}
      {selectedTrack && !selectedModule && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-slate-100">{selectedTrack.title}</h2>
            <p className="text-xs text-slate-400 mt-1">{selectedTrack.description}</p>
          </div>

          <LearningModuleList modules={selectedTrack.modules} onSelectModule={handleSelectModule} />
        </div>
      )}

      {/* Level 3: Active Module Lesson Viewer */}
      {selectedTrack && selectedModule && selectedLesson && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar: Module Lessons */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 h-fit space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              {selectedModule.title} Lessons
            </h3>
            <div className="space-y-1">
              {selectedModule.lessons.map((lesson, idx) => {
                const isActive = lesson.id === selectedLesson.id;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-semibold'
                        : 'bg-slate-950/50 hover:bg-slate-950 border border-slate-800/60 text-slate-400'
                    }`}
                  >
                    <span className="line-clamp-1">
                      {idx + 1}. {lesson.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Area: Lesson Content + Quiz */}
          <div className="lg:col-span-3">
            <LessonViewer
              lesson={selectedLesson}
              isCompleted={progressState.completedLessonIds.includes(selectedLesson.id)}
              isBookmarked={progressState.bookmarkedLessonIds.includes(selectedLesson.id)}
              onMarkCompleted={(lessonId) => {
                markLessonCompleted(lessonId);
                handleCompleteLesson(100);
              }}
              onToggleBookmark={(lessonId) => {
                toggleBookmarkLesson(lessonId);
                setOverallProgress(getOverallProgressPercentage());
              }}
              onSaveNote={(lessonId, note) => {
                saveLessonNote(lessonId, note);
              }}
              initialNote={progressState.savedNotes[selectedLesson.id] || ''}
            />
          </div>
        </div>
      )}
    </div>
  );
};
