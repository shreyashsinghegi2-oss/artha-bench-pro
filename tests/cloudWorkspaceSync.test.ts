import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.fn(async (..._args: unknown[]) => undefined);
const fetchRows = vi.fn(async () => []);
vi.mock('../src/services/supabaseRest', () => ({
  upsertWorkspaceRows: (...args: unknown[]) => upsert(...(args as [])),
  fetchWorkspaceRows: (...args: unknown[]) => fetchRows(...(args as [])),
}));

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, String(v)); },
    removeItem: (k: string) => { data.delete(k); },
    key: () => null,
    get length() { return data.size; },
  };
}

const load = async () => import('../src/services/cloudWorkspace');

beforeEach(() => {
  vi.resetModules();
  upsert.mockClear();
  fetchRows.mockClear();
  const storage = memoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
});

describe('what goes to the account', () => {
  it('includes the financial records and personal details', async () => {
    const { CLOUD_SYNC_KEYS } = await load();
    const keys = CLOUD_SYNC_KEYS as readonly string[];
    for (const k of [
      'arthamind.moneyProfile.v1', 'arthamind.onboarding.v2', 'arthamind.profilePhoto.v1', 'arthamind-portfolio-v1',
      'artha_income_sources_v1', 'artha_expenses_v1', 'artha_budgets_v1', 'artha_emi_records_v1',
      'arthabench_emi_documents_v1', 'arthabench_emi_reminders_v1', 'arthabench_artha_pilot_saved_plans_v1',
      'arthamind-plan-retirement-v1', 'arthamind-plan-education-v1', 'arthamind-plan-jobswitch-v1',
    ]) expect(keys).toContain(k);
  });

  it('never includes the sign-in session or the pre-sign-up pending check', async () => {
    const { CLOUD_SYNC_KEYS } = await load();
    const keys = CLOUD_SYNC_KEYS as readonly string[];
    expect(keys.some((k) => k.includes('supabase_session'))).toBe(false);
    expect(keys).not.toContain('arthamind.pendingMoneyCheck.v1');
  });
});

describe('saving to the account', () => {
  it('does not push anything until this account has been loaded on this browser', async () => {
    const { syncCloudWorkspace } = await load();
    localStorage.setItem('arthamind.moneyProfile.v1', '{"age":34}');
    await syncCloudWorkspace('token', 'user-1');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('pushes the saved records once the account is loaded', async () => {
    const { syncCloudWorkspace, isCloudWorkspaceActiveFor, hydrateCloudWorkspace } = await load();
    await hydrateCloudWorkspace('token', 'user-1');
    expect(isCloudWorkspaceActiveFor('user-1')).toBe(true);
    localStorage.setItem('arthamind.moneyProfile.v1', '{"age":34}');
    await syncCloudWorkspace('token', 'user-1');
    expect(upsert).toHaveBeenCalledTimes(1);
    const rows = upsert.mock.calls[0][2] as Array<{ storage_key: string; payload: string | null }>;
    expect(rows.find((r) => r.storage_key === 'arthamind.moneyProfile.v1')?.payload).toBe('{"age":34}');
  });

  it('restores the saved records on a new device', async () => {
    const { hydrateCloudWorkspace } = await load();
    fetchRows.mockResolvedValueOnce([{ storage_key: 'arthamind.moneyProfile.v1', payload: '{"age":40}' } as never]);
    await hydrateCloudWorkspace('token', 'user-2');
    expect(localStorage.getItem('arthamind.moneyProfile.v1')).toBe('{"age":40}');
  });
});
