import { IdleWarning, LogoutNotice, rememberLogoutReason, type LogoutReason } from './SessionNotices';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuthSession,
  AuthUser,
  fetchCurrentUser,
  getProfile,
  isSupabaseConfigured,
  loadStoredSession,
  persistSession,
  refreshAuthSession,
  resendSignupConfirmation,
  sendPasswordReset,
  signInWithPassword,
  signOutRemote,
  signOutOtherSessions,
  checkSession,
  checkPassword,
  emailOtpRequired,
  EmailOtpType,
  sendEmailOtp,
  sessionIsEmailVerified,
  signOutLocal,
  signUpVerified,
  verifyEmailOtp,
  signUpWithPassword,
  SocialAuthProvider,
  startSocialOAuth,
  updatePassword,
  upsertProfile,
  UserProfile,
} from '../services/supabaseRest';
import {
  hydrateCloudWorkspace,
  isCloudWorkspaceActiveFor,
  restoreGuestWorkspace,
  syncCloudWorkspace,
  workspaceFingerprint,
} from '../services/cloudWorkspace';

export type AuthScreen = 'login' | 'signup' | 'verify' | 'otp' | 'forgot' | 'reset' | 'onboarding';

/** Minutes of inactivity before automatic sign-out (VITE_IDLE_LOGOUT_MINUTES, default 15, 1–240). */
export const IDLE_LOGOUT_MINUTES = clampEnv(import.meta.env.VITE_IDLE_LOGOUT_MINUTES, 15, 1, 240);
/** Hours after sign-in when the session ends even if the user is active (VITE_MAX_SESSION_HOURS, default 12, 1–720). */
export const MAX_SESSION_HOURS = clampEnv(import.meta.env.VITE_MAX_SESSION_HOURS, 12, 1, 720);
const SIGNED_IN_AT_KEY = 'arthamind-signed-in-at';

function clampEnv(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, n)) : fallback;
}

function markSignedIn(): void {
  try { localStorage.setItem(SIGNED_IN_AT_KEY, String(Date.now())); } catch { /* storage blocked */ }
}

interface PendingOtp { email: string; remember: boolean; type: EmailOtpType }

interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  syncing: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  profile: UserProfile | null;
  authOpen: boolean;
  authScreen: AuthScreen;
  authMessage: string | null;
  /** True when every sign-in and new account must confirm a 6-digit email code. */
  emailOtp: boolean;
  /** Email address the current code was sent to (on the 'otp' screen). */
  otpEmail: string | null;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  openAuth: (screen?: AuthScreen) => void;
  closeAuth: () => void;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (input: { fullName: string; email: string; password: string; country: string; financialDataConsent: boolean }) => Promise<void>;
  continueWithSocial: (provider: SocialAuthProvider) => void;
  continueWithGoogle: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (changes: Partial<UserProfile>) => Promise<void>;
  syncNow: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function defaultProfile(user: AuthUser): UserProfile {
  const metadata = user.user_metadata ?? {};
  const marketFocus = metadata.market_focus === 'US' || metadata.market_focus === 'Global' ? metadata.market_focus : 'India';
  const learningLevel = metadata.learning_level === 'intermediate' || metadata.learning_level === 'advanced' ? metadata.learning_level : 'beginner';
  return {
    user_id: user.id,
    full_name: typeof metadata.full_name === 'string' ? metadata.full_name : '',
    country: typeof metadata.country === 'string' ? metadata.country : 'India',
    currency: typeof metadata.currency === 'string' ? metadata.currency : 'INR',
    market_focus: marketFocus,
    learning_level: learningLevel,
    primary_goal: typeof metadata.primary_goal === 'string' ? metadata.primary_goal : 'all',
    monthly_income_range: null,
    financial_goal: null,
    personal_data_insights_enabled: metadata.personal_data_insights_enabled === true,
    onboarding_completed: false,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  };
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [syncing, setSyncing] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const fingerprintRef = useRef('');
  const emailOtp = emailOtpRequired();
  const [pendingOtp, setPendingOtp] = useState<PendingOtp | null>(null);

  const establishSession = useCallback(async (nextSession: AuthSession, remember: boolean, suppressOnboarding = false) => {
    persistSession(nextSession, remember);
    // Workspace hydration and the profile lookup are independent: run them together.
    const [, fetchedProfile] = await Promise.all([
      isCloudWorkspaceActiveFor(nextSession.user.id) ? Promise.resolve() : hydrateCloudWorkspace(nextSession.access_token, nextSession.user.id),
      getProfile(nextSession.access_token),
    ]);
    let nextProfile = fetchedProfile;
    if (!nextProfile) nextProfile = await upsertProfile(nextSession.access_token, defaultProfile(nextSession.user));
    setSession(nextSession);
    setProfile(nextProfile);
    fingerprintRef.current = workspaceFingerprint();
    if (!suppressOnboarding && !nextProfile.onboarding_completed) {
      setAuthScreen('onboarding');
      setAuthOpen(true);
    }
    return nextProfile;
  }, []);

  useEffect(() => {
    if (!configured) { setLoading(false); return; }
    let cancelled = false;
    const bootstrap = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams(window.location.search);
        const isResetFlow = query.get('auth') === 'reset';
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (accessToken && refreshToken) {
          const user = await fetchCurrentUser(accessToken);
          const nextSession: AuthSession = {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: hash.get('token_type') || 'bearer',
            expires_at: Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600),
            user,
          };
          window.history.replaceState({}, document.title, window.location.pathname);
          if (!cancelled) {
            markSignedIn();
            if (!isResetFlow) void signOutOtherSessions(nextSession.access_token);
            await establishSession(nextSession, true, isResetFlow);
            if (isResetFlow) { setAuthScreen('reset'); setAuthOpen(true); }
          }
          return;
        }

        const stored = loadStoredSession();
        if (!stored.session) return;
        let activeSession = stored.session;
        if (activeSession.expires_at <= Math.floor(Date.now() / 1000) + 60) {
          activeSession = await refreshAuthSession(activeSession.refresh_token);
        } else {
          // Validate the stored token while the workspace and profile load, instead of before them.
          const verified = fetchCurrentUser(activeSession.access_token);
          verified.catch(() => undefined);
          if (emailOtpRequired() && !sessionIsEmailVerified(activeSession.access_token)) {
            activeSession = { ...activeSession, user: await verified };
          } else {
            const [user] = await Promise.all([verified, establishSession(activeSession, stored.remember, isResetFlow)]);
            if (cancelled) return;
            setSession((current) => (current ? { ...current, user } : current));
            persistSession({ ...activeSession, user }, stored.remember);
            if (isResetFlow) { setAuthScreen('reset'); setAuthOpen(true); }
            try { if (!localStorage.getItem(SIGNED_IN_AT_KEY)) markSignedIn(); } catch { /* storage blocked */ }
            return;
          }
        }
        if (emailOtpRequired() && !sessionIsEmailVerified(activeSession.access_token)) {
          // A password-only session from before email codes were switched on: sign in again with a code.
          await signOutLocal(activeSession.access_token);
          persistSession(null);
          restoreGuestWorkspace();
          if (!cancelled) {
            setAuthMessage('For your security, sign in again and confirm the code we email you.');
            setAuthScreen('login');
            setAuthOpen(true);
          }
          return;
        }
        try { if (!localStorage.getItem(SIGNED_IN_AT_KEY)) markSignedIn(); } catch { /* storage blocked */ }
        if (!cancelled) await establishSession(activeSession, stored.remember, isResetFlow);
        if (!cancelled && isResetFlow) { setAuthScreen('reset'); setAuthOpen(true); }
      } catch (error) {
        console.warn('Authentication bootstrap failed:', error);
        persistSession(null);
        restoreGuestWorkspace();
        if (!cancelled) { setSession(null); setProfile(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void bootstrap();
    return () => { cancelled = true; };
  }, [configured, establishSession]);

  const syncNow = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      await syncCloudWorkspace(session.access_token, session.user.id);
      fingerprintRef.current = workspaceFingerprint();
    } finally { setSyncing(false); }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => {
      if (workspaceFingerprint() !== fingerprintRef.current) void syncNow();
    }, 7000);
    const onVisibility = () => { if (document.visibilityState === 'hidden') void syncNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisibility); };
  }, [session, syncNow]);

  const openAuth = (screen: AuthScreen = 'login') => {
    setAuthMessage(null);
    setAuthScreen(screen);
    setAuthOpen(true);
  };
  const closeAuth = () => { setAuthOpen(false); setAuthMessage(null); };

  const signIn = async (email: string, password: string, remember: boolean) => {
    if (!configured) throw new Error('Account sign-in is not configured on this deployment yet.');
    const normalizedEmail = email.trim();
    if (emailOtp) {
      await startCodeSignIn(normalizedEmail, password, remember);
      return;
    }
    try {
      const next = await signInWithPassword(normalizedEmail, password);
      markSignedIn();
      // One device per account: signing in here ends the account's sessions on other devices.
      void signOutOtherSessions(next.access_token);
      const nextProfile = await establishSession(next, remember);
      if (nextProfile.onboarding_completed) setAuthOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      if (/email not confirmed/i.test(message)) {
        try {
          await resendSignupConfirmation(normalizedEmail);
          setAuthMessage('Your account exists, but the email address is not verified yet. We sent a fresh confirmation link. Open that email once, then return here to sign in.');
        } catch {
          setAuthMessage('Your account exists, but the email address is not verified yet. Open the most recent Supabase confirmation email, verify the address, then return here to sign in.');
        }
        setAuthScreen('verify');
        setAuthOpen(true);
        return;
      }
      throw error;
    }
  };

  /** Step 1 of a code sign-in: check the password, drop that password-only session, email a code. */
  const startCodeSignIn = async (normalizedEmail: string, password: string, remember: boolean) => {
    try {
      const passwordSession = await checkPassword(normalizedEmail, password);
      await signOutLocal(passwordSession.access_token);
      await sendEmailOtp(normalizedEmail);
      askForCode({ email: normalizedEmail, remember, type: 'email' }, `We sent a 6-digit code to ${normalizedEmail}. Enter it below to finish signing in.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!/email not confirmed/i.test(message)) throw error;
      await resendSignupConfirmation(normalizedEmail);
      askForCode({ email: normalizedEmail, remember, type: 'signup' }, `Your email is not verified yet. We sent a 6-digit code to ${normalizedEmail}.`);
    }
  };

  const askForCode = (next: PendingOtp, message: string) => {
    setPendingOtp(next);
    setAuthMessage(message);
    setAuthScreen('otp');
    setAuthOpen(true);
  };

  const verifyOtp = async (code: string) => {
    if (!pendingOtp) throw new Error('Start again: sign in with your email and password first.');
    const next = await verifyEmailOtp(pendingOtp.email, code, pendingOtp.type);
    setPendingOtp(null);
    setAuthMessage(null);
    markSignedIn();
    void signOutOtherSessions(next.access_token);
    const nextProfile = await establishSession(next, pendingOtp.remember);
    if (nextProfile.onboarding_completed) setAuthOpen(false);
  };

  const resendOtp = async () => {
    if (!pendingOtp) throw new Error('Start again: sign in with your email and password first.');
    if (pendingOtp.type === 'signup') await resendSignupConfirmation(pendingOtp.email);
    else await sendEmailOtp(pendingOtp.email);
    setAuthMessage(`A new code was sent to ${pendingOtp.email}. Only the latest code works.`);
  };

  const signUp = async (input: { fullName: string; email: string; password: string; country: string; financialDataConsent: boolean }) => {
    if (!configured) throw new Error('Account sign-up is not configured on this deployment yet.');
    if (emailOtp) {
      const normalizedEmail = input.email.trim();
      const created = await signUpVerified({ ...input, email: normalizedEmail });
      if (created.session) {
        // The project auto-confirms emails, so prove ownership with a sign-in code before the account is used.
        await signOutLocal(created.session.access_token);
        await sendEmailOtp(normalizedEmail);
        askForCode({ email: normalizedEmail, remember: true, type: 'email' }, `Account created. Enter the 6-digit code we sent to ${normalizedEmail} to verify your email.`);
      } else {
        askForCode({ email: normalizedEmail, remember: true, type: 'signup' }, `Enter the 6-digit code we sent to ${normalizedEmail} to verify your email. If this email already has an account, sign in instead.`);
      }
      return;
    }
    const result = await signUpWithPassword({ email: input.email.trim(), password: input.password, fullName: input.fullName, country: input.country, financialDataConsent: input.financialDataConsent });
    if (result.session) { markSignedIn(); void signOutOtherSessions(result.session.access_token); await establishSession(result.session, true); return; }
    setAuthMessage('Account created. Check your email and verify it once, then return here to sign in.');
    setAuthScreen('verify');
    setAuthOpen(true);
  };

  const continueWithSocial = (provider: SocialAuthProvider) => {
    if (!configured) throw new Error('Social sign-in is not configured on this deployment yet.');
    startSocialOAuth(provider);
  };

  const forgotPassword = async (email: string) => {
    if (!configured) throw new Error('Password reset is not configured on this deployment yet.');
    await sendPasswordReset(email.trim());
    setAuthMessage('Password reset instructions have been sent if that email belongs to an account.');
    setAuthScreen('verify');
  };

  const resetPassword = async (password: string) => {
    if (!session) throw new Error('Open the password reset link from your email before setting a new password.');
    await updatePassword(session.access_token, password);
    setAuthMessage('Password updated successfully.');
    setAuthScreen('login');
  };

  const endSession = async (reason?: LogoutReason) => {
    if (session && reason !== 'other-device') {
      await syncNow().catch(() => undefined);
      await signOutRemote(session.access_token).catch(() => undefined);
    }
    if (reason) rememberLogoutReason(reason);
    try { localStorage.removeItem(SIGNED_IN_AT_KEY); } catch { /* storage blocked */ }
    persistSession(null);
    restoreGuestWorkspace();
    setSession(null);
    setProfile(null);
    setAuthOpen(false);
    window.location.reload();
  };
  const signOut = () => endSession();

  // Keep this device's session honest: refresh it before expiry and sign out here if the account
  // signed in on another device (the server ended this session).
  useEffect(() => {
    if (!session) return;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const result = await checkSession(session);
      if (stopped) return;
      if (result.state === 'revoked') { void endSession('other-device'); return; }
      if (result.state === 'valid' && result.session.access_token !== session.access_token) {
        persistSession(result.session, loadStoredSession().remember);
        setSession(result.session);
      }
    };
    const id = window.setInterval(() => void check(), 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto sign-out after IDLE_LOGOUT_MINUTES without activity in any tab (one-minute warning first), and
  // MAX_SESSION_HOURS after sign-in even when active.
  const [idleDeadline, setIdleDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (!session) { setIdleDeadline(null); return; }
    const IDLE = IDLE_LOGOUT_MINUTES * 60_000, WARN = Math.min(60_000, IDLE / 2), KEY = 'arthamind-last-activity';
    const MAX = MAX_SESSION_HOURS * 3_600_000;
    let lastWrite = 0;
    const bump = () => { const now = Date.now(); if (now - lastWrite > 5000) { lastWrite = now; try { localStorage.setItem(KEY, String(now)); } catch { /* ignore */ } } };
    bump();
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const id = window.setInterval(() => {
      let last = Date.now();
      try { last = Number(localStorage.getItem(KEY)) || last; } catch { /* ignore */ }
      const idle = Date.now() - last;
      let signedInAt = 0;
      try { signedInAt = Number(localStorage.getItem(SIGNED_IN_AT_KEY)) || 0; } catch { /* ignore */ }
      if (signedInAt && Date.now() - signedInAt >= MAX) { window.clearInterval(id); void endSession('expired'); return; }
      if (idle >= IDLE) { window.clearInterval(id); void endSession('idle'); }
      else if (idle >= IDLE - WARN) setIdleDeadline((d) => d ?? last + IDLE);
      else setIdleDeadline(null);
    }, 2000);
    return () => { window.clearInterval(id); events.forEach((e) => window.removeEventListener(e, bump)); };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  const stayActive = () => { try { localStorage.setItem('arthamind-last-activity', String(Date.now())); } catch { /* ignore */ } setIdleDeadline(null); };


  const refreshProfile = async () => { if (session) setProfile(await getProfile(session.access_token)); };
  const saveProfile = async (changes: Partial<UserProfile>) => {
    if (!session) throw new Error('Sign in to save profile preferences.');
    const saved = await upsertProfile(session.access_token, { ...(profile ?? defaultProfile(session.user)), ...changes, user_id: session.user.id });
    setProfile(saved);
  };

  const value = useMemo<AuthContextValue>(() => ({
    configured, loading, syncing, session, user: session?.user ?? null, profile,
    authOpen, authScreen, authMessage, emailOtp, otpEmail: pendingOtp?.email ?? null, verifyOtp, resendOtp, openAuth, closeAuth, signIn, signUp,
    continueWithSocial,
    continueWithGoogle: () => continueWithSocial('google'),
    forgotPassword, resetPassword, signOut, saveProfile, syncNow, refreshProfile,
  }), [configured, loading, syncing, session, profile, authOpen, authScreen, authMessage, syncNow, pendingOtp]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={value}>{children}<LogoutNotice idleMinutes={IDLE_LOGOUT_MINUTES} maxHours={MAX_SESSION_HOURS}/>{idleDeadline && <IdleWarning deadline={idleDeadline} onStay={stayActive} onSignOut={() => void endSession()}/>}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
