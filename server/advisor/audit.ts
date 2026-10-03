/**
 * Layer G — audit trail and share links, stored in Supabase `advisor_audit` (see the migration
 * 20260930120000_advisor_audit.sql). Writes use the signed-in user's own access token, so row-level security
 * applies and no service-role key is needed. Anonymous answers are returned but not stored.
 */
import { randomBytes } from 'node:crypto';
import type { AdvisorAnswer } from '../../src/advisor/pipeline';

const DEFAULT_URL = 'https://agjbvoosukxfvrritgto.supabase.co';
const DEFAULT_KEY = 'sb_publishable_KOdXB7LW5Ho5hDjsi3GMiw_xdogy5oR';

function config() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_KEY;
  return { url, key };
}

export interface AuditRef {
  id: string;
  share_id: string;
}

export interface SharedAdvice {
  question: string;
  created_at: string;
  answer: Partial<AdvisorAnswer>;
}

export const newShareId = (): string => randomBytes(12).toString('base64url');

/** What we store: the full answer minus the raw profile values (the profile checks keep what was used). */
export function auditRecord(answer: AdvisorAnswer): AdvisorAnswer {
  return { ...answer, context: { ...answer.context, profile: { ...answer.context.profile, data: null } } };
}

export interface AuditStore {
  save(token: string, answer: AdvisorAnswer): Promise<AuditRef>;
  share(token: string, id: string): Promise<string | null>;
  getShared(shareId: string): Promise<SharedAdvice | null>;
}

export function supabaseAuditStore(fetchImpl: typeof fetch = fetch): AuditStore {
  const headers = (token?: string) => {
    const { key } = config();
    return { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json' };
  };
  return {
    async save(token, answer) {
      const { url } = config();
      const share_id = newShareId();
      const res = await fetchImpl(`${url}/rest/v1/advisor_audit?select=id,share_id`, {
        method: 'POST',
        headers: { ...headers(token), Prefer: 'return=representation' },
        body: JSON.stringify({ share_id, question: answer.question.slice(0, 1000), answer: auditRecord(answer), answer_mode: answer.explanation.mode }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`audit save HTTP ${res.status}`);
      const rows = (await res.json()) as AuditRef[];
      const row = rows[0];
      if (!row) throw new Error('audit save returned no row');
      return row;
    },
    async share(token, id) {
      const { url } = config();
      const res = await fetchImpl(`${url}/rest/v1/advisor_audit?id=eq.${encodeURIComponent(id)}&select=share_id`, {
        method: 'PATCH',
        headers: { ...headers(token), Prefer: 'return=representation' },
        body: JSON.stringify({ shared: true }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`audit share HTTP ${res.status}`);
      const rows = (await res.json()) as Array<{ share_id: string }>;
      return rows[0]?.share_id ?? null;
    },
    async getShared(shareId) {
      const { url } = config();
      const res = await fetchImpl(`${url}/rest/v1/rpc/get_shared_advice`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ p_share_id: shareId }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) throw new Error(`shared advice HTTP ${res.status}`);
      const body = (await res.json()) as SharedAdvice | null;
      return body ?? null;
    },
  };
}
