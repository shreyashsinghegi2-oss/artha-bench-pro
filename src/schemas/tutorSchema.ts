import { z } from 'zod';

export const TutorMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(2000),
});

export const TutorRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message maximum length is 2000 characters'),
  history: z.array(TutorMessageSchema).max(20).optional().default([]),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  language: z.enum(['english', 'hindi', 'spanish', 'french', 'hinglish']).optional().default('english'),
  mode: z.enum(['explain', 'socratic', 'quiz', 'practice']).optional().default('explain'),
});

export type TutorRequest = z.infer<typeof TutorRequestSchema>;
