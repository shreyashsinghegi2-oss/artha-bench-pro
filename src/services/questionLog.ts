/** The user's recent questions to any assistant, kept in this browser for the dashboard. */
export interface LoggedQuestion { q: string; area: string; at: string }
const KEY = 'arthamind-question-log-v1';
export const QUESTION_LOG_EVENT = 'arthamind:question-log';

const AREA: Array<[RegExp, string]> = [
  [/tutor/, 'Tutor'], [/crypto/, 'Crypto'], [/company/, 'Company research'], [/dashboard/, 'Dashboard'],
  [/personal|finance/, 'Money'], [/news/, 'News'], [/ai\/chat/, 'AI CFO'],
];

/** The user's words inside a composed prompt: a labelled question, else the last short paragraph. */
export function questionFrom(prompt: string): string {
  const labelled = prompt.match(/(?:^|\n)\s*(?:user question|question|user asked|query|ask)\s*[:=]\s*(.+)/i);
  if (labelled?.[1]) return labelled[1].trim();
  const parts = prompt.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  return last.length <= 300 && !/^[[{]/.test(last) ? last : prompt.trim().slice(0, 160);
}

export function loadQuestions(): LoggedQuestion[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function logQuestion(raw: string, path: string) {
  const q = questionFrom(raw).replace(/\s+/g, ' ').slice(0, 180);
  if (q.length < 3) return;
  const area = AREA.find(([re]) => re.test(path))?.[1] ?? 'Assistant';
  const list = loadQuestions().filter((x) => x.q.toLowerCase() !== q.toLowerCase());
  try { localStorage.setItem(KEY, JSON.stringify([{ q, area, at: new Date().toISOString() }, ...list].slice(0, 30))); } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(QUESTION_LOG_EVENT));
}

/** Reads the question out of an AI request body (JSON) and logs it. Never throws. */
export function logFromRequestBody(body: unknown, path: string) {
  try {
    if (typeof body !== 'string') return;
    const d = JSON.parse(body) as Record<string, unknown>;
    const raw = [d.question, d.message, d.query, d.prompt, d.userPrompt].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
    if (raw && !d.skipLog) logQuestion(raw, path);
  } catch { /* not JSON */ }
}
