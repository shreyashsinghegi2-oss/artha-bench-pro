import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Cloud, Database, Download, KeyRound, LockKeyhole, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { captureManagedWorkspace, downloadJSON } from '../../services/cloudWorkspace';
import { AI_CONTEXT_STORAGE_KEY, loadAiDataContext, saveAiDataContext, AiDataContextPreferences } from '../../services/aiDataContext';
import { deleteAllAiHistory, deleteFinancialCloudData, exportCloudData, requestAccountDeletion } from '../../services/supabaseRest';

const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs text-ink outline-none focus:border-interactive focus:ring-2 focus:ring-interactive/20';
const FINANCIAL_KEYS = ['artha_income_sources_v1', 'artha_expenses_v1', 'artha_budgets_v1', 'artha_india_tax_workspace_v1'];
const NOTIFICATION_KEY = 'arthabench_notifications_v1';

export const PersonalAccountControls: React.FC = () => {
  const auth = useAuth();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('India');
  const [currency, setCurrency] = useState('INR');
  const [marketFocus, setMarketFocus] = useState<'India' | 'US' | 'Global'>('India');
  const [learningLevel, setLearningLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [financialGoal, setFinancialGoal] = useState('');
  const [aiContext, setAiContext] = useState<AiDataContextPreferences>(() => loadAiDataContext());
  const [notifications, setNotifications] = useState({ budget: true, watchlist: false, learning: true, product: false });
  const [deleteFinancialConfirm, setDeleteFinancialConfirm] = useState('');
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.profile) return;
    setName(auth.profile.full_name || '');
    setCountry(auth.profile.country || 'India');
    setCurrency(auth.profile.currency || 'INR');
    setMarketFocus(auth.profile.market_focus || 'India');
    setLearningLevel(auth.profile.learning_level || 'beginner');
    setFinancialGoal(auth.profile.financial_goal || '');
  }, [auth.profile]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_KEY);
      if (raw) setNotifications((current) => ({ ...current, ...JSON.parse(raw) }));
    } catch { /* Keep safe defaults. */ }
  }, []);

  const localCounts = useMemo(() => {
    const parseCount = (key: string, field?: string) => {
      try {
        const raw = localStorage.getItem(key); if (!raw) return 0;
        const parsed = JSON.parse(raw);
        const value = field ? parsed?.[field] : parsed;
        return Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 0;
      } catch { return 0; }
    };
    return {
      income: parseCount('artha_income_sources_v1', 'sources'),
      expenses: parseCount('artha_expenses_v1', 'records'),
      budgets: parseCount('artha_budgets_v1', 'budgets'),
      reports: parseCount('arthabench_reports'),
    };
  }, [status]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true); setStatus(null);
    try { await task(); } catch (error) { setStatus(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  };

  if (!auth.user || !auth.session) {
    return (
      <div className="rounded-3xl border border-interactive/20 bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2 text-sm font-black text-ink"><Cloud className="h-5 w-5 text-interactive" /> Personalized cloud workspace</div><p className="mt-2 max-w-2xl text-xs leading-6 text-secondary">Public Artha Bench remains available without an account. Sign in to sync your authorized financial workspace, learning progress, reports, preferences and optional ArthaMind history across sessions and devices.</p></div>
          <button type="button" onClick={() => auth.openAuth('login')} className="shrink-0 rounded-xl bg-brand px-5 py-3 text-sm font-black text-white">Sign in / Create account</button>
        </div>
      </div>
    );
  }

  const saveProfile = () => run(async () => {
    await auth.saveProfile({ full_name: name, country, currency, market_focus: marketFocus, learning_level: learningLevel, financial_goal: financialGoal || null, onboarding_completed: true });
    setStatus('Profile and personalization preferences saved.');
  });

  const updateAiContext = (key: keyof AiDataContextPreferences, value: boolean) => {
    const next = { ...aiContext, [key]: value };
    setAiContext(next);
    saveAiDataContext(next);
    setStatus('ArthaMind data-context preferences updated. Cloud sync will mirror this choice.');
  };

  const updateNotification = (key: keyof typeof notifications, value: boolean) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(next));
  };

  const exportData = () => run(async () => {
    const cloud = await exportCloudData(auth.session!.access_token).catch(() => null);
    downloadJSON(`artha-bench-data-${new Date().toISOString().slice(0, 10)}.json`, { account: { email: auth.user?.email, profile: auth.profile }, cloud, local_workspace: captureManagedWorkspace() });
    setStatus('A JSON export of your accessible workspace was prepared.');
  });

  const deleteFinancial = () => run(async () => {
    if (deleteFinancialConfirm !== 'DELETE FINANCIAL DATA') throw new Error('Type DELETE FINANCIAL DATA exactly to confirm.');
    await deleteFinancialCloudData(auth.session!.access_token);
    FINANCIAL_KEYS.forEach((key) => localStorage.removeItem(key));
    await auth.syncNow();
    setDeleteFinancialConfirm('');
    setStatus('Financial workspace data removed from this account workspace.');
  });

  const deleteHistory = () => run(async () => {
    await deleteAllAiHistory(auth.session!.access_token);
    setStatus('Saved ArthaMind conversation history deleted.');
  });

  const deleteAccount = () => run(async () => {
    if (deleteAccountConfirm !== 'DELETE MY ACCOUNT') throw new Error('Type DELETE MY ACCOUNT exactly to confirm.');
    await requestAccountDeletion(auth.session!.access_token);
    setStatus('Account deleted. Signing out…');
    await auth.signOut();
  });

  return (
    <div className="space-y-6">
      {status && <div className="rounded-2xl border border-interactive/25 bg-interactive-soft px-4 py-3 text-xs text-ink">{status}</div>}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-interactive" /><div><h2 className="text-sm font-black text-ink">Profile & Personalization</h2><p className="text-[10px] text-secondary">Authenticated as {auth.user.email}</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label="Full name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Region"><input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
            <Field label="Currency"><select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></Field>
            <Field label="Market focus"><select className={inputClass} value={marketFocus} onChange={(e) => setMarketFocus(e.target.value as typeof marketFocus)}><option>India</option><option>US</option><option>Global</option></select></Field>
            <Field label="Learning level"><select className={inputClass} value={learningLevel} onChange={(e) => setLearningLevel(e.target.value as typeof learningLevel)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></Field>
            <Field label="Timezone"><input className={inputClass} readOnly value={auth.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} /></Field>
          </div>
          <Field label="Optional financial goal"><input className={`${inputClass} mt-3`} value={financialGoal} onChange={(e) => setFinancialGoal(e.target.value)} placeholder="Goal description; avoid account numbers or secrets" /></Field>
          <button type="button" disabled={busy} onClick={saveProfile} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save profile</button>
        </section>

        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><Database className="h-5 w-5 text-interactive" /><div><h2 className="text-sm font-black text-ink">Data & Cloud Persistence</h2><p className="text-[10px] text-secondary">User-scoped workspace mirror · {auth.syncing ? 'syncing…' : 'ready'}</p></div></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(localCounts).map(([key, value]) => <div key={key} className="rounded-xl border border-line bg-canvas p-3"><div className="text-xl font-black text-ink">{value}</div><div className="text-[9px] capitalize text-secondary">{key}</div></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={exportData} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink"><Download className="h-4 w-4" /> Export my data</button><button type="button" onClick={() => void auth.syncNow()} disabled={busy || auth.syncing} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink">Sync now</button></div>
          <div className="mt-5 rounded-2xl border border-danger/20 bg-danger-soft p-4"><div className="text-xs font-black text-danger">Delete my financial data</div><p className="mt-1 text-[10px] leading-5 text-secondary">Removes account-linked Income, Expenses, Budgets and tax workspace data. It does not delete your account.</p><input className={`${inputClass} mt-3`} value={deleteFinancialConfirm} onChange={(e) => setDeleteFinancialConfirm(e.target.value)} placeholder="Type DELETE FINANCIAL DATA" /><button type="button" onClick={deleteFinancial} disabled={busy} className="mt-2 rounded-xl border border-danger/25 px-3 py-2 text-xs font-bold text-danger">Delete financial data</button></div>
        </section>
      </div>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-success" /><div><h2 className="text-sm font-black text-ink">ArthaMind AI Privacy & Data Context</h2><p className="text-[10px] text-secondary">Public market & economic data stays enabled; personal sources are opt-in.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ContextToggle label="My income & expenses" checked={aiContext.personalFinance} onChange={(v) => updateAiContext('personalFinance', v)} />
          <ContextToggle label="Budgets & goals" checked={aiContext.budgetsAndGoals} onChange={(v) => updateAiContext('budgetsAndGoals', v)} />
          <ContextToggle label="Paper portfolio" checked={aiContext.paperPortfolio} onChange={(v) => updateAiContext('paperPortfolio', v)} />
          <ContextToggle label="Learning progress" checked={aiContext.learningProgress} onChange={(v) => updateAiContext('learningProgress', v)} />
          <ContextToggle label="Save AI conversation" checked={aiContext.saveConversation} onChange={(v) => updateAiContext('saveConversation', v)} />
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-secondary"><LockKeyhole className="h-3.5 w-3.5 text-success" /> Disabled sources must not be retrieved or included in personalized AI requests.</div>
        <button type="button" onClick={deleteHistory} disabled={busy} className="mt-3 rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink">Delete all AI history</button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-interactive" /><h2 className="text-sm font-black text-ink">Notifications</h2></div><div className="mt-4 grid gap-2">{([['budget','Budget alerts'],['watchlist','Watchlist alerts'],['learning','Learning reminders'],['product','Product updates']] as const).map(([key,label]) => <label key={key} className="flex items-center justify-between rounded-xl border border-line bg-canvas px-3 py-2.5 text-xs text-ink"><span>{label}</span><input type="checkbox" checked={notifications[key]} onChange={(e) => updateNotification(key,e.target.checked)} /></label>)}</div></section>
        <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-interactive" /><h2 className="text-sm font-black text-ink">Security</h2></div><p className="mt-3 text-xs leading-6 text-secondary">Password authentication and connected sign-in methods are managed by the configured authentication provider. Sessions persist according to your Remember me choice.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => auth.openAuth('reset')} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink">Change password</button><button type="button" onClick={() => void auth.signOut()} className="rounded-xl border border-line bg-canvas px-3 py-2 text-xs font-bold text-ink">Secure sign out</button></div></section>
      </div>

      <section className="rounded-3xl border border-danger/25 bg-danger-soft p-5"><div className="flex items-center gap-2 text-danger"><Trash2 className="h-5 w-5" /><h2 className="text-sm font-black">Danger Zone · Delete Account</h2></div><p className="mt-2 text-xs leading-6 text-secondary">Permanently deletes the authentication account and user-owned rows through the server-side admin operation. This cannot be undone.</p><input className={`${inputClass} mt-3 max-w-md`} value={deleteAccountConfirm} onChange={(e) => setDeleteAccountConfirm(e.target.value)} placeholder="Type DELETE MY ACCOUNT" /><button type="button" onClick={deleteAccount} disabled={busy} className="mt-2 block rounded-xl bg-danger px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Trash2 className="mr-2 inline h-4 w-4" />Delete my account</button></section>
    </div>
  );
};

const Field: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-secondary">{label}</span>{children}</label>;
const ContextToggle: React.FC<{ label: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, checked, onChange }) => <label className={`flex min-h-20 cursor-pointer flex-col justify-between rounded-2xl border p-3 ${checked ? 'border-success-fill/30 bg-success-soft' : 'border-line bg-canvas'}`}><span className="text-xs font-bold text-ink">{label}</span><span className="mt-3 flex items-center justify-between text-[9px] text-secondary"><span>{checked ? 'Enabled' : 'Disabled'}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></span></label>;
