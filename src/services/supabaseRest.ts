export interface AuthIdentity {
  id?: string;
  provider: string;
  created_at?: string;
  last_sign_in_at?: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string | null;
  identities?: AuthIdentity[];
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: number;
  user: AuthUser;
}

export interface UserProfile {
  user_id: string;
  full_name: string;
  country: string;
  currency: string;
  market_focus: 'India' | 'US' | 'Global';
  learning_level: 'beginner' | 'intermediate' | 'advanced';
  primary_goal: string;
  monthly_income_range: string | null;
  financial_goal: string | null;
  personal_data_insights_enabled: boolean;
  onboarding_completed: boolean;
  timezone: string;
  created_at?: string;
  updated_at?: string;
}

export type SocialAuthProvider = 'google' | 'github' | 'azure' | 'apple';

const LOCAL_SESSION_KEY = 'arthabench_supabase_session_v1';
const SESSION_SESSION_KEY = 'arthabench_supabase_session_session_v1';
const DEFAULT_SUPABASE_URL = 'https://agjbvoosukxfvrritgto.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';

function config() {
  const url = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_SUPABASE_URL).replace(/\/$/, '');
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey, enabled: Boolean(url && anonKey) };
}

function browserRedirect(kind: 'callback' | 'reset' = 'callback'): string | null {
  if (typeof window === 'undefined') return null;
  return `${window.location.origin}/?auth=${kind}`;
}

export function isSupabaseConfigured(): boolean {
  return config().enabled;
}

function authHeaders(token?: string): HeadersInit {
  const { anonKey } = config();
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    'Content-Type': 'application/json',
  };
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function normalizeSession(payload: any): AuthSession | null {
  if (!payload?.access_token || !payload?.refresh_token || !payload?.user?.id) return null;
  const expiresAt = Number(payload.expires_at) || Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600);
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    token_type: payload.token_type || 'bearer',
    expires_at: expiresAt,
    user: payload.user,
  };
}

export function persistSession(session: AuthSession | null, remember = true): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_SESSION_KEY);
  sessionStorage.removeItem(SESSION_SESSION_KEY);
  if (!session) return;
  const target = remember ? localStorage : sessionStorage;
  target.setItem(remember ? LOCAL_SESSION_KEY : SESSION_SESSION_KEY, JSON.stringify(session));
}

export function loadStoredSession(): { session: AuthSession | null; remember: boolean } {
  if (typeof window === 'undefined') return { session: null, remember: true };
  for (const [storage, key, remember] of [
    [localStorage, LOCAL_SESSION_KEY, true],
    [sessionStorage, SESSION_SESSION_KEY, false],
  ] as const) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      return { session: JSON.parse(raw) as AuthSession, remember };
    } catch {
      storage.removeItem(key);
    }
  }
  return { session: null, remember: true };
}

export function getStoredAccessToken(): string | null {
  return loadStoredSession().session?.access_token ?? null;
}

export function parseOAuthSessionFromLocation(): AuthSession | null {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  const expiresIn = Number(params.get('expires_in') || 3600);
  const tokenType = params.get('token_type') || 'bearer';
  const rawUser = params.get('user');
  let user: AuthUser | null = null;
  try { user = rawUser ? JSON.parse(decodeURIComponent(rawUser)) : null; } catch { user = null; }
  if (!user?.id) return null;
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user,
  };
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const { url } = config();
  return requestJSON<AuthUser>(`${url}/auth/v1/user`, { headers: authHeaders(token) });
}

export async function refreshAuthSession(refreshToken: string): Promise<AuthSession> {
  const { url } = config();
  const payload = await requestJSON<any>(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const session = normalizeSession(payload);
  if (!session) throw new Error('Unable to refresh your session. Please sign in again.');
  return session;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const { url } = config();
  const payload = await requestJSON<any>(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const session = normalizeSession(payload);
  if (!session) throw new Error('Sign-in succeeded but no session was returned.');
  return session;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
  country: string;
  financialDataConsent: boolean;
}): Promise<{ session: AuthSession | null; user: AuthUser | null }> {
  const { url } = config();
  const redirectTo = browserRedirect('callback');
  const endpoint = redirectTo ? `${url}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}` : `${url}/auth/v1/signup`;
  const payload = await requestJSON<any>(endpoint, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      data: {
        full_name: input.fullName,
        country: input.country,
        personal_data_insights_enabled: input.financialDataConsent,
      },
    }),
  });
  return { session: normalizeSession(payload), user: payload?.user ?? null };
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  const { url } = config();
  const redirectTo = browserRedirect('callback');
  const endpoint = redirectTo ? `${url}/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo)}` : `${url}/auth/v1/resend`;
  await requestJSON(endpoint, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type: 'signup', email }),
  });
}

