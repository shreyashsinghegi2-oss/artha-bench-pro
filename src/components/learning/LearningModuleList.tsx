import React from 'react';
import { CheckCircle, Circle, PlayCircle, BookOpen } from 'lucide-react';
import { Lesson, Module } from '../../types';

interface LearningModuleListProps {
  modules: Module[];
  completedLessonIds?: string[];
  activeLessonId?: string;
  onSelectLesson?: (lesson: Lesson) => void;
  onSelectModule?: (module: Module) => void;
}

export const LearningModuleList: React.FC<LearningModuleListProps> = ({
  modules,
  completedLessonIds = [],
  activeLessonId,
  onSelectLesson,
  onSelectModule,
}) => {
  return (
    <div className="space-y-6">
      {modules.map((module, mIdx) => (
        <div key={module.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Module {mIdx + 1}
              </span>
              <h4 className="font-bold text-slate-100 text-sm">{module.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{module.description}</p>
            </div>

            {onSelectModule && (
              <button
                onClick={() => onSelectModule(module)}
                className="px-3 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 text-xs font-semibold rounded-xl transition-all"
              >
                Start Module
              </button>
            )}
          </div>

          <div className="space-y-2">
            {module.lessons.map((lesson) => {
              const isCompleted = completedLessonIds.includes(lesson.id);
              const isActive = activeLessonId === lesson.id;

              return (
                <div
                  key={lesson.id}
                  onClick={() => onSelectLesson?.(lesson)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-3 border ${
                    onSelectLesson ? 'cursor-pointer' : ''
                  } ${
                    isActive
                      ? 'bg-emerald-950/60 border-emerald-600/80 text-emerald-200 shadow-md'
                      : isCompleted
                      ? 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800/80'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : isActive ? (
                      <PlayCircle className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">~{lesson.estimatedMinutes} min</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
