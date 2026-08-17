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
        <div key={module.id} className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-line pb-3">
            <div>
              <span className="text-[10px] font-bold text-success uppercase tracking-wider">
                Module {mIdx + 1}
              </span>
              <h4 className="font-bold text-ink text-sm">{module.title}</h4>
              <p className="text-xs text-secondary mt-0.5">{module.description}</p>
            </div>

            {onSelectModule && (
              <button
                onClick={() => onSelectModule(module)}
                className="px-3 py-1.5 bg-success-soft text-success border border-success-fill hover:bg-success-soft text-xs font-semibold rounded-xl transition-all"
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
                      ? 'bg-success-soft/60 border-success-fill/80 text-success shadow-sm'
                      : isCompleted
                      ? 'bg-hover/40 border-line-strong/60 text-secondary hover:bg-hover/80'
                      : 'bg-surface/60 border-line/80 text-secondary hover:text-ink hover:bg-subtle'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    ) : isActive ? (
                      <PlayCircle className="w-4 h-4 text-success shrink-0 animate-pulse" />
                    ) : (
                      <Circle className="w-4 h-4 text-secondary shrink-0" />
                    )}
                    <span className="truncate">{lesson.title}</span>
                  </div>
                  <span className="text-[10px] text-secondary shrink-0">~{lesson.estimatedMinutes} min</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
