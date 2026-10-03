import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emailOtpRequired,
  sendEmailOtp,
  sessionAuthMethods,
  sessionIsEmailVerified,
  signOutLocal,
  signUpVerified,
  verifyEmailOtp,
} from '../src/services/supabaseRest';
import { isIgnoredKey, requestAppFullscreen } from '../src/components/system/ForceFullscreen';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.sig`;
}

function mockFetch(reply: unknown, status = 200) {
  const calls: Array<{ url: string; body: any }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(reply), { status });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('email one-time codes', () => {
  it('is off unless VITE_EMAIL_OTP is on', () => {
    vi.stubEnv('VITE_EMAIL_OTP', '');
    expect(emailOtpRequired()).toBe(false);
    vi.stubEnv('VITE_EMAIL_OTP', 'on');
    expect(emailOtpRequired()).toBe(true);
    vi.stubEnv('VITE_EMAIL_OTP', 'TRUE');
    expect(emailOtpRequired()).toBe(true);
    vi.stubEnv('VITE_EMAIL_OTP', 'off');
    expect(emailOtpRequired()).toBe(false);
  });

  it('reads how a session was created from the token', () => {
    const password = jwt({ amr: [{ method: 'password', timestamp: 1 }] });
    const otp = jwt({ amr: [{ method: 'otp', timestamp: 1 }] });
    const google = jwt({ amr: [{ method: 'oauth', timestamp: 1 }] });
    expect(sessionAuthMethods(password)).toEqual(['password']);
    expect(sessionIsEmailVerified(password)).toBe(false);
    expect(sessionIsEmailVerified(otp)).toBe(true);
    expect(sessionIsEmailVerified(google)).toBe(true);
    expect(sessionIsEmailVerified('not-a-token')).toBe(false);
    expect(sessionAuthMethods(jwt({}))).toEqual([]);
  });

  it('asks Supabase for a code without creating new users', async () => {
    const calls = mockFetch({});
    await sendEmailOtp('a@example.com');
    expect(calls[0].url).toMatch(/\/auth\/v1\/otp$/);
    expect(calls[0].body).toEqual({ email: 'a@example.com', create_user: false });
  });

  it('verifies a 6-digit code and returns the new session', async () => {
    const calls = mockFetch({ access_token: jwt({ amr: [{ method: 'otp' }] }), refresh_token: 'r', expires_in: 3600, user: { id: 'u1', email: 'a@example.com' } });
    const session = await verifyEmailOtp('a@example.com', ' 123 456 ', 'email');
    expect(calls[0].url).toMatch(/\/auth\/v1\/verify$/);
    expect(calls[0].body).toEqual({ type: 'email', email: 'a@example.com', token: '123456' });
    expect(session.user.id).toBe('u1');
    expect(sessionIsEmailVerified(session.access_token)).toBe(true);
  });

  it('rejects short codes before calling the server', async () => {
    const calls = mockFetch({});
    await expect(verifyEmailOtp('a@example.com', '12', 'email')).rejects.toThrow(/6 digits/);
    expect(calls).toHaveLength(0);
  });

  it('explains a wrong or expired code in plain words', async () => {
    mockFetch({ msg: 'Token has expired or is invalid' }, 403);
    await expect(verifyEmailOtp('a@example.com', '000000', 'signup')).rejects.toThrow(/wrong or has expired/);
  });

  it('explains the resend wait time', async () => {
    mockFetch({ msg: 'For security purposes, you can only request this after 42 seconds.' }, 429);
    await expect(sendEmailOtp('a@example.com')).rejects.toThrow(/wait 42 seconds/);
  });

  it('signs up through Supabase with profile data and no auto-confirm shortcut', async () => {
    const calls = mockFetch({ id: 'u2', email: 'b@example.com' });
    const result = await signUpVerified({ email: 'b@example.com', password: 'secret123', fullName: 'B', country: 'India', financialDataConsent: true });
    expect(calls[0].url).toMatch(/\/auth\/v1\/signup$/);
    expect(calls[0].body.data).toEqual({ full_name: 'B', country: 'India', personal_data_insights_enabled: true });
    expect(result.session).toBeNull();
  });

  it('ends only this session when dropping the password-only session', async () => {
    const calls = mockFetch({});
    await signOutLocal('tok');
    expect(calls[0].url).toMatch(/\/auth\/v1\/logout\?scope=local$/);
  });
});

describe('full screen', () => {
  it('never enters full screen on Esc, F11, Tab or shortcuts', () => {
    const key = (init: KeyboardEventInit) => ({ key: '', metaKey: false, ctrlKey: false, altKey: false, ...init }) as KeyboardEvent;
    expect(isIgnoredKey(key({ key: 'Escape' }))).toBe(true);
    expect(isIgnoredKey(key({ key: 'F11' }))).toBe(true);
    expect(isIgnoredKey(key({ key: 'Tab' }))).toBe(true);
    expect(isIgnoredKey(key({ key: 'c', ctrlKey: true }))).toBe(true);
    expect(isIgnoredKey(key({ key: 'a' }))).toBe(false);
    expect(isIgnoredKey(key({ key: 'Enter' }))).toBe(false);
  });

  it('requests full screen once, and not when already full screen or unsupported', () => {
    const requestFullscreen = vi.fn(() => Promise.reject(new Error('needs a gesture')));
    const doc = { fullscreenEnabled: true, fullscreenElement: null, documentElement: { requestFullscreen } } as unknown as Document;
    requestAppFullscreen(doc);
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });

    const already = { ...doc, fullscreenElement: {} } as unknown as Document;
    requestAppFullscreen(already);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    const unsupported = { fullscreenEnabled: false, fullscreenElement: null, documentElement: { requestFullscreen } } as unknown as Document;
    requestAppFullscreen(unsupported);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
