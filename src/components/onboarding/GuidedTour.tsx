import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Trophy, X } from 'lucide-react';
import type { AppNavigationDestination } from '../../navigationTypes';
import { QUESTION_LOG_EVENT, loadQuestions } from '../../services/questionLog';
import './guidedTour.css';

/**
 * Two helpers for new users:
 * 1. A short tour right after the sign-up questions. A bouncing arrow points at each part of the screen
 *    with one plain sentence. Missing targets (for example on a phone) show the card in the middle.
 * 2. A "Getting started" checklist: five small tasks with points and a badge at 100. The next task always
 *    has an arrow button that takes you there.
 * Progress is saved on this device and synced with the workspace.
 */

const KEY = 'arthamind.tour.v1';
const EVENT = 'arthamind:tour';

interface TourState { active: boolean; step: number; done: string[]; hidden?: boolean; collapsed?: boolean }

function load(): TourState {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as TourState) : null;
    return s && Array.isArray(s.done) ? s : { active: false, step: 0, done: [] };
  } catch {
    return { active: false, step: 0, done: [] };
  }
}
function save(s: TourState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Called once the sign-up questions are saved. */
export function startTour() { save({ active: true, step: 0, done: ['profile'], collapsed: false }); }
export function markQuest(id: string) {
  const s = load();
  if (s.done.includes(id)) return;
  save({ ...s, done: [...s.done, id] });
}

function useTourState(): [TourState, (s: TourState) => void] {
  const [state, setState] = useState(load);
  useEffect(() => {
    const on = () => setState(load());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return [state, (s) => { save(s); setState(s); }];
}

const STEPS: Array<{ target: string; title: string; text: string }> = [
  { target: '.mh-head, .ws-main', title: 'This is your Money Home', text: 'Your answers already filled it in: your score, what is left to save each month, and what to do first.' },
  { target: 'a[aria-label="Open your complete dashboard"]', title: 'Your full dashboard', text: 'Tap here to see all your money in one place: income, spending, loans, savings and goals.' },
  { target: '.sb-nav, nav.tb', title: 'All your tools', text: 'Income, spending, budget, EMIs, tax and planners live here. Each one already has your numbers.' },
  { target: '.pai-launch', title: 'Ask anything', text: 'Stuck? Tap here and ask in your own words, like “How much should I save each month?”' },
  { target: '.va-launch', title: 'Or just speak', text: 'Tap the mic and ask by voice in your language. Answers are short and simple.' },
];

type Rect = { top: number; left: number; width: number; height: number };

export const GuidedTour: React.FC = () => {
  const [state, setState] = useTourState();
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[state.step];

  const measure = useCallback(() => {
    if (!state.active || !step) return;
    const el = step.target.split(',').map((s) => document.querySelector<HTMLElement>(s.trim())).find((e) => e && e.offsetParent !== null && e.getBoundingClientRect().width > 0);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    // Big targets (a whole area) get a smaller highlight at their top.
    const h = Math.min(r.height, 180);
    setRect({ top: r.top, left: r.left, width: Math.min(r.width, window.innerWidth - 16), height: h });
  }, [state.active, step]);

  useLayoutEffect(() => {
    measure();
    const id = window.setInterval(measure, 400);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.clearInterval(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [measure]);

  if (!state.active || !step) return null;
  const close = () => setState({ ...state, active: false });
  const next = () => (state.step + 1 >= STEPS.length ? setState({ ...state, active: false, done: [...new Set([...state.done, 'tour'])] }) : setState({ ...state, step: state.step + 1 }));
  const prev = () => setState({ ...state, step: Math.max(0, state.step - 1) });

  // Card below the target if there is room, otherwise above; centred when there is no target.
  const vh = window.innerHeight, vw = window.innerWidth;
  const below = rect ? rect.top + rect.height + 190 < vh : true;
  const cardW = Math.min(340, vw - 24);
  const cardLeft = rect ? Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 12) : (vw - cardW) / 2;
  const cardTop = rect ? (below ? rect.top + rect.height + 52 : Math.max(12, rect.top - 52 - 170)) : vh / 2 - 90;
  const arrowLeft = rect ? Math.min(Math.max(16, rect.left + rect.width / 2 - 14), vw - 44) : 0;
  const arrowTop = rect ? (below ? rect.top + rect.height + 10 : rect.top - 44) : 0;

  return (
    <div className="gt-layer" role="dialog" aria-modal="true" aria-labelledby="gt-title">
      {rect ? <div className="gt-spot" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} /> : <div className="gt-dim" />}
      {rect && <span className={`gt-arrow ${below ? 'is-down' : 'is-up'}`} style={{ top: arrowTop, left: arrowLeft }} aria-hidden="true">{below ? <ArrowUp size={28} /> : <ArrowDown size={28} />}</span>}
      <div className="gt-card" style={{ top: cardTop, left: cardLeft, width: cardW }}>
        <div className="gt-head"><small>Step {state.step + 1} of {STEPS.length} · +10 points</small><button type="button" onClick={close} aria-label="Close the tour"><X size={16} /></button></div>
        <h2 id="gt-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="gt-dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i <= state.step ? 'on' : ''} />)}</div>
        <div className="gt-actions">
          <button type="button" className="gt-ghost" onClick={state.step ? prev : close}>{state.step ? <><ArrowLeft size={14} /> Back</> : 'Skip tour'}</button>
          <button type="button" className="gt-next" onClick={next}>{state.step + 1 >= STEPS.length ? <>Done <Check size={14} /></> : <>Next <ArrowRight size={14} /></>}</button>
        </div>
      </div>
    </div>
  );
};

