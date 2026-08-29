import { fetchWorkspaceRows, upsertWorkspaceRows } from './supabaseRest';

export const CLOUD_SYNC_KEYS = [
  'artha_income_sources_v1',
  'artha_expenses_v1',
  'artha_budgets_v1',
  'artha_emi_records_v1',
  'artha_emi_planning_v2',
  'artha_india_tax_workspace_v1',
  'artha_learning_progress_v1',
  'artha_learning_notes_v1',
  'artha_learning_bookmarks_v1',
  'artha_learning_quiz_history_v1',
  'artha_market_watchlist_v1',
  'artha_paper_portfolio_v1',
  'artha_report_history_v1',
  'artha_saved_tutor_v1',
  'arthabench_reports',
  'arthabench_tutor_chats',
  'arthabench_finance_assistant_history_v1',
  'arthabench_ai_context_usage_v1',
  'arthabench_feedback_v1',
  'artha-bench-theme',
  'arthabench_ai_context_v1',
  'arthabench_notifications_v1',
  'arthabench_dashboard_preferences_v1',
] as const;

const LEGACY_GUEST_BACKUP_KEY = 'arthabench_guest_workspace_backup_v1';
const ACTIVE_USER_KEY = 'arthabench_active_cloud_user_v1';
const DEVICE_UI_KEYS = new Set<string>(['artha-bench-theme']);

function browserReady() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function captureManagedWorkspace(): Record<string, string | null> {
  if (!browserReady()) return {};
  return Object.fromEntries(CLOUD_SYNC_KEYS.map((key) => [key, localStorage.getItem(key)]));
}

export function workspaceFingerprint(): string {
  return JSON.stringify(captureManagedWorkspace());
}

function applyWorkspace(values: Record<string, string | null>): void {
  for (const key of CLOUD_SYNC_KEYS) {
    const value = values[key];
    if (value == null) {
      if (!DEVICE_UI_KEYS.has(key)) localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  }
}

/**
 * Clears account-owned workspace data from this browser while preserving only
 * device-level UI preferences such as the selected theme.
 */
export function clearAuthenticatedWorkspace(): void {
  if (!browserReady()) return;
  for (const key of CLOUD_SYNC_KEYS) {
    if (!DEVICE_UI_KEYS.has(key)) localStorage.removeItem(key);
  }
  localStorage.removeItem(ACTIVE_USER_KEY);
  // Remove backups created by older demo/guest-workspace builds so private
  // records cannot reappear after logout under a different account.
  localStorage.removeItem(LEGACY_GUEST_BACKUP_KEY);
}

/** @deprecated Kept for compatibility with older callers. */
export function clearManagedWorkspace(): void {
  clearAuthenticatedWorkspace();
}

/** @deprecated Guest personal workspaces are no longer restored. */
export function preserveGuestWorkspace(): void {
  if (!browserReady()) return;
  localStorage.removeItem(LEGACY_GUEST_BACKUP_KEY);
}

/** @deprecated Guest personal workspaces are no longer restored. */
export function restoreGuestWorkspace(): void {
  clearAuthenticatedWorkspace();
}

export async function hydrateCloudWorkspace(token: string, userId: string): Promise<void> {
  if (!browserReady()) return;
  clearAuthenticatedWorkspace();
  const rows = await fetchWorkspaceRows(token);
  const values: Record<string, string | null> = {};
  for (const row of rows) {
    if ((CLOUD_SYNC_KEYS as readonly string[]).includes(row.storage_key)) {
      values[row.storage_key] = row.payload;
    }
  }
  applyWorkspace(values);
  localStorage.setItem(ACTIVE_USER_KEY, userId);
}

export async function syncCloudWorkspace(token: string, userId: string): Promise<void> {
  if (!browserReady()) return;
  const snapshot = captureManagedWorkspace();
  await upsertWorkspaceRows(
    token,
    userId,
    Object.entries(snapshot).map(([storage_key, payload]) => ({ storage_key, payload })),
  );
}

export function isCloudWorkspaceActiveFor(userId: string): boolean {
  return browserReady() && localStorage.getItem(ACTIVE_USER_KEY) === userId;
}

export function downloadJSON(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
