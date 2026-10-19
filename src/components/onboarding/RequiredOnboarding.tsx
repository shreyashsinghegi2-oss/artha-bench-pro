import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Loader2, Pencil, Sparkles, TriangleAlert, X } from 'lucide-react';
import { ArthaMindLogoMark } from '../branding/ArthaMindBrand';
import { setSiteLanguage, siteCode } from '../LanguageSelector';
import { VOICE_LANGUAGES } from '../../services/voice';
import { useAuth } from '../../auth/AuthContext';
import { getOnboarding, saveOnboardingRow } from '../../services/supabaseRest';
import { loadMoneyProfile, saveMoneyProfile } from '../../services/moneyProfile';
import { COUNTRIES, formatMoney, loadPrefs, moneyInWords, savePrefs, type Level } from '../../services/userPrefs';
import {
  GOAL_OPTIONS, ONBOARDING_VERSION, SCENARIOS, WORK_OPTIONS, checkAnswers, incomeBand, isEarning, loadOnboardingRecord,
  buildPath, scoreMindset, storeOnboardingRecord, toMoneyProfile, totalSpend, type Issue, type OnboardingAnswers, type OnboardingRecord,
} from '../../services/onboarding';
import { loadTourStarted, startTour } from './GuidedTour';
import './requiredOnboarding.css';

// ---------------- Editing saved answers ----------------

export { EDIT_ANSWERS_EVENT, openAnswersEditor } from '../../services/answersEditor';

/** The money profile always follows the saved answers, so no page ever asks for the same numbers again. */
function ensureProfileFrom(answers: OnboardingAnswers) {
  const p = loadMoneyProfile();
  if (!p || p.source === 'sample') { try { saveMoneyProfile(toMoneyProfile(answers)); } catch { /* storage blocked */ } }
}

// ---------------- Gate status ----------------

type Status = 'none' | 'checking' | 'needed' | 'done';
const remoteChecks = new Map<string, Promise<boolean>>();

/** Has this signed-in user answered the required questions? Local record first, then the database. */
export function useRequiredOnboarding(): { status: Status; complete: (a: OnboardingAnswers) => Promise<void> } {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const token = auth.session?.access_token ?? null;
  const localDone = () => { const r = loadOnboardingRecord(); return !!r && r.userId === userId; };
  const [status, setStatus] = useState<Status>(() => (!userId ? 'none' : localDone() ? 'done' : 'checking'));

  useEffect(() => {
    if (!userId || !token) { setStatus('none'); return; }
    const local = loadOnboardingRecord();
    if (local && local.userId === userId) {
      ensureProfileFrom(local.answers);
      setStatus('done');
      // A save that failed earlier (offline) is sent again quietly.
      if (!(local as OnboardingRecord & { synced?: boolean }).synced) void pushRecord(token, local).then((ok) => { if (ok) storeOnboardingRecord({ ...local, synced: true } as OnboardingRecord); });
      return;
    }
    setStatus('checking');
    let cancelled = false;
    let check = remoteChecks.get(userId);
    if (!check) {
      check = getOnboarding(token).then((row) => {
        if (!row || row.version < ONBOARDING_VERSION) return false;
        const answers = row.answers as OnboardingAnswers;
        storeOnboardingRecord({ userId, version: row.version, answers, result: row.result as OnboardingRecord['result'], completedAt: row.completed_at, synced: true } as OnboardingRecord);
        savePrefs({ level: answers.level ?? 'beginner', country: answers.country ?? 'India', currency: answers.currency ?? 'INR', language: answers.language ?? 'en-IN' });
        ensureProfileFrom(answers);
        return true;
      }).catch(() => false);
      remoteChecks.set(userId, check);
    }
    void check.then((done) => { if (!cancelled) setStatus(done ? 'done' : 'needed'); });
    return () => { cancelled = true; };
  }, [userId, token]);

  const complete = useCallback(async (answers: OnboardingAnswers) => {
    if (!userId) return;
    const record: OnboardingRecord = { userId, version: ONBOARDING_VERSION, answers, result: scoreMindset(answers), completedAt: new Date().toISOString() };
    storeOnboardingRecord(record);
    remoteChecks.set(userId, Promise.resolve(true));
    savePrefs({ level: answers.level ?? 'beginner', country: answers.country ?? 'India', currency: answers.currency ?? 'INR', language: answers.language ?? 'en-IN' });
    // Edited answers replace the profile, keeping investments/cash the portfolio added since.
    try { const prev = loadMoneyProfile(); const next = toMoneyProfile(answers); saveMoneyProfile(prev && prev.source !== 'sample' ? { ...prev, ...next } : next); } catch { /* storage blocked */ }
    if (token) {
      const ok = await pushRecord(token, record);
      if (ok) storeOnboardingRecord({ ...record, synced: true } as OnboardingRecord);
    }
    try {
      await auth.saveProfile({
        full_name: answers.name?.trim() || auth.profile?.full_name || '',
        country: answers.country ?? 'India',
        currency: answers.currency ?? 'INR',
        market_focus: answers.country === 'India' ? 'India' : answers.country === 'United States' ? 'US' : 'Global',
        learning_level: answers.level ?? 'beginner',
        monthly_income_range: incomeBand(answers.monthlyIncome ?? 0, answers.currency ?? 'INR'),
        financial_goal: GOAL_OPTIONS.find((g) => g.value === answers.goal)?.label ?? null,
        primary_goal: answers.goal ?? 'all',
        onboarding_completed: true,
      });
    } catch { /* the answers are already saved; the account profile catches up next time */ }
    if (!loadTourStarted()) startTour();
    setStatus('done');
  }, [userId, token, auth]);

  return { status, complete };
}

async function pushRecord(token: string, r: OnboardingRecord): Promise<boolean> {
  try {
    await saveOnboardingRow(token, { user_id: r.userId, version: r.version, answers: r.answers, result: r.result, completed_at: r.completedAt });
    return true;
  } catch {
    return false;
  }
}

// ---------------- Questions ----------------

type Kind = 'language' | 'intro' | 'text' | 'level' | 'country' | 'choice' | 'multi' | 'number' | 'money' | 'scenarioIntro' | 'scenario' | 'review';
type Chip = { label: string; value: number | string };
interface Step {
  id: string;
  field?: keyof OnboardingAnswers;
  kind: Kind;
  section: string;
  title: (a: OnboardingAnswers) => string;
  why: string;
  optional?: boolean;
  show?: (a: OnboardingAnswers) => boolean;
  chips?: (a: OnboardingAnswers) => Chip[];
  suffix?: string;
  placeholder?: string;
  /** Most choices allowed in a multi-choice question. */
  max?: number;
}