// ---------------- Getting started checklist ----------------

const QUESTS: Array<{ id: string; label: string; points: number; go?: AppNavigationDestination; hint: string }> = [
  { id: 'profile', label: 'Answer the setup questions', points: 20, hint: 'Done when you finished the questions.' },
  { id: 'tour', label: 'Take the quick tour', points: 10, hint: 'A 1-minute look around.' },
  { id: 'dashboard', label: 'Open your dashboard', points: 20, go: 'my-dashboard', hint: 'See all your money on one page.' },
  { id: 'expense', label: 'Add one real expense', points: 25, go: 'expenses', hint: 'Write down something you paid for today.' },
  { id: 'ask', label: 'Ask ArthaMind one question', points: 25, hint: 'Tap “Ask” at the bottom and type any money question.' },
];
const TOTAL = QUESTS.reduce((s, q) => s + q.points, 0);

/** Marks tasks done from what the user does in the workspace. */
export function useQuestTracking(destination: AppNavigationDestination) {
  useEffect(() => {
    if (destination === 'my-dashboard') markQuest('dashboard');
  }, [destination]);
  useEffect(() => {
    const check = () => { if (loadQuestions().length) markQuest('ask'); };
    check();
    window.addEventListener(QUESTION_LOG_EVENT, check);
    // A saved expense of the user's own (not one filled in from the profile).
    const onStorage = () => {
      try {
        const list = JSON.parse(localStorage.getItem('artha_expenses_v1') || '[]') as Array<{ id: string }>;
        if (list.some((e) => !String(e.id).startsWith('profile-spend-'))) markQuest('expense');
      } catch { /* ignore */ }
    };
    onStorage();
    const id = window.setInterval(onStorage, 3000);
    return () => { window.removeEventListener(QUESTION_LOG_EVENT, check); window.clearInterval(id); };
  }, []);
}

export const GettingStarted: React.FC<{ onNavigate: (d: AppNavigationDestination) => void }> = ({ onNavigate }) => {
  const [state, setState] = useTourState();
  if (state.hidden || state.active || !state.done.includes('profile')) return null;
  const points = QUESTS.filter((q) => state.done.includes(q.id)).reduce((s, q) => s + q.points, 0);
  const nextQuest = QUESTS.find((q) => !state.done.includes(q.id));
  const doneCount = QUESTS.filter((q) => state.done.includes(q.id)).length;
  const finished = !nextQuest;
  const runQuest = (q: typeof QUESTS[number]) => {
    if (q.id === 'tour') return setState({ ...state, active: true, step: 0 });
    if (q.go) onNavigate(q.go);
    if (q.id === 'ask') document.querySelector<HTMLElement>('.pai-launch')?.click();
  };
  return (
    <aside className={`gs-card ${state.collapsed ? 'is-collapsed' : ''}`} aria-label="Getting started">
      <button type="button" className="gs-head" onClick={() => setState({ ...state, collapsed: !state.collapsed })} aria-expanded={!state.collapsed}>
        <Trophy size={16} aria-hidden="true" />
        <span><b>{finished ? 'Money Starter badge earned!' : 'Getting started'}</b><small>{doneCount}/{QUESTS.length} done · {points}/{TOTAL} points</small></span>
        {state.collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <div className="gs-bar"><span style={{ width: `${(points / TOTAL) * 100}%` }} /></div>
      {!state.collapsed && (
        <>
          <ol className="gs-list">
            {QUESTS.map((q) => {
              const done = state.done.includes(q.id);
              const isNext = q === nextQuest;
              return (
                <li key={q.id} className={done ? 'is-done' : isNext ? 'is-next' : ''}>
                  <span className="gs-tick" aria-hidden="true">{done ? <Check size={12} /> : null}</span>
                  <span className="gs-label"><b>{q.label}</b>{isNext && <small>{q.hint}</small>}</span>
                  <span className="gs-pts">+{q.points}</span>
                  {isNext && <button type="button" className="gs-go" onClick={() => runQuest(q)} aria-label={`Do this: ${q.label}`}><ArrowRight size={14} /></button>}
                </li>
              );
            })}
          </ol>
          <div className="gs-foot">
            {finished ? <span>All done. You know your way around ArthaMind.</span> : <span>Next step has the arrow →</span>}
            <button type="button" onClick={() => setState({ ...state, hidden: true })}>Hide</button>
          </div>
        </>
      )}
    </aside>
  );
};
