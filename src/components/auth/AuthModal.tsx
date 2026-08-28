import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ArthaBenchLogo } from '../branding/ArthaBenchLogo';

const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3.5 py-3 text-sm text-ink outline-none placeholder:text-secondary focus:border-interactive focus:ring-2 focus:ring-interactive/20';
const labelClass = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-secondary';

export const AuthModal: React.FC = () => {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('India');
  const [remember, setRemember] = useState(true);
  const [termsConsent, setTermsConsent] = useState(false);
  const [financialConsent, setFinancialConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goal, setGoal] = useState('all');
  const [currency, setCurrency] = useState('INR');
  const [marketFocus, setMarketFocus] = useState<'India' | 'US' | 'Global'>('India');
  const [incomeRange, setIncomeRange] = useState('');
  const [learningLevel, setLearningLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [personalInsights, setPersonalInsights] = useState(false);
  const [financialGoal, setFinancialGoal] = useState('');

  useEffect(() => {
    if (auth.profile) {
      setFullName(auth.profile.full_name || '');
      setCountry(auth.profile.country || 'India');
      setGoal(auth.profile.primary_goal || 'all');
      setCurrency(auth.profile.currency || 'INR');
      setMarketFocus(auth.profile.market_focus || 'India');
      setIncomeRange(auth.profile.monthly_income_range || '');
      setLearningLevel(auth.profile.learning_level || 'beginner');
      setPersonalInsights(auth.profile.personal_data_insights_enabled);
      setFinancialGoal(auth.profile.financial_goal || '');
    }
  }, [auth.profile]);

  useEffect(() => {
    setError(null);
  }, [auth.authScreen]);

  if (!auth.authOpen) return null;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await task(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    void run(() => auth.signIn(email, password, remember));
  };

  const submitSignup = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    if (!termsConsent) return setError('Accept the Terms and Privacy Policy to create an account.');
    void run(() => auth.signUp({ fullName, email, password, country, financialDataConsent: financialConsent }));
  };

  const submitForgot = (event: FormEvent) => {
    event.preventDefault();
    void run(() => auth.forgotPassword(email));
  };

  const submitReset = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters for your new password.');
    if (password !== confirmPassword) return setError('Passwords do not match.');
    void run(() => auth.resetPassword(password));
  };

  const submitOnboarding = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await auth.saveProfile({
        full_name: fullName,
        country,
        currency,
        market_focus: marketFocus,
        learning_level: learningLevel,
        primary_goal: goal,
        monthly_income_range: incomeRange || null,
        financial_goal: financialGoal || null,
        personal_data_insights_enabled: personalInsights,
        onboarding_completed: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      });
      auth.closeAuth();
    });
  };

  const title = auth.authScreen === 'login' ? 'Your Financial Intelligence Workspace.'
    : auth.authScreen === 'signup' ? 'Create your Artha Bench account'
      : auth.authScreen === 'forgot' ? 'Reset your password'
        : auth.authScreen === 'reset' ? 'Choose a new password'
          : auth.authScreen === 'onboarding' ? 'Personalize your workspace'
            : 'Check your email';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-line bg-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <ArthaBenchLogo compact />
          <button type="button" onClick={auth.closeAuth} className="rounded-xl border border-line bg-canvas p-2 text-secondary hover:text-ink" aria-label="Close account dialog">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-7">
          <div className="mb-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-success-fill/25 bg-success-soft px-3 py-1 text-[10px] font-bold text-success">
              <ShieldCheck className="h-3.5 w-3.5" /> Private account workspace
            </div>
            <h2 id="auth-title" className="text-2xl font-black tracking-tight text-ink">{title}</h2>
            <p className="mt-2 text-xs leading-6 text-secondary">
              {auth.authScreen === 'login' || auth.authScreen === 'signup'
                ? 'Save your financial workspace, learning progress, reports, and personalized ArthaMind insights.'
                : auth.authScreen === 'onboarding'
                  ? 'These preferences personalize the interface. Optional values are never treated as verified financial facts.'
                  : 'Artha Bench uses secure provider-managed authentication. Passwords are never stored by this application.'}
            </p>
          </div>

          {!auth.configured && auth.authScreen !== 'onboarding' && (
            <div className="mb-5 rounded-2xl border border-warning-fill/30 bg-warning-soft p-4 text-xs leading-5 text-warning">
              Account services are not configured on this deployment yet. Public Artha Bench features remain available; add the documented Supabase environment variables to enable sign-in.
            </div>
          )}

          {(error || auth.authMessage) && (
            <div className={`mb-5 rounded-2xl border px-4 py-3 text-xs leading-5 ${error ? 'border-danger/30 bg-danger-soft text-danger' : 'border-success-fill/30 bg-success-soft text-success'}`}>
              {error || auth.authMessage}
            </div>
          )}

          {auth.authScreen === 'login' && (
            <form onSubmit={submitLogin} className="space-y-4">
              <div><label className={labelClass} htmlFor="login-email">Email</label><input id="login-email" className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className={labelClass} htmlFor="login-password">Password</label><div className="relative"><input id="login-password" className={`${inputClass} pr-11`} type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div className="flex items-center justify-between gap-3 text-xs"><label className="flex items-center gap-2 text-secondary"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label><button type="button" onClick={() => auth.openAuth('forgot')} className="font-semibold text-interactive">Forgot password?</button></div>
              <button disabled={busy || !auth.configured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Sign in</button>
              <button type="button" disabled={!auth.configured} onClick={auth.continueWithGoogle} className="w-full rounded-xl border border-line-strong bg-canvas px-4 py-3 text-sm font-bold text-ink disabled:opacity-50">Continue with Google</button>
              <button type="button" onClick={() => auth.openAuth('signup')} className="w-full text-center text-xs font-semibold text-interactive">Create account</button>
              <p className="text-center text-[10px] leading-5 text-secondary">Educational analysis only — not investment, tax, legal, or financial advice. · Privacy & data controls are available in Account.</p>
            </form>
          )}

          {auth.authScreen === 'signup' && (
            <form onSubmit={submitSignup} className="space-y-4">
              <button type="button" onClick={() => auth.openAuth('login')} className="inline-flex items-center gap-1 text-xs font-semibold text-secondary"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</button>
              <div><label className={labelClass} htmlFor="signup-name">Full name</label><input id="signup-name" className={inputClass} required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><label className={labelClass} htmlFor="signup-email">Email address</label><input id="signup-email" className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>Password</label><input className={inputClass} type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div><label className={labelClass}>Confirm password</label><input className={inputClass} type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
              </div>
              <div><label className={labelClass}>Country / region</label><select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}><option>India</option><option>United States</option><option>United Kingdom</option><option>Other</option></select></div>
              <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary"><input className="mt-0.5" type="checkbox" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} /><span>I agree to the Terms and Privacy Policy.</span></label>
              <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary"><input className="mt-0.5" type="checkbox" checked={financialConsent} onChange={(e) => setFinancialConsent(e.target.checked)} /><span>I explicitly allow ArthaMind to use my authorized financial data for personalized educational analysis. I can turn this off later.</span></label>
              <button disabled={busy || !auth.configured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Create account</button>
            </form>
          )}

          {auth.authScreen === 'forgot' && (
            <form onSubmit={submitForgot} className="space-y-4"><button type="button" onClick={() => auth.openAuth('login')} className="inline-flex items-center gap-1 text-xs font-semibold text-secondary"><ArrowLeft className="h-3.5 w-3.5" /> Back</button><div><label className={labelClass}>Email</label><input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><button disabled={busy || !auth.configured} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">Send reset link</button></form>
          )}

          {auth.authScreen === 'reset' && (
            <form onSubmit={submitReset} className="space-y-4"><div><label className={labelClass}>New password</label><input className={inputClass} type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div><div><label className={labelClass}>Confirm new password</label><input className={inputClass} type="password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div><button disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">Update password</button></form>
          )}

          {auth.authScreen === 'verify' && (
            <div className="space-y-5 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><p className="text-sm leading-6 text-secondary">Use the secure link sent by the authentication provider. After verification, return to Artha Bench and sign in.</p><button type="button" onClick={() => auth.openAuth('login')} className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white">Return to sign in</button></div>
          )}

          {auth.authScreen === 'onboarding' && (
            <form onSubmit={submitOnboarding} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Full name</label><input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div><div><label className={labelClass}>Country</label><input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} /></div></div>
              <div><label className={labelClass}>Primary goal</label><select className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)}><option value="learn">Learn finance</option><option value="manage">Manage personal finances</option><option value="markets">Follow markets</option><option value="evaluate">Test financial AI</option><option value="all">All of these</option></select></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Preferred currency</label><select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></div><div><label className={labelClass}>Market focus</label><select className={inputClass} value={marketFocus} onChange={(e) => setMarketFocus(e.target.value as typeof marketFocus)}><option>India</option><option>US</option><option>Global</option></select></div></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Monthly income range (optional)</label><input className={inputClass} placeholder="e.g. ₹25k–₹50k" value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)} /></div><div><label className={labelClass}>Learning level</label><select className={inputClass} value={learningLevel} onChange={(e) => setLearningLevel(e.target.value as typeof learningLevel)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div></div>
              <div><label className={labelClass}>Savings or financial goal (optional)</label><input className={inputClass} placeholder="Describe a goal without sensitive account details" value={financialGoal} onChange={(e) => setFinancialGoal(e.target.value)} /></div>
              <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary"><input className="mt-0.5" type="checkbox" checked={personalInsights} onChange={(e) => setPersonalInsights(e.target.checked)} /><span>Enable personalized ArthaMind insights using the data sources I explicitly authorize.</span></label>
              <div className="flex flex-col gap-2 sm:flex-row"><button disabled={busy} className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">Save preferences</button><button type="button" onClick={auth.closeAuth} className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-secondary">Skip for now</button></div>
            </form>
          )}

          <div className="mt-6 flex items-start gap-2 border-t border-line pt-4 text-[10px] leading-5 text-secondary"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> Authentication tokens are managed by the configured provider. Artha Bench never stores raw passwords or service-role database credentials in browser code.</div>
        </div>
      </div>
    </div>
  );
};