export async function isSocialProviderEnabled(provider: SocialAuthProvider): Promise<boolean> {
  const { url } = config();
  try {
    const settings = await requestJSON<any>(`${url}/auth/v1/settings`, { headers: authHeaders() });
    const value = settings?.external?.[provider];
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object') return value.enabled !== false;
    return false;
  } catch {
    return false;
  }
}

export function startSocialOAuth(provider: SocialAuthProvider): void {
  const { url } = config();
  const redirectTo = browserRedirect('callback') || `${window.location.origin}/?auth=callback`;
  const query = new URLSearchParams({ provider, redirect_to: redirectTo });
  if (provider === 'azure') query.set('scopes', 'email openid profile');
  window.location.assign(`${url}/auth/v1/authorize?${query.toString()}`);
}

export function startGoogleOAuth(): void {
  startSocialOAuth('google');
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { url } = config();
  const redirectTo = browserRedirect('reset');
  await requestJSON(`${url}/auth/v1/recover`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, redirect_to: redirectTo || undefined }),
  });
}

export async function updatePassword(token: string, password: string): Promise<void> {
  const { url } = config();
  await requestJSON(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
}

export async function signOutRemote(token: string): Promise<void> {
  const { url } = config();
  await fetch(`${url}/auth/v1/logout`, { method: 'POST', headers: authHeaders(token) }).catch(() => undefined);
}

async function rest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const { url } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      Prefer: 'return=representation',
      ...init?.headers,
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || payload?.hint || `Database request failed (${response.status})`);
  return payload as T;
}

export async function getProfile(token: string): Promise<UserProfile | null> {
  const rows = await rest<UserProfile[]>('profiles?select=*&limit=1', token);
  return rows[0] ?? null;
}

export async function upsertProfile(token: string, profile: Partial<UserProfile> & { user_id: string }): Promise<UserProfile> {
  const rows = await rest<UserProfile[]>('profiles?on_conflict=user_id', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(profile),
  });
  if (!rows[0]) throw new Error('Profile could not be saved.');
  return rows[0];
}

export interface WorkspaceRow { storage_key: string; payload: string | null; updated_at?: string; }

export async function fetchWorkspaceRows(token: string): Promise<WorkspaceRow[]> {
  return rest<WorkspaceRow[]>('user_workspace_state?select=storage_key,payload,updated_at', token);
}

export async function upsertWorkspaceRows(token: string, userId: string, rows: WorkspaceRow[]): Promise<void> {
  if (!rows.length) return;
  await rest('user_workspace_state?on_conflict=user_id,storage_key', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows.map((row) => ({ user_id: userId, storage_key: row.storage_key, payload: row.payload }))),
  });
}

export async function deleteWorkspaceKeys(token: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const encoded = keys.map((key) => `"${key.replaceAll('"', '')}"`).join(',');
  await rest(`user_workspace_state?storage_key=in.(${encodeURIComponent(encoded)})`, token, { method: 'DELETE' });
}

export async function createAiConversation(token: string, userId: string, title: string): Promise<string> {
  const rows = await rest<Array<{ id: string }>>('ai_conversations', token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, title: title.slice(0, 120) || 'ArthaMind conversation' }),
  });
  if (!rows[0]?.id) throw new Error('Conversation could not be saved.');
  return rows[0].id;
}

export async function saveAiMessage(token: string, userId: string, conversationId: string, role: 'user' | 'assistant', content: string, contextReference?: string): Promise<void> {
  await rest('ai_messages', token, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, conversation_id: conversationId, role, content, context_reference: contextReference ?? null }),
  });
}

export async function deleteAiConversation(token: string, conversationId: string): Promise<void> {
  await rest(`ai_conversations?id=eq.${encodeURIComponent(conversationId)}`, token, { method: 'DELETE' });
}

export async function deleteAllAiHistory(token: string): Promise<void> {
  await rest('ai_conversations?id=not.is.null', token, { method: 'DELETE' });
}

export async function exportCloudData(token: string): Promise<Record<string, unknown>> {
  const [profile, workspace, conversations] = await Promise.all([
    getProfile(token),
    fetchWorkspaceRows(token),
    rest<any[]>('ai_conversations?select=id,title,created_at,updated_at&order=created_at.desc', token),
  ]);
  return { exported_at: new Date().toISOString(), profile, workspace, ai_conversations: conversations };
}

export async function deleteFinancialCloudData(token: string): Promise<void> {
  const tables = ['budget_categories', 'budgets', 'expenses', 'incomes', 'savings_goals'];
  for (const table of tables) {
    await rest(`${table}?id=not.is.null`, token, { method: 'DELETE' }).catch(() => undefined);
  }
}

export async function requestAccountDeletion(token: string): Promise<void> {
  const response = await fetch('/api/account/delete', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Account deletion failed.');
}
