import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Globe2,
  SlidersHorizontal,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Lesson, LearnerLevel, LearningLanguage, LearningMode } from '../../types';
import { generateLessonAI } from '../../services/learningApi';
import { SafetyBanner } from '../SafetyBanner';
import { StructuredFinancialAnswerView } from '../ai/StructuredFinancialAnswer';

interface LessonViewerProps {
  lesson: Lesson;
  isCompleted: boolean;
  isBookmarked: boolean;
  onMarkCompleted: (lessonId: string) => void;
  onToggleBookmark: (lessonId: string) => void;
  onSaveNote: (lessonId: string, note: string) => void;
  initialNote?: string;
}

export const LessonViewer: React.FC<LessonViewerProps> = ({
  lesson,
  isCompleted,
  isBookmarked,
  onMarkCompleted,
  onToggleBookmark,
  onSaveNote,
  initialNote = '',
}) => {
  const [level, setLevel] = useState<LearnerLevel>('beginner');
  const [language, setLanguage] = useState<LearningLanguage>('english');
  const [mode, setMode] = useState<LearningMode>('explain');
  const [isLoading, setIsLoading] = useState(false);
  const [lessonContent, setLessonContent] = useState<any>(null);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);
  const [noteText, setNoteText] = useState(initialNote);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasSubmittedQuiz, setHasSubmittedQuiz] = useState(false);

  useEffect(() => {
    setNoteText(initialNote);
    setSelectedOption(null);
    setHasSubmittedQuiz(false);
    loadLessonAI();
  }, [lesson.id, level, language, mode]);

  const loadLessonAI = async () => {
    setIsLoading(true);
    try {
      const res = await generateLessonAI({
        trackId: lesson.trackId,
        moduleId: lesson.moduleId,
        lessonId: lesson.id,
        objective: lesson.objective,
        learnerLevel: level,
        language: language,
        learningMode: mode,
      });
      setLessonContent(res.lesson);
      setSafetyNotice(res.safetyNotice || null);
    } catch (err: any) {
      console.warn('Fallback lesson rendering:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteBlur = () => {
    onSaveNote(lesson.id, noteText);
  };

  const handleQuizSubmit = () => {
    if (selectedOption !== null) {
      setHasSubmittedQuiz(true);
    }
  };

  return (
    <div className="bg-surface border border-line rounded-2xl p-6 shadow-sm space-y-6">
      {/* Lesson Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <span className="text-xs font-bold text-success uppercase tracking-wider">
            Lesson Objective
          </span>
          <h2 className="text-xl font-bold text-ink mt-0.5">{lesson.title}</h2>
          <p className="text-xs text-secondary mt-1">{lesson.objective}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleBookmark(lesson.id)}
            className={`p-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-interactive ${
              isBookmarked
                ? 'bg-warning-soft/80 border-warning-fill/80 text-warning'
                : 'bg-hover border-line-strong text-secondary hover:text-ink'
            }`}
            title="Bookmark Lesson"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <button
            onClick={() => onMarkCompleted(lesson.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus:ring-2 ${
              isCompleted
                ? 'bg-success-soft/80 border-success-fill/80 text-success'
                : 'bg-brand hover:bg-brand-hover text-brand-foreground hover:text-white border-brand focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? 'Completed' : 'Mark Completed'}</span>
          </button>
        </div>
      </div>

      {/* Control Filters: Level, Language, Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface/60 p-3 rounded-xl border border-line">
        <div>
          <label className="text-[10px] uppercase font-bold text-secondary flex items-center gap-1 mb-1">
            <SlidersHorizontal className="w-3 h-3 text-success" />
            Learner Level
          </label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as LearnerLevel)}
            className="w-full bg-surface border border-line-strong rounded-lg text-xs text-ink p-1.5 focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
          >
            <option value="beginner">Beginner (Foundations)</option>
            <option value="intermediate">Intermediate (Frameworks)</option>
            <option value="advanced">Advanced (Deep Analysis)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-secondary flex items-center gap-1 mb-1">
            <Globe2 className="w-3 h-3 text-interactive" />
            Language Mode
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LearningLanguage)}
            className="w-full bg-surface border border-line-strong rounded-lg text-xs text-ink p-1.5 focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="hinglish">Hinglish</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold text-secondary flex items-center gap-1 mb-1">
            <Sparkles className="w-3 h-3 text-warning" />
            Pedagogy Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as LearningMode)}
            className="w-full bg-surface border border-line-strong rounded-lg text-xs text-ink p-1.5 focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive"
          >
            <option value="explain">Core Explanation</option>
            <option value="step-by-step">Step-by-Step Breakdown</option>
            <option value="socratic">Socratic Guidance</option>
            <option value="worked-example">Worked Example</option>
          </select>
        </div>
      </div>

      {safetyNotice && <SafetyBanner type="warning" message={safetyNotice} />}

      {/* Main Lesson Content */}
      {isLoading ? (
        <div className="py-12 text-center text-secondary space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-success mx-auto" />
          <p className="text-xs">Generating Socratic lesson content...</p>
        </div>
      ) : lessonContent ? (
        <div className="space-y-6">
          {/* Key Concepts Pills */}
          <div className="flex flex-wrap gap-2">
            {lessonContent.keyConcepts?.map((concept: string, idx: number) => (
              <span
                key={idx}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-success-soft/60 text-success border border-success-fill/60"
              >
                #{concept}
              </span>
            ))}
          </div>

          {/* Structured AI Explanation */}
          {lessonContent.structuredAnswer ? (
            <StructuredFinancialAnswerView
              answer={lessonContent.structuredAnswer}
              disclaimer={lessonContent.educationalDisclaimer}
            />
          ) : (
            <div className="bg-surface border border-line rounded-2xl p-5 text-sm text-secondary leading-relaxed whitespace-pre-line shadow-sm">
              {lessonContent.directExplanation}
            </div>
          )}

          {/* Worked Example */}
          {!lessonContent.structuredAnswer && lessonContent.workedExample && (
            <div className="bg-hover/40 border border-line-strong/60 rounded-xl p-4 text-xs">
              <h4 className="font-bold text-ink text-xs mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-success" />
                <span>Worked Example & Math Proof</span>
              </h4>
              <p className="text-secondary leading-relaxed">{lessonContent.workedExample}</p>
            </div>
          )}

          {/* Knowledge Check Quiz */}
          <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-ink text-xs flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-interactive" />
              <span>Knowledge Check</span>
            </h4>
            <p className="text-xs font-medium text-ink">
              {lessonContent.knowledgeCheck?.question || lesson.knowledgeCheck.question}
            </p>

            <div className="space-y-2">
              {(lessonContent.knowledgeCheck?.options || lesson.knowledgeCheck.options).map(
                (opt: string, optIdx: number) => {
                  const isSelected = selectedOption === optIdx;
                  const correctIdx =
                    lessonContent.knowledgeCheck?.correctIndex ?? lesson.knowledgeCheck.correctIndex;
                  const isCorrect = optIdx === correctIdx;

                  let optionStyle = 'bg-subtle border-line text-secondary';
                  if (hasSubmittedQuiz) {
                    if (isCorrect) optionStyle = 'bg-success-soft/80 border-success-fill text-success';
                    else if (isSelected) optionStyle = 'bg-danger-soft/80 border-danger text-danger';
                  } else if (isSelected) {
                    optionStyle = 'bg-hover border-line-strong text-ink';
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => !hasSubmittedQuiz && setSelectedOption(optIdx)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs border transition-all ${optionStyle}`}
                    >
                      {optIdx + 1}. {opt}
                    </button>
                  );
                }
              )}
            </div>

            {!hasSubmittedQuiz ? (
              <button
                disabled={selectedOption === null}
                onClick={handleQuizSubmit}
                className="mt-2 px-4 py-2 bg-brand disabled:opacity-50 hover:bg-brand-hover text-brand-foreground hover:text-white font-semibold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-canvas"
              >
                Submit Answer
              </button>
            ) : (
              <div className="mt-3 p-3 bg-surface border border-line rounded-lg text-xs text-secondary">
                <span className="font-bold text-success">Explanation: </span>
                {lessonContent.knowledgeCheck?.explanation || lesson.knowledgeCheck.explanation}
              </div>
            )}
          </div>

          {/* Personal Lesson Notes */}
          <div className="bg-surface/60 border border-line/80 rounded-xl p-4">
            <h4 className="font-bold text-ink text-xs flex items-center gap-1.5 mb-2">
              <FileText className="w-4 h-4 text-warning" />
              <span>Personal Lesson Notes (Saved in Browser)</span>
            </h4>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Write your study notes or formula calculations here..."
              className="w-full bg-surface border border-line rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:border-interactive focus:ring-2 focus:ring-interactive h-20 resize-none"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