const isIndian = (a: OnboardingAnswers) => ['INR', 'NPR'].includes(a.currency ?? 'INR');
/** Chips for money questions in the user's currency (Indian amounts, or a US-dollar scale for others). */
const SCALE: Record<string, number> = { USD: 1, CAD: 1.4, AUD: 1.5, SGD: 1.3, GBP: 0.8, EUR: 0.9, AED: 3.7, SAR: 3.75 };
function moneyChips(a: OnboardingAnswers, inr: number[], usd: number[], zero?: string): Chip[] {
  const cur = a.currency ?? 'INR';
  const list = isIndian(a) ? inr : usd.map((v) => Math.round((v * (SCALE[cur] ?? 1)) / 100) * 100);
  return list.map((v) => ({ label: v === 0 && zero ? zero : `${formatMoney(v, cur)}${v >= 1e5 && isIndian(a) ? ` (${moneyInWords(v, cur)})` : ''}`, value: v }));
}
const yearsChips = (list: number[]): Chip[] => list.map((v) => ({ label: v === 0.5 ? 'Less than 1 year' : `${v} ${v === 1 ? 'year' : 'years'}`, value: v }));

const workVerb = (a: OnboardingAnswers) => (a.work === 'business' ? 'running this business' : a.work === 'freelancer' || a.work === 'self-employed' ? 'doing this work' : 'in your current job');

const yesNo = (yes = 'Yes', no = 'No'): Chip[] => [{ label: yes, value: 'yes' }, { label: no, value: 'no' }];
const india = (a: OnboardingAnswers) => (a.currency ?? 'INR') === 'INR';
const isBusiness = (a: OnboardingAnswers) => a.work === 'business' || a.work === 'self-employed' || a.work === 'freelancer';

