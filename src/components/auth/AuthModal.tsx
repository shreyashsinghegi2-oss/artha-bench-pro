import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { isSocialProviderEnabled, resendSignupConfirmation } from '../../services/supabaseRest';
import { ArthaBenchLogo } from '../branding/ArthaBenchLogo';

const inputClass = 'w-full rounded-xl border border-line-strong bg-canvas px-3.5 py-3 text-sm text-ink outline-none placeholder:text-secondary transition focus:border-interactive focus:ring-2 focus:ring-interactive/20';
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-secondary';
const PENDING_RETURN_KEY = 'arthabench_pending_private_return_v1';

function destinationLabel(path: string | null) {
  if (!path) return null;
  const labels: Record<string, string> = {
    '/finance/overview': 'Financial Workspace',
    '/finance/income': 'Income',
    '/finance/expenses': 'Expenses',
    '/finance/budgeting': 'Budgeting',
    '/finance/reports': 'Private Reports',
    '/finance/emi-manager': 'EMI Manager',
  };
  return labels[path] || 'your requested workspace';
}

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
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  const [goal, setGoal] = useState('all');
  const [currency, setCurrency] = useState('INR');
  const [marketFocus, setMarketFocus] = useState<'India' | 'US' | 'Global'>('India');
  const [incomeRange, setIncomeRange] = useState('');
  const [learningLevel, setLearningLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [personalInsights, setPersonalInsights] = useState(false);
  const [financialGoal, setFinancialGoal] = useState('');

  const returnTo = useMemo(() => {
    if (typeof window === 'undefined' || !auth.authOpen) return null;
    const fromUrl = new URLSearchParams(window.location.search).get('returnTo');
    const pending = window.sessionStorage.getItem(PENDING_RETURN_KEY);
    const value = fromUrl || pending;
    return value?.startsWith('/') ? value : null;
  }, [auth.authOpen]);
  const returnLabel = destinationLabel(returnTo);

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

  useEffect(() => {
    if (!auth.authOpen || !auth.configured) {
      setGoogleAvailable(false);
      return;
    }
    let active = true;
    setGoogleAvailable(null);
    void isSocialProviderEnabled('google').then((enabled) => {
      if (active) setGoogleAvailable(enabled);
    });
    return () => { active = false; };
  }, [auth.authOpen, auth.configured]);

  if (!auth.authOpen) return null;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const beginGoogle = () => {
    if (!googleAvailable) return;
    setError(null);
    try {
      auth.continueWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in could not be started.');
    }
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

  const resendVerification = () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your email on the sign-in screen first, then resend verification.');
      return;
    }
    setVerificationSent(false);
    void run(async () => {
      await resendSignupConfirmation(normalizedEmail);
      setVerificationSent(true);
    });
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

  const title = auth.authScreen === 'login' ? 'Welcome back'
    : auth.authScreen === 'signup' ? 'Create your private workspace'
      : auth.authScreen === 'forgot' ? 'Reset your password'
        : auth.authScreen === 'reset' ? 'Choose a new password'
          : auth.authScreen === 'onboarding' ? 'Personalize your workspace'
            : 'Check your email';

  const description = auth.authScreen === 'login'
    ? 'Sign in to continue to your private financial workspace and saved ArthaMind context.'
    : auth.authScreen === 'signup'
      ? 'Create an account for income, expenses, budgets, EMIs, reports and the preferences you choose to save.'
      : auth.authScreen === 'onboarding'
        ? 'These preferences personalize the interface. Optional values are never treated as verified financial facts.'
        : 'Authentication is handled by Supabase Auth. Artha Bench never stores your raw password.';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020817]/80 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="grid max-h-[95vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-surface shadow-[0_30px_90px_rgba(2,8,23,.45)] lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="relative hidden overflow-hidden bg-[#07111F] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-indigo-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <ArthaBenchLogo compact />
            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-teal-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Private by design
            </div>
            <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight">One account for your financial workspace.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">Public market, crypto, learning and AI-reliability tools stay separate. Your personal records are loaded only after authentication.</p>

            <div className="mt-8 space-y-3">
              <TrustRow icon={Fingerprint} title="Supabase authentication" text="Secure provider-managed identity and session handling." />
              <TrustRow icon={Database} title="User-scoped records" text="Database policies restrict personal rows to the authenticated user ID." />
              <TrustRow icon={Sparkles} title="AI context stays opt-in" text="Personal finance categories are not sent to ArthaMind unless you authorize them." />
            </div>
          </div>

          <div className="relative mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-[11px] leading-5 text-slate-300">
            <div className="flex items-center gap-2 font-black text-white"><LockKeyhole className="h-4 w-4 text-teal-300" /> Secure continuity</div>
            <p className="mt-2">{returnLabel ? `After sign-in, we’ll return you to ${returnLabel}.` : 'After sign-in, your authenticated workspace will be restored.'}</p>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-surface">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-5 py-4 backdrop-blur lg:justify-end">
            <div className="lg:hidden"><ArthaBenchLogo compact /></div>
            <button type="button" onClick={auth.closeAuth} className="rounded-xl border border-line bg-canvas p-2 text-secondary transition hover:border-interactive/30 hover:text-ink" aria-label="Close account dialog">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mx-auto max-w-2xl p-5 sm:p-8 lg:p-10">
            <div className="mb-7">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-interactive">Artha Bench Pro account</div>
              <h1 id="auth-title" className="mt-2 text-3xl font-black tracking-tight text-ink">{title}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-secondary">{description}</p>
              {returnLabel && auth.authScreen === 'login' && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-interactive/20 bg-interactive-soft px-3 py-1.5 text-[10px] font-bold text-interactive">
                  <ArrowRight className="h-3 w-3" /> Continue to {returnLabel} after sign-in
                </div>
              )}
            </div>

            {!auth.configured && auth.authScreen !== 'onboarding' && (
              <div className="mb-5 rounded-2xl border border-warning-fill/30 bg-warning-soft p-4 text-xs leading-5 text-warning">
                Account services are not configured on this deployment yet. Public Artha Bench features remain available while authentication is unavailable.
              </div>
            )}

            {(error || auth.authMessage) && (
              <div role="alert" className={`mb-5 rounded-2xl border px-4 py-3 text-xs leading-5 ${error ? 'border-danger/30 bg-danger-soft text-danger' : 'border-success-fill/30 bg-success-soft text-success'}`}>
                {error || auth.authMessage}
              </div>
            )}

            {auth.authScreen === 'login' && (
              <form onSubmit={submitLogin} className="space-y-4">
                <button type="button" disabled={!auth.configured || busy || googleAvailable !== true} onClick={beginGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-canvas px-4 py-3 text-sm font-black text-ink transition hover:border-interactive/40 hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-white text-xs font-black text-[#4285F4]">G</span>
                  {googleAvailable === null ? 'Checking Google sign-in…' : googleAvailable ? 'Continue with Google' : 'Google sign-in unavailable'}
                </button>
                {googleAvailable === false && <p className="-mt-1 text-center text-[10px] leading-4 text-secondary">Email sign-in is available now. This Google option enables automatically after Google is turned on in Supabase Auth.</p>}

                <div className="flex items-center gap-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-secondary">
                  <span className="h-px flex-1 bg-line" /> continue with email <span className="h-px flex-1 bg-line" />
                </div>

                <div>
                  <label className={labelClass} htmlFor="login-email">Email address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                    <input id="login-email" className={`${inputClass} pl-10`} type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="login-password">Password</label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
                    <input id="login-password" className={`${inputClass} pl-10 pr-11`} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-secondary hover:text-ink" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <label className="flex items-center gap-2 text-secondary"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me</label>
                  <button type="button" onClick={() => auth.openAuth('forgot')} className="font-bold text-interactive hover:underline">Forgot password?</button>
                </div>
                <button disabled={busy || !auth.configured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Sign in securely
                </button>
                <div className="rounded-2xl border border-line bg-canvas p-4 text-center text-xs text-secondary">
                  New to Artha Bench? <button type="button" onClick={() => auth.openAuth('signup')} className="font-black text-interactive hover:underline">Create an account</button>
                </div>
                <p className="text-center text-[10px] leading-5 text-secondary">Educational analysis only — not investment, tax, legal, or financial advice. Privacy and data controls remain available in Account.</p>
              </form>
            )}

            {auth.authScreen === 'signup' && (
              <form onSubmit={submitSignup} className="space-y-4">
                <button type="button" onClick={() => auth.openAuth('login')} className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</button>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={labelClass} htmlFor="signup-name">Full name</label><input id="signup-name" className={inputClass} autoComplete="name" placeholder="Your name" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                  <div><label className={labelClass}>Country / region</label><select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}><option>India</option><option>United States</option><option>United Kingdom</option><option>Other</option></select></div>
                </div>
                <div><label className={labelClass} htmlFor="signup-email">Email address</label><input id="signup-email" className={inputClass} type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={labelClass}>Password</label><input className={inputClass} type="password" autoComplete="new-password" placeholder="At least 8 characters" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                  <div><label className={labelClass}>Confirm password</label><input className={inputClass} type="password" autoComplete="new-password" placeholder="Repeat password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
                </div>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-xs leading-5 text-secondary"><input className="mt-0.5" type="checkbox" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} /><span>I agree to the <a href="/terms.html" className="font-bold text-interactive hover:underline">Terms</a> and <a href="/privacy.html" className="font-bold text-interactive hover:underline">Privacy Policy</a>.</span></label>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-xs leading-5 text-secondary"><input className="mt-0.5" type="checkbox" checked={financialConsent} onChange={(e) => setFinancialConsent(e.target.checked)} /><span>I allow ArthaMind to use financial data categories I explicitly authorize for personalized educational analysis. I can turn this off later.</span></label>
                <button disabled={busy || !auth.configured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-sm font-black text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Create secure account</button>
                <p className="text-center text-[10px] leading-5 text-secondary">Personal records remain empty until you add them. Artha Bench does not generate sample income, expenses, balances or EMIs for your account.</p>
              </form>
            )}

            {auth.authScreen === 'forgot' && (
              <form onSubmit={submitForgot} className="space-y-4">
                <button type="button" onClick={() => auth.openAuth('login')} className="inline-flex items-center gap-1 text-xs font-bold text-secondary"><ArrowLeft className="h-3.5 w-3.5" /> Back to sign in</button>
                <div><label className={labelClass}>Email address</label><input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <button disabled={busy || !auth.configured} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Send reset link</button>
              </form>
            )}

            {auth.authScreen === 'reset' && (
              <form onSubmit={submitReset} className="space-y-4">
                <div><label className={labelClass}>New password</label><input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <div><label className={labelClass}>Confirm new password</label><input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />} Update password</button>
              </form>
            )}

            {auth.authScreen === 'verify' && (
              <div className="space-y-5 rounded-2xl border border-line bg-canvas p-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
                <div>
                  <h3 className="text-lg font-black text-ink">Verify your email once</h3>
                  <p className="mt-2 text-sm leading-6 text-secondary">Your account is already created. Open the latest Artha Bench / Supabase confirmation email and click the verification link. After verification, the same email and password can sign in normally.</p>
                </div>
                {verificationSent && <div className="rounded-xl border border-success-fill/30 bg-success-soft px-4 py-3 text-xs font-bold text-success">A fresh verification email has been sent.</div>}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={busy || !email.trim()} onClick={resendVerification} className="rounded-xl border border-line-strong bg-surface px-5 py-3 text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Sending…' : 'Resend verification email'}</button>
                  <button type="button" onClick={() => auth.openAuth('login')} className="rounded-xl bg-brand px-5 py-3 text-sm font-black text-white">I verified it — sign in</button>
                </div>
                <p className="text-[10px] leading-5 text-secondary">If the email is not visible, check Spam or Promotions. Verification is required once so another person cannot create an account using your email address.</p>
              </div>
            )}

            {auth.authScreen === 'onboarding' && (
              <form onSubmit={submitOnboarding} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Full name</label><input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} /></div><div><label className={labelClass}>Country</label><input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} /></div></div>
                <div><label className={labelClass}>Primary goal</label><select className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)}><option value="learn">Learn finance</option><option value="manage">Manage personal finances</option><option value="markets">Follow markets</option><option value="evaluate">Test financial AI</option><option value="all">All of these</option></select></div>
                <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Preferred currency</label><select className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></div><div><label className={labelClass}>Market focus</label><select className={inputClass} value={marketFocus} onChange={(e) => setMarketFocus(e.target.value as typeof marketFocus)}><option>India</option><option>US</option><option>Global</option></select></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass}>Monthly income range (optional)</label><input className={inputClass} placeholder="e.g. ₹25k–₹50k" value={incomeRange} onChange={(e) => setIncomeRange(e.target.value)} /></div><div><label className={labelClass}>Learning level</label><select className={inputClass} value={learningLevel} onChange={(e) => setLearningLevel(e.target.value as typeof learningLevel)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div></div>
                <div><label className={labelClass}>Savings or financial goal (optional)</label><input className={inputClass} placeholder="Describe a goal without sensitive account details" value={financialGoal} onChange={(e) => setFinancialGoal(e.target.value)} /></div>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-xs text-secondary"><input className="mt-0.5" type="checkbox" checked={personalInsights} onChange={(e) => setPersonalInsights(e.target.checked)} /><span>Enable personalized ArthaMind insights using only the data sources I explicitly authorize.</span></label>
                <div className="flex flex-col gap-2 sm:flex-row"><button disabled={busy} className="flex-1 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-50">Save preferences</button><button type="button" onClick={auth.closeAuth} className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-secondary">Skip for now</button></div>
              </form>
            )}

            <div className="mt-7 flex items-start gap-2 border-t border-line pt-4 text-[10px] leading-5 text-secondary">
              <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              Supabase Auth manages authentication tokens. Artha Bench never stores raw passwords or service-role database credentials in browser code.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const TrustRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}> = ({ icon: Icon, title, text }) => (
  <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-300/10 text-teal-200"><Icon className="h-4 w-4" /></div>
    <div><div className="text-xs font-black text-white">{title}</div><div className="mt-1 text-[10px] leading-5 text-slate-400">{text}</div></div>
  </div>
);
