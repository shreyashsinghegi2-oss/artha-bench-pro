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
  sendPasswordReset,
  signInWithPassword,
  signOutRemote,
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

export type AuthScreen = 'login' | 'signup' | 'verify' | 'forgot' | 'reset' | 'onboarding';

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

  const establishSession = useCallback(async (nextSession: AuthSession, remember: boolean, suppressOnboarding = false) => {
    persistSession(nextSession, remember);
    if (!isCloudWorkspaceActiveFor(nextSession.user.id)) {
      await hydrateCloudWorkspace(nextSession.access_token, nextSession.user.id);
    }
    let nextProfile = await getProfile(nextSession.access_token);
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
          activeSession = { ...activeSession, user: await fetchCurrentUser(activeSession.access_token) };
        }
        if (!cancelled) await establishSession(activeSession, stored.remember, isResetFlow);
        if (!cancelled && isResetFlow) { setAuthScreen('reset'); setAuthOpen(true); }
      } catch (error) {
        console.warn('Authentication bootstrap failed:', error);
        persistSession(null);
        restoreGuestWorkspace();
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
    const next = await signInWithPassword(email.trim(), password);
    const nextProfile = await establishSession(next, remember);
    if (nextProfile.onboarding_completed) setAuthOpen(false);
  };

  const signUp = async (input: { fullName: string; email: string; password: string; country: string; financialDataConsent: boolean }) => {
    if (!configured) throw new Error('Account sign-up is not configured on this deployment yet.');
    const result = await signUpWithPassword({ email: input.email.trim(), password: input.password, fullName: input.fullName, country: input.country, financialDataConsent: input.financialDataConsent });
    if (result.session) { await establishSession(result.session, true); return; }
    setAuthMessage('Check your email to verify your account, then return here to sign in.');
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

  const signOut = async () => {
    if (session) {
      await syncNow().catch(() => undefined);
      await signOutRemote(session.access_token).catch(() => undefined);
    }
    persistSession(null);
    restoreGuestWorkspace();
    setSession(null);
    setProfile(null);
    setAuthOpen(false);
    window.location.reload();
  };

  const refreshProfile = async () => { if (session) setProfile(await getProfile(session.access_token)); };
  const saveProfile = async (changes: Partial<UserProfile>) => {
    if (!session) throw new Error('Sign in to save profile preferences.');
    const saved = await upsertProfile(session.access_token, { ...(profile ?? defaultProfile(session.user)), ...changes, user_id: session.user.id });
    setProfile(saved);
  };

  const value = useMemo<AuthContextValue>(() => ({
    configured, loading, syncing, session, user: session?.user ?? null, profile,
    authOpen, authScreen, authMessage, openAuth, closeAuth, signIn, signUp,
    continueWithSocial,
    continueWithGoogle: () => continueWithSocial('google'),
    forgotPassword, resetPassword, signOut, saveProfile, syncNow, refreshProfile,
  }), [configured, loading, syncing, session, profile, authOpen, authScreen, authMessage, syncNow]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