export const STEPS: Step[] = [
  { id: 'language', field: 'language', kind: 'language', section: 'Start', title: () => 'Choose your language · अपनी भाषा चुनें', why: 'Every question, every page and every answer from ArthaMind will be in this language. You can change it later.' },
  { id: 'intro', kind: 'intro', section: 'Start', title: () => 'Let’s set up your money plan', why: '' },
  // About you
  { id: 'name', field: 'name', kind: 'text', section: 'About you', title: () => 'What should we call you?', why: 'So we can talk to you by name. Your first name is enough.', placeholder: 'Your first name' },
  { id: 'level', field: 'level', kind: 'level', section: 'About you', title: (a) => `${a.name ? `Hi ${a.name.trim().split(' ')[0]}! ` : ''}How much do you know about money?`, why: 'We use simple words for beginners and more detail for experts. You can change this later in Account.' },
  { id: 'country', field: 'country', kind: 'country', section: 'About you', title: () => 'Which country do you live in?', why: 'So we show your own currency and the right rules (tax rules differ by country).' },
  { id: 'age', field: 'age', kind: 'number', section: 'About you', title: () => 'How old are you?', why: 'Your age tells us how many years your money has to grow, and how much risk is sensible.', suffix: 'years', placeholder: 'Type your age',
    chips: () => [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 28, 30, 35, 40, 45, 50, 55, 60, 65, 70].map((v) => ({ label: String(v), value: v })) },
  { id: 'dependants', field: 'dependants', kind: 'choice', section: 'About you', title: () => 'How many people depend on your money?', why: 'Children, parents or a partner you support. More people means you need more insurance and a bigger safety fund.',
    chips: () => [0, 1, 2, 3, 4, 5].map((v) => ({ label: v === 0 ? 'Only me' : v === 5 ? '5 or more' : String(v), value: v })) },
  // Income
  { id: 'work', field: 'work', kind: 'choice', section: 'Income', title: () => 'What do you do?', why: 'A job, a business and studies all need different money plans. For example, business income changes more, so you need a bigger safety fund.',
    chips: () => WORK_OPTIONS.map((w) => ({ label: w.label, value: w.value })) },
  { id: 'jobTitle', field: 'jobTitle', kind: 'text', section: 'Income', show: (a) => isEarning(a.work), title: (a) => (a.work === 'business' ? 'What business do you run?' : 'What is your job?'), why: 'Your kind of work changes the plan: how steady the income is, what insurance you need, and which tax rules apply.', placeholder: 'e.g. Teacher, Software engineer, Shop owner',
    chips: (a) => (a.work === 'business' || a.work === 'self-employed' ? ['Shop / retail', 'Trading', 'Manufacturing', 'Restaurant / food', 'Doctor / clinic', 'CA / lawyer', 'Consultant', 'Agriculture'] : a.work === 'freelancer' ? ['Designer', 'Developer', 'Writer', 'Driver / delivery', 'Tutor', 'Content creator'] : ['Software / IT', 'Teacher', 'Bank / finance', 'Sales', 'Doctor / nurse', 'Engineer', 'Government officer', 'Office staff', 'Factory / skilled work']).map((v) => ({ label: v, value: v })) },
  { id: 'jobYears', field: 'jobYears', kind: 'number', section: 'Income', show: (a) => isEarning(a.work), title: (a) => `How long have you been ${workVerb(a)}?`, why: 'A longer, steady job usually means steadier income. It helps us decide how big your safety fund should be.', suffix: 'years', placeholder: 'Type years (e.g. 2.5)',
    chips: () => yearsChips([0.5, 1, 2, 3, 5, 8, 10, 15, 20]) },
  { id: 'totalYears', field: 'totalYears', kind: 'number', section: 'Income', show: (a) => isEarning(a.work), title: () => 'In total, how many years have you been earning?', why: 'All your jobs together. This helps us check that your savings match your years of work.', suffix: 'years', placeholder: 'Type years',
    chips: () => yearsChips([0.5, 1, 2, 3, 5, 8, 10, 15, 20, 25, 30]) },
  { id: 'monthlyIncome', field: 'monthlyIncome', kind: 'money', section: 'Income',
    title: (a) => (a.work === 'student' ? 'How much money do you get each month?' : a.work === 'retired' ? 'How much pension or income do you get each month?' : a.work === 'homemaker' || a.work === 'looking' ? 'Does any money come to you each month?' : 'How much money comes in each month, before tax? (all sources together)'),
    why: 'Income is the starting point of every plan: how much you can save, how much tax you pay, and how much loan is safe. Salary, business, rent, interest, pocket money and pension all count.',
    chips: (a) => moneyChips(a, [0, 10_000, 20_000, 30_000, 50_000, 75_000, 1e5, 1.5e5, 2.5e5, 5e5], [0, 1000, 2000, 3000, 5000, 8000, 12000, 20000], 'No income') },
  { id: 'incomeSources', field: 'incomeSources', kind: 'multi', section: 'Income', optional: true, show: (a) => (a.monthlyIncome ?? 0) > 0, title: () => 'Where does this money come from?', why: 'Pick all that apply. Money from many places is safer than money from one place.',
    chips: () => ['Salary', 'Business profit', 'Freelance / side work', 'Rent', 'Interest or dividends', 'Pension', 'Family support'].map((v) => ({ label: v, value: v })) },
  { id: 'steadiness', field: 'steadiness', kind: 'choice', section: 'Income', show: (a) => (a.monthlyIncome ?? 0) > 0, title: () => 'Is it about the same every month?', why: 'If your income goes up and down, you need more money kept aside for slow months.',
    chips: () => [{ label: 'Yes, the same every month', value: 'fixed' }, { label: 'It changes a little', value: 'varies' }, { label: 'It changes a lot', value: 'irregular' }] },
  { id: 'worstMonthIncome', field: 'worstMonthIncome', kind: 'money', section: 'Income', optional: true, show: (a) => !!a.steadiness && a.steadiness !== 'fixed', title: () => 'In the last 2 years, how much came in during your worst month?', why: 'We plan for bad months, not just good ones.',
    chips: (a) => moneyChips(a, [0, 10_000, 25_000, 50_000, 1e5], [0, 500, 1500, 3000, 6000], 'Nothing') },
  { id: 'yearlyRevenue', field: 'yearlyRevenue', kind: 'money', section: 'Income', optional: true, show: isBusiness, title: () => 'About how much does your business sell in a year?', why: 'Sales (revenue) and profit tell us how strong the business is.',
    chips: (a) => moneyChips(a, [5e5, 20e5, 50e5, 1e7, 5e7], [20000, 100000, 500000, 1000000]) },
  { id: 'profitMargin', field: 'profitMargin', kind: 'number', section: 'Income', optional: true, show: isBusiness, title: () => 'Out of every 100 you sell, how much is profit?', why: 'This is your profit margin. 10 means 10% profit.', suffix: '%', placeholder: 'e.g. 15',
    chips: () => [5, 10, 15, 20, 30, 50].map((v) => ({ label: `${v}%`, value: v })) },
  { id: 'separateAccounts', field: 'separateAccounts', kind: 'choice', section: 'Income', optional: true, show: isBusiness, title: () => 'Do you keep business money and home money in separate bank accounts?', why: 'Mixing them makes it hard to see what the business really earns, and makes tax harder.', chips: () => yesNo() },
  // Spending
  { id: 'fixedExpenses', field: 'fixedExpenses', kind: 'money', section: 'Spending', title: () => 'Fixed costs each month: rent, bills, school fees, subscriptions', why: 'These are costs that come every month whether you like it or not. Leave out loan EMIs (we ask later).',
    chips: (a) => moneyChips(a, [0, 5_000, 10_000, 15_000, 25_000, 40_000, 60_000, 1e5], [0, 300, 800, 1200, 2000, 3000, 5000]) },
  { id: 'variableExpenses', field: 'variableExpenses', kind: 'money', section: 'Spending', title: () => 'Day-to-day spending each month: food, travel, shopping, fun', why: 'This part changes month to month and is the easiest to cut when needed.',
    chips: (a) => moneyChips(a, [2_000, 5_000, 10_000, 15_000, 25_000, 40_000, 60_000], [200, 500, 800, 1200, 2000, 3500]) },
  { id: 'budget', field: 'budget', kind: 'choice', section: 'Spending', optional: true, title: () => 'Do you follow a budget?', why: 'A budget is a plan for your money before you spend it. People who follow one save much more.',
    chips: () => [{ label: 'Yes, closely', value: 'strict' }, { label: 'Roughly, in my head', value: 'rough' }, { label: 'No', value: 'none' }] },
  { id: 'overspend', field: 'overspend', kind: 'choice', section: 'Spending', optional: true, title: () => 'Where does extra money usually go?', why: 'Knowing your weak spot helps us suggest where to save first.',
    chips: () => ['Eating out & food delivery', 'Shopping', 'Travel & trips', 'Subscriptions & apps', 'Family & gifts', 'Nothing in particular'].map((v) => ({ label: v, value: v })) },
  // Own & owe
  { id: 'liquidSavings', field: 'liquidSavings', kind: 'money', section: 'Own & owe', title: () => 'How much money is in your bank accounts and FDs?', why: 'This is your safety fund for surprises like a job loss or a hospital bill. We check how many months it would last.',
    chips: (a) => moneyChips(a, [0, 10_000, 50_000, 1e5, 3e5, 5e5, 10e5], [0, 1000, 5000, 10000, 25000, 50000], 'Almost nothing') },
  { id: 'investments', field: 'investments', kind: 'money', section: 'Own & owe', title: () => 'How much have you invested for the long term?', why: 'Mutual funds, shares, PF, PPF, NPS, bonds, crypto. Use today’s value. This shows how far you are toward your goals.',
    chips: (a) => moneyChips(a, [0, 25_000, 1e5, 3e5, 5e5, 10e5, 25e5, 50e5], [0, 2000, 10000, 25000, 50000, 100000, 250000], 'Nothing yet') },
  { id: 'gold', field: 'gold', kind: 'money', section: 'Own & owe', optional: true, title: () => 'About how much gold do you own (today’s value)?', why: 'Gold is part of your wealth. Jewellery you will never sell can be left out.',
    chips: (a) => moneyChips(a, [0, 50_000, 1e5, 3e5, 5e5, 10e5], [0, 2000, 5000, 10000, 25000], 'None') },
  { id: 'propertyValue', field: 'propertyValue', kind: 'money', section: 'Own & owe', optional: true, title: () => 'Do you own a home, land or other property? Roughly what is it worth?', why: 'Property is a big part of what you own. We count it in your net worth (what you own minus what you owe).',
    chips: (a) => moneyChips(a, [0, 20e5, 50e5, 1e7, 2e7], [0, 100000, 250000, 500000], 'No property') },
  { id: 'businessValue', field: 'businessValue', kind: 'money', section: 'Own & owe', optional: true, show: isBusiness, title: () => 'Roughly what is your share of the business worth?', why: 'Your stake in a business is part of your wealth. A rough guess is fine.',
    chips: (a) => moneyChips(a, [0, 5e5, 20e5, 50e5, 1e7], [0, 20000, 100000, 500000], 'Not sure') },
  { id: 'monthlyEmi', field: 'monthlyEmi', kind: 'money', section: 'Own & owe', title: () => 'How much do you pay in loan EMIs each month?', why: 'An EMI is the fixed amount you pay back to a bank every month (home, car, phone, education, personal loan). Too much EMI makes saving hard.',
    chips: (a) => moneyChips(a, [0, 5_000, 10_000, 20_000, 35_000, 50_000, 75_000], [0, 200, 500, 1000, 2000, 3000], 'No EMIs') },
  { id: 'loanTypes', field: 'loanTypes', kind: 'multi', section: 'Own & owe', optional: true, show: (a) => (a.monthlyEmi ?? 0) > 0, title: () => 'Which loans do you have?', why: 'Some loans cost much more than others. We tell you which to pay off first.',
    chips: () => ['Home loan', 'Car / bike loan', 'Education loan', 'Personal loan', 'Gold loan', 'Phone / gadget EMI', 'App or online loan', 'Business loan'].map((v) => ({ label: v, value: v })) },
  { id: 'loanOutstanding', field: 'loanOutstanding', kind: 'money', section: 'Own & owe', optional: true, show: (a) => (a.monthlyEmi ?? 0) > 0, title: () => 'About how much loan is still left to pay, in total?', why: 'This shows when you will be loan-free. Skip it if you are not sure.',
    chips: (a) => moneyChips(a, [50_000, 2e5, 5e5, 10e5, 25e5, 50e5], [2000, 10000, 25000, 100000, 250000]) },
  { id: 'highestRate', field: 'highestRate', kind: 'number', section: 'Own & owe', optional: true, show: (a) => (a.monthlyEmi ?? 0) > 0, title: () => 'What is the highest interest rate on your loans?', why: 'The loan with the highest rate costs you the most. It is usually the one to close first.', suffix: '% a year', placeholder: 'e.g. 12',
    chips: () => [8, 9, 10, 12, 14, 16, 18, 24].map((v) => ({ label: `${v}%`, value: v })) },
  { id: 'creditCardDue', field: 'creditCardDue', kind: 'money', section: 'Own & owe', title: () => 'Do you have an unpaid credit card bill right now?', why: 'Only count what you could not pay in full last month. Card interest is about 36–42% a year, so this matters a lot.',
    chips: (a) => moneyChips(a, [0, 10_000, 25_000, 50_000, 1e5, 2e5], [0, 500, 1000, 3000, 6000], 'No, I pay in full') },
  // Safety
  { id: 'healthCover', field: 'healthCover', kind: 'money', section: 'Safety', optional: true, title: () => 'How much health insurance do you have?', why: 'One hospital stay can wipe out years of savings. Count your own plan and any from your job. Skip if you don’t know.',
    chips: (a) => moneyChips(a, [0, 3e5, 5e5, 10e5, 25e5], [0, 10000, 50000, 100000, 500000], 'None') },
  { id: 'termCover', field: 'termCover', kind: 'money', section: 'Safety', optional: true, title: () => 'How much life insurance (term plan) do you have?', why: 'If something happens to you, a term plan pays your family. Skip if you don’t know.',
    chips: (a) => moneyChips(a, [0, 25e5, 50e5, 1e7, 2e7], [0, 100000, 250000, 500000, 1000000], 'None') },
  { id: 'criticalCover', field: 'criticalCover', kind: 'choice', section: 'Safety', optional: true, title: () => 'Do you have cover for serious illness or disability?', why: 'It pays a lump sum if a serious illness or accident stops you from working.',
    chips: () => [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'Not sure', value: 'unsure' }] },
  // Goals
  { id: 'goals', field: 'goals', kind: 'multi', section: 'Goals', max: 3, title: () => 'What are your top money goals? (pick up to 3, most important first)', why: 'We build your plan around these, in this order.',
    chips: () => GOAL_OPTIONS.map((g) => ({ label: g.label, value: g.value })) },
  { id: 'goalAmount', field: 'goalAmount', kind: 'money', section: 'Goals', optional: true, show: (a) => !!a.goal && a.goal !== 'emergency' && a.goal !== 'debt-free', title: (a) => `About how much will “${GOAL_OPTIONS.find((g) => g.value === a.goal)?.label ?? 'your top goal'}” cost, in today’s money?`, why: 'We add price rises and work out how much to save each month. Skip if you don’t know yet.',
    chips: (a) => moneyChips(a, [1e5, 5e5, 10e5, 25e5, 50e5, 1e7], [5000, 20000, 50000, 100000, 500000]) },
  { id: 'goalYears', field: 'goalYears', kind: 'number', section: 'Goals', show: (a) => (a.goalAmount ?? 0) > 0, title: () => 'In how many years do you need it?', why: 'More years means a smaller amount to save each month.', suffix: 'years', placeholder: 'Type years',
    chips: () => yearsChips([1, 2, 3, 5, 8, 10, 15, 20, 25]) },
  { id: 'retireAge', field: 'retireAge', kind: 'number', section: 'Goals', optional: true, show: (a) => a.work !== 'retired', title: () => 'At what age would you like to stop working?', why: 'This is your retirement age. We work out how much money you need by then.', suffix: 'years', placeholder: 'e.g. 55',
    chips: () => [45, 50, 55, 58, 60, 65].map((v) => ({ label: String(v), value: v })) },
  { id: 'freedomIncome', field: 'freedomIncome', kind: 'money', section: 'Goals', optional: true, title: () => 'How much money a month (in today’s prices) would let you stop working?', why: 'This is your “freedom number”: the income your savings must give you so work becomes a choice.',
    chips: (a) => moneyChips(a, [30_000, 50_000, 75_000, 1e5, 2e5], [2000, 3000, 5000, 8000, 12000]) },
  // Tax & legal
  { id: 'taxRegime', field: 'taxRegime', kind: 'choice', section: 'Tax & legal', optional: true, show: india, title: () => 'Which income tax regime do you use?', why: 'India has two ways to work out income tax: the new one (lower rates, few deductions) and the old one (more deductions). We check which saves you more.',
    chips: () => [{ label: 'New regime', value: 'new' }, { label: 'Old regime', value: 'old' }, { label: 'I don’t know', value: 'unsure' }] },
  { id: 'section80C', field: 'section80C', kind: 'money', section: 'Tax & legal', optional: true, show: (a) => india(a) && a.taxRegime !== 'new', title: () => 'How much do you put into tax-saving plans (80C) each year?', why: 'PF, PPF, ELSS, life insurance and school fees count, up to ₹1,50,000 a year. It only lowers tax in the old regime.',
    chips: (a) => moneyChips(a, [0, 25_000, 50_000, 1e5, 1.5e5], [], 'Nothing') },
  { id: 'hasAdviser', field: 'hasAdviser', kind: 'choice', section: 'Tax & legal', optional: true, title: () => 'Do you have a CA or tax adviser you talk to every year?', why: 'If not, we explain tax in simple steps and tell you when an expert is worth it.', chips: () => yesNo() },
  { id: 'taxNotice', field: 'taxNotice', kind: 'choice', section: 'Tax & legal', optional: true, title: () => 'Do you have any tax notice or tax case open right now?', why: 'An open notice needs attention first. We will remind you to sort it with an expert.', chips: () => yesNo() },
  { id: 'nominees', field: 'nominees', kind: 'choice', section: 'Tax & legal', optional: true, title: () => 'Have you added a nominee to your bank accounts, investments and insurance?', why: 'A nominee is the person who gets the money if something happens to you. Without one, your family may wait years.',
    chips: () => [{ label: 'Yes, on all of them', value: 'all' }, { label: 'On some', value: 'some' }, { label: 'No', value: 'none' }, { label: 'Not sure', value: 'unsure' }] },
  { id: 'will', field: 'will', kind: 'choice', section: 'Tax & legal', optional: true, title: () => 'Have you written a will?', why: 'A will says who gets what. It saves your family from legal trouble later.', chips: () => yesNo() },
  { id: 'guardian', field: 'guardian', kind: 'choice', section: 'Tax & legal', optional: true, show: (a) => (a.dependants ?? 0) > 0, title: () => 'If you have children under 18, have you named a guardian for them?', why: 'A guardian looks after your children if both parents are gone. You name one in your will.',
    chips: () => [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }, { label: 'No young children', value: 'na' }] },
  // Habits
  { id: 'decisionStyle', field: 'decisionStyle', kind: 'choice', section: 'Habits', optional: true, title: () => 'How do you usually decide about money?', why: 'There is no wrong answer. It helps us explain things the way that works for you.',
    chips: () => [{ label: 'I check the numbers first', value: 'numbers' }, { label: 'I go with my feeling', value: 'feeling' }, { label: 'A bit of both', value: 'mix' }, { label: 'I ask family or friends', value: 'others' }] },
  { id: 'lostMoney', field: 'lostMoney', kind: 'choice', section: 'Habits', optional: true, title: () => 'Have you ever lost money on an investment?', why: 'Past losses shape how we feel about risk. We take that into account.', chips: () => yesNo() },
  { id: 'knowledgeGaps', field: 'knowledgeGaps', kind: 'multi', section: 'Habits', optional: true, title: () => 'Which of these would you like to understand better?', why: 'We will teach these first, in simple words.',
    chips: () => ['Saving & budgeting', 'Loans & credit score', 'Tax', 'Insurance', 'Mutual funds & SIP', 'Shares', 'Retirement', 'Crypto'].map((v) => ({ label: v, value: v })) },
  { id: 'scenarioIntro', kind: 'scenarioIntro', section: 'Money mindset', title: () => `Last part: ${SCENARIOS.length} quick “what would you do?” questions`, why: 'There are no right or wrong answers. They show how you think about money, so our ideas fit you. You can skip them.' },
  ...SCENARIOS.map((s): Step => ({ id: `scenario:${s.id}`, kind: 'scenario', section: 'Money mindset', optional: true, title: () => s.question, why: s.why })),
  { id: 'review', kind: 'review', section: 'Check', title: () => 'Check your answers and see your plan', why: '' },
];

