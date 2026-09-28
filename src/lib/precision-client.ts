/**
 * Browser client for certified calculations (precision-engine/ via the /api/precision proxy).
 *
 * Every amount and rate is sent as a decimal STRING: a JS number is a binary double, and converting it
 * back to decimal would reintroduce exactly the rounding the engine is there to rule out.
 * The engine either returns a certified result or refuses (HTTP 422) — it never returns an unverified number.
 */
export type PrecisionKind = 'emi' | 'sip' | 'cagr' | 'xirr' | 'bond' | 'tax';

export interface PrecisionCertificate {
  calculation: string;
  input: Record<string, unknown>;
  output: { value: string; display: string; [extra: string]: unknown };
  certification: {
    guaranteed_relative_error: string;
    certified_relative_error: string | null;
    certified_absolute_error: string;
    certified_interval: [string, string];
    interval_width: string;
    verification: Record<string, string | boolean>;
    working_precision: string;
    convergence: Record<string, unknown>;
    timestamp: string;
    engine_version: string;
    scope: string;
    notes: string[];
  };
}

export interface CertifiedResult {
  display: string;
  fullPrecision: string;
  badge: string;
  interval: [string, string];
  certificate: PrecisionCertificate;
}

export class PrecisionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'not_configured' | 'refused' | 'unavailable' | 'invalid',
  ) {
    super(message);
    this.name = 'PrecisionError';
  }
}

type Params = Record<string, string | number | boolean | object | undefined>;

function assertNoFloats(params: Params, path = 'params') {
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      throw new PrecisionError(`${path}.${key} must be a decimal string, not a JS number`, 400, 'invalid');
    }
    if (value && typeof value === 'object') assertNoFloats(value as Params, `${path}.${key}`);
  }
}

export async function calculate(kind: PrecisionKind, params: Params, options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<CertifiedResult> {
  assertNoFloats(params);
  const { baseUrl = '/api/precision', fetchImpl = fetch } = options;
  let res: Response;
  try {
    res = await fetchImpl(`${baseUrl}/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  } catch {
    throw new PrecisionError('Precision engine unreachable', 0, 'unavailable');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 503 && data?.configured === false) throw new PrecisionError('Precision engine is not configured', 503, 'not_configured');
  if (res.status === 422) throw new PrecisionError(data?.error || 'Calculation could not be certified', 422, data?.detail ? 'invalid' : 'refused');
  if (!res.ok) throw new PrecisionError(data?.error || `Precision engine error (${res.status})`, res.status, 'unavailable');

  const cert = data as PrecisionCertificate;
  if (cert?.certification?.verification?.all_agree !== true) throw new PrecisionError('Verification failed', 422, 'refused');
  const agreeing = Object.keys(cert.certification.verification).filter((k) => k.startsWith('method_')).length;
  return {
    display: cert.output.display,
    fullPrecision: cert.output.value,
    badge: `Verified to 0.000001% (${agreeing} methods agree, interval width ${cert.certification.interval_width})`,
    interval: cert.certification.certified_interval,
    certificate: cert,
  };
}

/** Ask the engine's independent checker to re-verify a certificate (for example one stored earlier). */
export async function verifyCertificate(certificate: PrecisionCertificate, options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
  const { baseUrl = '/api/precision', fetchImpl = fetch } = options;
  const res = await fetchImpl(`${baseUrl}/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ certificate }) });
  return (await res.json()) as { valid: boolean; checks: string[] };
}
