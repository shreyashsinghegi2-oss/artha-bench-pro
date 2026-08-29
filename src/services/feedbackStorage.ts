export const FEEDBACK_STORAGE_KEY = 'arthabench_feedback_v1';

export type FeedbackKind = 'page' | 'ai';
export type FeedbackRating = 'helpful' | 'not-helpful' | 'incorrect-outdated';
export type FeedbackCategory = 'source' | 'calculation' | 'explanation' | 'ui' | 'other';

export interface ProductFeedbackRecord {
  id: string;
  createdAt: string;
  userId: string | null;
  kind: FeedbackKind;
  module: string;
  rating: FeedbackRating;
  category: FeedbackCategory | null;
  comment: string;
}

export function loadFeedback(): ProductFeedbackRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveFeedback(input: Omit<ProductFeedbackRecord, 'id' | 'createdAt'>): ProductFeedbackRecord {
  const record: ProductFeedbackRecord = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  if (typeof window !== 'undefined') localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify([record, ...loadFeedback()].slice(0, 250)));
  return record;
}
