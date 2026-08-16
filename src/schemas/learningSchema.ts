import { z } from 'zod';

export const LessonRequestSchema = z.object({
  trackId: z.string().min(1).max(100),
  moduleId: z.string().min(1).max(100),
  lessonId: z.string().min(1).max(100),
  objective: z.string().min(1).max(500),
  learnerLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  language: z.enum(['english', 'hindi', 'hinglish']).default('english'),
  learningMode: z
    .enum([
      'explain',
      'step-by-step',
      'socratic',
      'worked-example',
      'quiz',
      'revision',
      'flashcards',
      'compare',
    ])
    .default('explain'),
  country: z.string().max(50).default('Global'),
  currency: z.string().max(10).default('USD'),
  selectedAnswer: z.string().max(200).optional(),
});

export const StructuredLessonOutputSchema = z.object({
  title: z.string(),
  objective: z.string(),
  directExplanation: z.string(),
  keyConcepts: z.array(z.string()),
  stepByStepLesson: z.array(z.string()),
  workedExample: z.string(),
  formula: z.string().optional(),
  assumptions: z.array(z.string()),
  risksAndLimitations: z.array(z.string()),
  commonMistakes: z.array(z.string()),
  practiceExercise: z.string(),
  knowledgeCheck: z.object({
    question: z.string(),
    options: z.array(z.string()),
    correctIndex: z.number(),
    explanation: z.string(),
  }),
  suggestedNextLesson: z.string().optional(),
  sourceStatus: z.string(),
  educationalDisclaimer: z.string(),
  providerMetadata: z.object({
    model: z.string(),
    requestId: z.string(),
  }),
});

export const QuizReviewRequestSchema = z.object({
  lessonId: z.string().min(1).max(100),
  question: z.string().min(1).max(500),
  selectedOptionIndex: z.number().int().min(0).max(10),
  correctOptionIndex: z.number().int().min(0).max(10),
  userNote: z.string().max(500).optional(),
});
