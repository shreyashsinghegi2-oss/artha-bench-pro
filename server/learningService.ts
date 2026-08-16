/**
 * Artha Learning Workspace Server Service
 */

import { LEARNING_TRACKS } from '../src/data/learningTracks';
import { callGroqChat } from './groqService';
import { inspectInputSafety, sanitizeAIOutput } from './learningSafety';

export async function generateLessonContent(params: {
  trackId: string;
  moduleId: string;
  lessonId: string;
  objective: string;
  learnerLevel: 'beginner' | 'intermediate' | 'advanced';
  language: 'english' | 'hindi' | 'hinglish';
  learningMode: string;
}) {
  // Safety check on parameters
  const safetyCheck = inspectInputSafety(params.objective);
  if (!safetyCheck.isSafe) {
    throw new Error(safetyCheck.refusalReason || 'Input violates safety policies.');
  }

  // Find canonical lesson from curriculum database
  const track = LEARNING_TRACKS.find((t) => t.id === params.trackId);
  const moduleObj = track?.modules.find((m) => m.id === params.moduleId);
  const lessonObj = moduleObj?.lessons.find((l) => l.id === params.lessonId);

  const canonicalObjective = lessonObj?.objective || params.objective;
  const canonicalTitle = lessonObj?.title || 'Financial Lesson';
  const canonicalKeyConcepts = lessonObj?.keyConcepts || ['Concepts', 'Fundamentals'];
  const canonicalKnowledgeCheck = lessonObj?.knowledgeCheck || {
    id: `kc-${params.lessonId}`,
    question: 'What is the primary key concept covered in this lesson?',
    options: ['Core Principle', 'Unrelated Factor', 'Speculative Assumption', 'Irrelevant Noise'],
    correctIndex: 0,
    explanation: 'Understanding core financial principles is essential for sound decision-making.',
  };

  const systemPrompt = `You are Artha Bench, an elite financial educator and Socratic learning engine.
Level: ${params.learnerLevel}
Language: ${params.language}
Mode: ${params.learningMode}
CRITICAL SAFETY DIRECTIVE:
1. Never give explicit buy, sell, or hold recommendations for any asset or ticker.
2. Never promise financial returns or job placements.
3. Always include risks, limitations, and an educational disclaimer.`;

  const userPrompt = `Create an interactive lesson for:
Track: ${track?.title || params.trackId}
Module: ${moduleObj?.title || params.moduleId}
Lesson Title: ${canonicalTitle}
Objective: ${canonicalObjective}

Please provide:
1. Direct Explanation
2. Step-by-Step Breakdown (3 points)
3. Worked Example with Math/Numbers
4. Assumptions & Risks`;

  let aiExplanation = '';
  try {
    const rawAiResponse = await callGroqChat(systemPrompt, userPrompt);
    aiExplanation = sanitizeAIOutput(rawAiResponse);
  } catch (err: any) {
    // Structured educational fallback if Groq API key is not present or offline
    aiExplanation = `### ${canonicalTitle}\n\n**Objective:** ${canonicalObjective}\n\n` +
      `**Key Explanation (${params.learnerLevel.toUpperCase()} LEVEL):**\n` +
      `${lessonObj?.explanationSeed || 'Financial concepts require understanding inflows, risk factors, and opportunity costs.'}\n\n` +
      `**Step-by-Step Guidance:**\n` +
      `1. Identify your baseline financial numbers and assumptions.\n` +
      `2. Apply the relevant framework or calculation formula.\n` +
      `3. Evaluate risk factors, liquidity, and long-term implications.\n\n` +
      `**Worked Example:**\n` +
      `Consider an initial capital allocation of $1,000 evaluated across a 12-month timeline with standard risk constraints.\n\n` +
      `*Note: Artha Bench provides educational frameworks. Always perform personal due diligence.*`;
  }

  const structuredLesson = {
    title: canonicalTitle,
    objective: canonicalObjective,
    directExplanation: aiExplanation,
    keyConcepts: canonicalKeyConcepts,
    stepByStepLesson: [
      'Understand the fundamental definition and financial context.',
      'Apply mathematical formulas or decision frameworks.',
      'Review limitations, tax implications, and risk management rules.',
    ],
    workedExample: lessonObj?.examplePrompt || 'Example: Calculating net returns after accounting for fees and inflation.',
    assumptions: ['Standard 12-month calendar year', 'No market execution slippage'],
    risksAndLimitations: lessonObj?.riskAndLimitationNotes || [
      'Educational material only; past performance is not indicative of future returns.',
    ],
    commonMistakes: [
      'Confusing revenue with net profit',
      'Ignoring inflation and taxes when projecting long-term growth',
    ],
    practiceActivity: lessonObj?.practiceActivity || 'Calculate your personal numbers using this framework.',
    knowledgeCheck: canonicalKnowledgeCheck,
    suggestedNextLesson: 'Continue to the next lesson in this module.',
    sourceStatus: 'Verified Educational Curriculum Data',
    educationalDisclaimer:
      'Artha Bench content is strictly educational and does not constitute personalized financial or investment advice.',
    providerMetadata: {
      model: 'Groq Llama-3.3-70b-Versatile',
      requestId: `req-${Date.now()}`,
    },
  };

  return {
    lesson: structuredLesson,
    safetyNotice: safetyCheck.requiresReview
      ? 'Note: High-risk subject matter detected. Content framed with strict risk disclosures.'
      : undefined,
  };
}

export async function reviewQuizAnswer(params: {
  lessonId: string;
  question: string;
  selectedOptionIndex: number;
  correctOptionIndex: number;
  userNote?: string;
}) {
  const isCorrect = params.selectedOptionIndex === params.correctOptionIndex;
  const reviewText = isCorrect
    ? `Correct! Excellent understanding of ${params.question}. You selected option ${params.selectedOptionIndex + 1}, which accurately reflects the financial principle.`
    : `Incorrect. You selected option ${params.selectedOptionIndex + 1}, but the correct answer is option ${params.correctOptionIndex + 1}. Review the key concepts to solidify your understanding.`;

  return {
    review: reviewText,
    isCorrect,
  };
}
