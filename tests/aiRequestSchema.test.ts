import { describe, expect, it } from 'vitest';
import { requestSchema } from '../server/aiRoutes';

describe('central AI request schema', () => {
  it('accepts the Financial Tutor default preferences', () => {
    const parsed = requestSchema.safeParse({
      prompt: 'Explain compound interest with a simple example.',
      context: { country: 'India', currency: 'INR', language: 'english', level: 'beginner', mode: 'explain', detail: 'standard', learningStyle: 'practical', activityType: 'lesson', quizType: 'mcq', quizLength: 10, sessionLength: 10 },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.context?.detail).toBe('standard');
  });

  it('drops unknown context values and trims history instead of rejecting the question', () => {
    const history = Array.from({ length: 14 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: index === 3 ? '' : `turn ${index}` }));
    const parsed = requestSchema.safeParse({ prompt: `  ${'x'.repeat(5000)}  `, context: { detail: 'verbose', quizType: 'new-type', country: 'India' }, history });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.prompt).toHaveLength(4000);
    expect(parsed.data?.context?.detail).toBeUndefined();
    expect(parsed.data?.context?.country).toBe('India');
    expect(parsed.data?.history).toHaveLength(10);
    expect(parsed.data?.history?.every((turn) => turn.content)).toBe(true);
  });

  it('still rejects an empty question', () => {
    expect(requestSchema.safeParse({ prompt: '   ' }).success).toBe(false);
  });
});