const SECTIONS = ['About you', 'Income', 'Spending', 'Own & owe', 'Safety', 'Goals', 'Tax & legal', 'Habits', 'Money mindset'];

/** Reads "12,00,000", "1.5 lakh", "2.5k", "1.2 million" or "50000". */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[₹$£€,\s]|rs\.?|inr|usd|aed/g, '');
  const m = s.match(/^(\d+(?:\.\d+)?)(k|thousand|l|lakh|lakhs|lac|cr|crore|crores|m|mn|million|b|bn|billion)?$/);
  if (!m) return null;
  const mult: Record<string, number> = { k: 1e3, thousand: 1e3, l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, cr: 1e7, crore: 1e7, crores: 1e7, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };
  return Number(m[1]) * (m[2] ? mult[m[2]] : 1);
}

const LEVELS: Array<{ value: Level; title: string; text: string }> = [
  { value: 'beginner', title: 'Beginner', text: 'I’m new to this. Please explain in very simple words.' },
  { value: 'intermediate', title: 'Intermediate', text: 'I know basics like SIP, EMI, FD and tax regime.' },
  { value: 'advanced', title: 'Advanced', text: 'I’m comfortable with terms like XIRR and asset allocation.' },
];

function initialAnswers(name?: string, country?: string, currency?: string, level?: Level): OnboardingAnswers {
  const p = loadMoneyProfile();
  const base: OnboardingAnswers = { name: name || p?.name, country: country || 'India', currency: currency || 'INR', level };
  if (!p || p.source === 'sample') return base;
  return { ...base, age: p.age, monthlyIncome: Math.round(p.annualSalary / 12), monthlyExpenses: p.monthlyExpenses, monthlyEmi: p.monthlyEmi, loanOutstanding: p.loanOutstanding, liquidSavings: p.liquidSavings, investments: p.investments, dependants: p.dependants, healthCover: p.healthCover, termCover: p.termCover, goalAmount: p.goalAmountToday, goalYears: p.goalYears };
}

