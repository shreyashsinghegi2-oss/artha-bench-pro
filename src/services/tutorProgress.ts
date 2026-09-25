/** Learning progress kept in this browser: lessons taken, questions asked, quiz answers and active days. */
export interface TutorProgress { lessons: string[]; questions: number; quizTotal: number; quizCorrect: number; days: Record<string, number> }
const KEY = 'arthamind-tutor-progress-v1';
export const TUTOR_PROGRESS_EVENT = 'arthamind:tutor-progress';
const today = () => new Date().toISOString().slice(0, 10);

export function loadTutorProgress(): TutorProgress {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<TutorProgress> | null;
    return { lessons: v?.lessons ?? [], questions: v?.questions ?? 0, quizTotal: v?.quizTotal ?? 0, quizCorrect: v?.quizCorrect ?? 0, days: v?.days ?? {} };
  } catch { return { lessons: [], questions: 0, quizTotal: 0, quizCorrect: 0, days: {} }; }
}
function update(fn: (p: TutorProgress) => void) {
  const p = loadTutorProgress();
  fn(p);
  p.days[today()] = (p.days[today()] ?? 0) + 1;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(TUTOR_PROGRESS_EVENT));
}
export const recordTutorQuestion = () => update((p) => { p.questions += 1; });
export const recordLesson = (id: string) => update((p) => { if (!p.lessons.includes(id)) p.lessons.push(id); });
export const recordQuizAnswer = (correct: boolean) => update((p) => { p.quizTotal += 1; if (correct) p.quizCorrect += 1; });

/** Consecutive active days ending today (or yesterday, so the streak survives until the day ends). */
export function streak(p: TutorProgress): number {
  let n = 0;
  const d = new Date();
  if (!p.days[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 1);
  while (p.days[d.toISOString().slice(0, 10)]) { n += 1; d.setDate(d.getDate() - 1); }
  return n;
}
/** Activity for the last seven days, oldest first. */
export function lastSevenDays(p: TutorProgress): Array<{ label: string; count: number }> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { label: d.toLocaleDateString('en-IN', { weekday: 'short' }), count: p.days[d.toISOString().slice(0, 10)] ?? 0 };
  });
}