const valueText = (step: Step, a: OnboardingAnswers): string => {
  if (step.kind === 'scenario') {
    const s = SCENARIOS.find((x) => `scenario:${x.id}` === step.id);
    const i = a.scenarios?.[s?.id ?? ''];
    return i === undefined || !s ? 'Skipped' : s.options[i].label;
  }
  const v = step.field ? a[step.field] : undefined;
  if (v === undefined || v === '') return 'Skipped';
  if (step.kind === 'language') { const l = VOICE_LANGUAGES.find((x) => x.code === v); return l ? `${l.native} (${l.name})` : String(v); }
  if (step.kind === 'money') return formatMoney(Number(v), a.currency ?? 'INR');
  if (step.kind === 'level') return LEVELS.find((l) => l.value === v)?.title ?? String(v);
  if (step.kind === 'choice') return String(step.chips?.(a).find((c) => c.value === v)?.label ?? v);
  if (Array.isArray(v)) return v.length ? v.map((x) => step.chips?.(a).find((c) => c.value === x)?.label ?? x).join(', ') : 'Skipped';
  if (step.suffix) return `${v} ${step.suffix}`;
  return String(v);
};

// ---------------- Screen ----------------

export const RequiredOnboarding: React.FC<{ onComplete: (a: OnboardingAnswers) => Promise<void>; editing?: boolean; onClose?: () => void }> = ({ onComplete, editing = false, onClose }) => {
  const auth = useAuth();
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => {
    const saved = loadOnboardingRecord();
    if (editing && saved) return { ...saved.answers };
    const prefs = loadPrefs();
    return { ...initialAnswers(auth.profile?.full_name?.split(' ')[0], auth.profile?.country, auth.profile?.currency || prefs.currency, undefined), language: prefs.language !== 'en-IN' ? prefs.language : undefined };
  });
  const visible = useMemo(() => STEPS.filter((s) => !s.show || s.show(answers)), [answers]);
  // Editing opens on the summary, where every answer has an Edit link.
  const [stepId, setStepId] = useState(editing ? 'review' : 'language');
  const index = Math.max(0, visible.findIndex((s) => s.id === stepId));
  const step = visible[index];
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<Issue | { kind: 'error'; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load the saved answer into the box when a step opens.
  useEffect(() => {
    setProblem(null);
    const v = step.field ? answers[step.field] : undefined;
    setDraft(v === undefined || v === null ? '' : step.kind === 'money' ? Number(v).toLocaleString(isIndian(answers) ? 'en-IN' : 'en-US') : String(v));
    window.setTimeout(() => inputRef.current?.focus(), 50);
    window.scrollTo({ top: 0 });
  }, [stepId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the current section label in view in the top bar.
  useEffect(() => { document.querySelector('.ro-sections .is-now')?.scrollIntoView({ block: 'nearest', inline: 'center' }); }, [stepId]);

  const goTo = (id: string) => setStepId(id);
  const nextOf = (a: OnboardingAnswers) => {
    if (returnToReview) { setReturnToReview(false); return 'review'; }
    const list = STEPS.filter((s) => !s.show || s.show(a));
    const i = list.findIndex((s) => s.id === stepId);
    return list[Math.min(list.length - 1, i + 1)].id;
  };

  /** First step of the next section (for "Skip this section"); optional steps only, so nothing required is lost. */
  const skipSection = () => {
    const list = STEPS.filter((x) => !x.show || x.show(answers));
    const i = list.findIndex((x) => x.id === stepId);
    const rest = list.slice(i + 1);
    const jump = rest.find((x) => x.section !== step.section || (!x.optional && x.field));
    goTo(returnToReview ? 'review' : (jump ?? list[list.length - 1]).id);
    setReturnToReview(false);
  };
  // "Skip this section" only when every question still ahead in this section is optional.
  const sectionAllOptional = visible.slice(index).filter((x) => x.section === step.section && x.field).every((x) => x.optional);

  /** Saves a value for this step, runs the number checks for it, and moves on when they pass. */
  const commit = (value: OnboardingAnswers[keyof OnboardingAnswers] | undefined, extra?: Partial<OnboardingAnswers>) => {
    const next: OnboardingAnswers = { ...answers, ...extra };
    if (step.field) {
      if (value === undefined) delete next[step.field];
      else (next as Record<string, unknown>)[step.field] = value;
    }
    // The first goal picked is the main goal the plan is built around.
    if (step.field === 'goals') next.goal = (next.goals ?? [])[0];
    setAnswers(next);
    const issues = checkAnswers(next).filter((i) => i.field === step.field);
    const error = issues.find((i) => i.kind === 'error');
    if (error) { setProblem(error); return; }
    const toConfirm = issues.find((i) => i.kind === 'confirm' && !confirmed.has(`${i.field}:${i.message}`));
    if (toConfirm) { setProblem(toConfirm); return; }
    setProblem(null);
    goTo(nextOf(next));
  };

  const submitTyped = () => {
    const raw = draft.trim();
    if (!raw) {
      if (step.optional) return commit(undefined);
      setProblem({ kind: 'error', message: 'Please answer this one. We need it to build your plan.' });
      return;
    }
    if (step.kind === 'text') {
      if (raw.length < 2 || raw.length > 40 || !/[\p{L}]/u.test(raw)) { setProblem({ kind: 'error', message: 'Please type your name (2 to 40 letters).' }); return; }
      return commit(raw);
    }
    const n = step.kind === 'money' ? parseAmount(raw) : Number(raw.replace(/,/g, ''));
    if (n === null || !Number.isFinite(n)) { setProblem({ kind: 'error', message: step.kind === 'money' ? 'Please type an amount in numbers, like 25000 or 1.5 lakh.' : 'Please type a number.' }); return; }
    commit(step.id === 'age' ? Math.round(n) : n);
  };

  const confirmProblem = () => {
    if (!problem || problem.kind !== 'confirm' || !('field' in problem)) return;
    const key = `${problem.field}:${problem.message}`;
    const nextConfirmed = new Set(confirmed).add(key);
    setConfirmed(nextConfirmed);
    // Re-run the checks with this one accepted, in case another one is also waiting.
    const issues = checkAnswers(answers).filter((i) => i.field === step.field && !nextConfirmed.has(`${i.field}:${i.message}`));
    if (issues.length) { setProblem(issues[0]); return; }
    setProblem(null);
    goTo(nextOf(answers));
  };

  const back = () => { if (index > 0) goTo(visible[index - 1].id); };
  const finish = async () => {
    setBusy(true);
    try { await onComplete(answers); } finally { setBusy(false); }
  };

  const allIssues = checkAnswers(answers);
  const errors = allIssues.filter((i) => i.kind === 'error');
  const unconfirmed = allIssues.filter((i) => i.kind === 'confirm' && !confirmed.has(`${i.field}:${i.message}`));
  const required = visible.filter((s) => s.field && !s.optional && s.kind !== 'scenario');
  const missing = required.filter((s) => answers[s.field!] === undefined);
  const progress = Math.round((index / Math.max(1, visible.length - 1)) * 100);
  const sectionIndex = SECTIONS.indexOf(step.section);
  const cur = answers.currency ?? 'INR';
  const typedAmount = step.kind === 'money' ? parseAmount(draft) : null;

  return (
    <div className="ro-screen" role="dialog" aria-modal="true" aria-labelledby="ro-title">
      <header className="ro-top">
        <span className="ro-brand notranslate" translate="no"><ArthaMindLogoMark size={30} tone="app" /> ArthaMind</span>
        <div className="ro-sections" aria-hidden="true">
          {SECTIONS.map((s, i) => <span key={s} className={i < sectionIndex ? 'is-done' : i === sectionIndex ? 'is-now' : ''}>{s}</span>)}
        </div>
        {editing && onClose && <button type="button" className="ro-signout" onClick={onClose}><X size={14} /> Close</button>}
      </header>
      <div className="ro-bar" aria-label={`${progress}% done`}><span style={{ width: `${progress}%` }} /></div>

      <main className="ro-card">
        {step.kind !== 'intro' && step.kind !== 'review' && step.kind !== 'language' && (
          <p className="ro-kicker">{step.section}{step.optional ? ' · you can skip this' : ' · required'}</p>
        )}
        <h1 id="ro-title" className="ro-title">{step.title(answers)}</h1>

        {step.kind === 'language' && (
          <div className="ro-langs">{VOICE_LANGUAGES.map((l) => (
            <button key={l.code} type="button" translate="no" className={`ro-lang notranslate ${answers.language === l.code ? 'is-on' : ''}`} onClick={() => { setSiteLanguage(siteCode(l.code)); savePrefs({ language: l.code }); commit(l.code); }}>
              <b>{l.native}</b><span>{l.name}</span>
            </button>
          ))}</div>
        )}

        {step.kind === 'intro' && (
          <div className="ro-intro">
            <p>Answer a few short questions and ArthaMind fills in your whole workspace for you: your budget, tax, savings, loans and a plan for your goal.</p>
            <ul>
              <li><Check size={16} /> Takes about 3 minutes</li>
              <li><Check size={16} /> Rough numbers are fine. You can change them any time</li>
              <li><Check size={16} /> We never ask for bank passwords, PAN, Aadhaar or card numbers</li>
              <li><Check size={16} /> Your answers are saved to your account, only you can see them</li>
            </ul>
            <button type="button" className="ro-primary" onClick={() => goTo(nextOf(answers))}>Start <ArrowRight size={16} /></button>
          </div>
        )}

        {step.why && <p className="ro-why"><CircleHelp size={15} aria-hidden="true" /> <span><b>Why we ask:</b> {step.why}</span></p>}

        {(step.kind === 'text' || step.kind === 'number' || step.kind === 'money') && (
          <form className="ro-form" onSubmit={(e) => { e.preventDefault(); submitTyped(); }}>
            {step.chips && <div className="ro-chips">{step.chips(answers).map((c) => (
              <button key={String(c.value)} type="button" className={`ro-chip ${answers[step.field!] === c.value ? 'is-on' : ''}`} onClick={() => { setDraft(String(c.value)); commit(c.value as never); }}>{c.label}</button>
            ))}</div>}
            <label className="ro-type">
              <span>{step.chips ? 'Or type it:' : 'Type here:'}</span>
              <span className="ro-input-wrap">
                {step.kind === 'money' && <i>{formatMoney(0, cur).replace(/0$/, '')}</i>}
                <input ref={inputRef} inputMode={step.kind === 'text' ? 'text' : 'decimal'} value={draft} placeholder={step.placeholder ?? (step.kind === 'money' ? (isIndian(answers) ? 'e.g. 45000 or 1.5 lakh' : 'e.g. 4500') : '')} onChange={(e) => { setDraft(e.target.value); setProblem(null); }} aria-label={step.title(answers)} />
                {step.suffix && <em>{step.suffix}</em>}
              </span>
            </label>
            {typedAmount !== null && typedAmount >= 1000 && <p className="ro-words">= {formatMoney(typedAmount, cur)} ({moneyInWords(typedAmount, cur)}){step.id === 'monthlyIncome' ? ` a month · ${formatMoney(typedAmount * 12, cur)} a year` : ''}</p>}
            <Problem problem={problem} onConfirm={confirmProblem} onChange={() => { setProblem(null); inputRef.current?.focus(); }} />
            <div className="ro-actions">
              <button type="button" className="ro-ghost" onClick={back} disabled={index === 0}><ArrowLeft size={15} /> Back</button>
              <div>
                {step.optional && sectionAllOptional && <button type="button" className="ro-ghost" onClick={skipSection}>Skip this section</button>}
                {step.optional && <button type="button" className="ro-ghost" onClick={() => commit(undefined)}>Skip</button>}
                <button type="submit" className="ro-primary">Next <ArrowRight size={16} /></button>
              </div>
            </div>
          </form>
        )}

        {step.kind === 'level' && (
          <>
            <div className="ro-levels">{LEVELS.map((l) => (
              <button key={l.value} type="button" className={`ro-level ${answers.level === l.value ? 'is-on' : ''}`} onClick={() => commit(l.value)}><b>{l.title}</b><span>{l.text}</span></button>
            ))}</div>
            <div className="ro-actions"><button type="button" className="ro-ghost" onClick={back}><ArrowLeft size={15} /> Back</button></div>
          </>
        )}

        {step.kind === 'country' && (
          <>
            <div className="ro-chips">{COUNTRIES.map((c) => (
              <button key={c.country} type="button" className={`ro-chip ${answers.country === c.country ? 'is-on' : ''}`} onClick={() => commit(c.country, { currency: c.currency })}>{c.country} <small>{c.currency}</small></button>
            ))}</div>
            {answers.country && answers.country !== 'India' && <p className="ro-note">Amounts will be in {answers.currency}. Tax and some planners in ArthaMind follow Indian rules today; we will show you when a number is India-only.</p>}
            <div className="ro-actions"><button type="button" className="ro-ghost" onClick={back}><ArrowLeft size={15} /> Back</button></div>
          </>
        )}

        {step.kind === 'choice' && (
          <>
            <div className="ro-options">{step.chips!(answers).map((c) => (
              <button key={String(c.value)} type="button" className={`ro-option ${answers[step.field!] === c.value ? 'is-on' : ''}`} onClick={() => commit(c.value as never)}>{c.label}</button>
            ))}</div>
            <Problem problem={problem} onConfirm={confirmProblem} onChange={() => setProblem(null)} />
            <div className="ro-actions">
              <button type="button" className="ro-ghost" onClick={back}><ArrowLeft size={15} /> Back</button>
              {step.optional && <div>
                {sectionAllOptional && <button type="button" className="ro-ghost" onClick={skipSection}>Skip this section</button>}
                <button type="button" className="ro-ghost" onClick={() => commit(undefined)}>Skip</button>
              </div>}
            </div>
          </>
        )}

        {step.kind === 'multi' && (() => {
          const picked = (answers[step.field!] as string[] | undefined) ?? [];
          const max = step.max ?? 99;
          const toggle = (v: string) => {
            const next = picked.includes(v) ? picked.filter((x) => x !== v) : picked.length >= max ? picked : [...picked, v];
            setAnswers({ ...answers, [step.field!]: next });
            setProblem(null);
          };
          return (
            <>
              <div className="ro-chips">{step.chips!(answers).map((c) => {
                const at = picked.indexOf(String(c.value));
                return <button key={String(c.value)} type="button" aria-pressed={at >= 0} className={`ro-chip ${at >= 0 ? 'is-on' : ''}`} onClick={() => toggle(String(c.value))}>{at >= 0 && max < 99 ? `${at + 1}. ` : ''}{c.label}</button>;
              })}</div>
              {max < 99 && <p className="ro-note">{picked.length}/{max} picked. Tap in order of importance.</p>}
              <Problem problem={problem} onConfirm={confirmProblem} onChange={() => setProblem(null)} />
              <div className="ro-actions">
                <button type="button" className="ro-ghost" onClick={back}><ArrowLeft size={15} /> Back</button>
                <div>
                  {step.optional && sectionAllOptional && <button type="button" className="ro-ghost" onClick={skipSection}>Skip this section</button>}
                  {step.optional && <button type="button" className="ro-ghost" onClick={() => commit(undefined)}>Skip</button>}
                  <button type="button" className="ro-primary" onClick={() => {
                    if (!picked.length && !step.optional) { setProblem({ kind: 'error', message: 'Please pick at least one.' }); return; }
                    commit(picked.length ? picked : undefined);
                  }}>Next <ArrowRight size={16} /></button>
                </div>
              </div>
            </>
          );
        })()}

        {step.kind === 'scenarioIntro' && (
          <div className="ro-actions">
            <button type="button" className="ro-ghost" onClick={back}><ArrowLeft size={15} /> Back</button>
            <div>
              <button type="button" className="ro-ghost" onClick={() => goTo('review')}>Skip these</button>
              <button type="button" className="ro-primary" onClick={() => goTo(nextOf(answers))}>Let’s go <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {step.kind === 'scenario' && (() => {
          const s = SCENARIOS.find((x) => `scenario:${x.id}` === step.id)!;
          const chosen = answers.scenarios?.[s.id];
          return (
            <>
              <div className="ro-options">{s.options.map((o, i) => (
                <button key={o.label} type="button" className={`ro-option ${chosen === i ? 'is-on' : ''}`} onClick={() => { const next = { ...answers, scenarios: { ...(answers.scenarios ?? {}), [s.id]: i } }; setAnswers(next); goTo(nextOf(next)); }}>{o.label}</button>
              ))}</div>
              <div className="ro-actions">
                <button type="button" className="ro-ghost" onClick={back}><ArrowLeft size={15} /> Back</button>
                <button type="button" className="ro-ghost" onClick={() => goTo(nextOf(answers))}>Skip</button>
              </div>
            </>
          );
        })()}

        {step.kind === 'review' && (
          <Review editing={editing} answers={answers} visible={visible} errors={errors} unconfirmed={unconfirmed} missing={missing} busy={busy}
            onEdit={(id) => { setReturnToReview(true); goTo(id); }}
            onConfirmAll={() => setConfirmed(new Set([...confirmed, ...unconfirmed.map((i) => `${i.field}:${i.message}`)]))}
            onFinish={() => void finish()} />
        )}
      </main>
      <p className="ro-foot">Investments are subject to market risks. ArthaMind gives information for learning, not personal advice.</p>
    </div>
  );
};

const Problem: React.FC<{ problem: Issue | { kind: 'error'; message: string } | null; onConfirm: () => void; onChange: () => void }> = ({ problem, onConfirm, onChange }) => {
  if (!problem) return null;
  return (
    <div className={`ro-problem ${problem.kind === 'error' ? 'is-error' : ''}`} role="alert">
      <TriangleAlert size={16} aria-hidden="true" />
      <div>
        <p>{problem.message}</p>
        {problem.kind === 'confirm' && (
          <div className="ro-problem-actions">
            <button type="button" onClick={onChange}><Pencil size={13} /> Change it</button>
            <button type="button" onClick={onConfirm}><Check size={13} /> Yes, it’s correct</button>
          </div>
        )}
      </div>
    </div>
  );
};

const Review: React.FC<{
  editing?: boolean;
  answers: OnboardingAnswers; visible: Step[]; errors: Issue[]; unconfirmed: Issue[]; missing: Step[]; busy: boolean;
  onEdit: (id: string) => void; onConfirmAll: () => void; onFinish: () => void;
}> = ({ editing, answers, visible, errors, unconfirmed, missing, busy, onEdit, onConfirmAll, onFinish }) => {
  const mind = scoreMindset(answers);
  const cur = answers.currency ?? 'INR';
  const income = answers.monthlyIncome ?? 0;
  const out = (totalSpend(answers) ?? 0) + (answers.monthlyEmi ?? 0);
  const left = income - out;
  const path = buildPath(answers, (n) => formatMoney(n, cur));
  const rows = visible.filter((s) => s.field || s.kind === 'scenario');
  const stepFor = (field: keyof OnboardingAnswers) => visible.find((s) => s.field === field)?.id ?? 'intro';
  const ready = !errors.length && !unconfirmed.length && !missing.length;
  return (
    <div className="ro-review">
      <div className="ro-summary">
        <div><span>Money in each month</span><b>{formatMoney(income, cur)}</b></div>
        <div><span>Money out (spending + EMIs)</span><b>{formatMoney(out, cur)}</b></div>
        <div><span>{left >= 0 ? 'Left to save' : 'Short each month'}</span><b className={left < 0 ? 'is-neg' : ''}>{formatMoney(Math.abs(left), cur)}</b></div>
      </div>
      <p className="ro-runway">{Number.isFinite(path.runwayMonths)
        ? <>If your income stopped tomorrow, your bank savings would last <b>{path.runwayMonths < 1 ? 'less than 1 month' : `about ${Math.floor(path.runwayMonths)} month${Math.floor(path.runwayMonths) === 1 ? '' : 's'}`}</b>.</>
        : <>You have no monthly costs entered, so there is nothing for savings to cover yet.</>}</p>
      <section className="ro-path" aria-label="Your first steps">
        <h2>Your path, step by step</h2>
        <ol>{path.steps.map((p, i) => <li key={p.title} className={`is-${p.tone}`}><span>{i + 1}</span><div><b>{p.title}</b><p>{p.text}</p></div></li>)}</ol>
        <small>Worked out from your answers with simple maths (prices rising 6% a year; investments growing 7–10% a year, which is not guaranteed). Your workspace has the full detail.</small>
      </section>
      {mind.answered > 0 && (
        <div className="ro-mind"><Sparkles size={16} aria-hidden="true" /><div><b>Your money mindset</b><p>{mind.riskLabel}.</p><p>{mind.habitLabel}.</p></div></div>
      )}
      {missing.length > 0 && <div className="ro-problem is-error" role="alert"><TriangleAlert size={16} /><div><p>Please answer: {missing.map((m) => m.title(answers)).join(' · ')}</p><div className="ro-problem-actions"><button type="button" onClick={() => onEdit(missing[0].id)}><Pencil size={13} /> Answer now</button></div></div></div>}
      {errors.map((e) => <div key={e.message} className="ro-problem is-error" role="alert"><TriangleAlert size={16} /><div><p>{e.message}</p><div className="ro-problem-actions"><button type="button" onClick={() => onEdit(stepFor(e.field))}><Pencil size={13} /> Fix it</button></div></div></div>)}
      {unconfirmed.length > 0 && (
        <div className="ro-problem" role="alert"><TriangleAlert size={16} /><div>
          <p><b>Please check these numbers:</b></p>
          <ul>{unconfirmed.map((u) => <li key={u.message}>{u.message} <button type="button" className="ro-link" onClick={() => onEdit(stepFor(u.field))}>Change</button></li>)}</ul>
          <div className="ro-problem-actions"><button type="button" onClick={onConfirmAll}><Check size={13} /> I checked, these are correct</button></div>
        </div></div>
      )}
      <dl className="ro-list">
        {rows.map((s) => (
          <div key={s.id}><dt>{s.kind === 'scenario' ? s.title(answers) : s.title(answers).replace(/^Hi [^!]+! /, '')}</dt><dd>{valueText(s, answers)} <button type="button" className="ro-link" onClick={() => onEdit(s.id)}>Edit</button></dd></div>
        ))}
      </dl>
      <button type="button" className="ro-primary ro-finish" disabled={!ready || busy} onClick={onFinish}>
        {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <>{editing ? 'Save my answers' : 'Open my workspace'} <ArrowRight size={16} /></>}
      </button>
      {!ready && <p className="ro-note">Fix the points above to continue.</p>}
    </div>
  );
};
