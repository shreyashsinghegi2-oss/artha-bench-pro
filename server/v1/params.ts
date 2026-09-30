/**
 * Typed query-parameter definitions. One definition drives both request validation and the OpenAPI spec.
 */

export interface NumberParam {
  kind: 'number';
  name: string;
  description: string;
  required: boolean;
  min: number;
  max: number;
  integer?: boolean;
  default?: number;
  example: number;
}

export interface EnumParam {
  kind: 'enum';
  name: string;
  description: string;
  required: boolean;
  values: readonly string[];
  default?: string;
  example: string;
}

export type ParamDef = NumberParam | EnumParam;
export type ParamValues = Record<string, number | string | undefined>;

export class ParamError extends Error {
  constructor(readonly details: Record<string, string>) {
    super('Invalid query parameters.');
  }
}

export const num = (
  name: string,
  description: string,
  opts: Omit<NumberParam, 'kind' | 'name' | 'description' | 'required'> & { required?: boolean },
): NumberParam => ({
  kind: 'number',
  name,
  description,
  required: opts.required ?? true,
  ...opts,
});

export const oneOf = (
  name: string,
  description: string,
  values: readonly string[],
  opts: { required?: boolean; default?: string; example?: string } = {},
): EnumParam => ({
  kind: 'enum',
  name,
  description,
  values,
  required: opts.required ?? false,
  default: opts.default,
  example: opts.example ?? opts.default ?? values[0] ?? '',
});

type RawQuery = Record<string, unknown>;

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return undefined;
}

/** Validates the query against the definitions. Throws ParamError listing every problem at once. */
export function parseParams(defs: readonly ParamDef[], query: RawQuery): ParamValues {
  const out: ParamValues = {};
  const problems: Record<string, string> = {};
  for (const def of defs) {
    const raw = firstString(query[def.name])?.trim();
    if (raw === undefined || raw === '') {
      if (def.required) problems[def.name] = 'is required';
      else out[def.name] = def.default;
      continue;
    }
    if (def.kind === 'number') {
      // Accept Indian/Western digit grouping ("12,00,000") and a leading currency sign.
      const cleaned = raw.replace(/[,_\s]/g, '').replace(/^[₹$£€]/, '');
      const value = Number(cleaned);
      if (!/^-?\d+(\.\d+)?$/.test(cleaned) || !Number.isFinite(value)) problems[def.name] = 'must be a number';
      else if (def.integer && !Number.isInteger(value)) problems[def.name] = 'must be a whole number';
      else if (value < def.min || value > def.max) problems[def.name] = `must be between ${def.min} and ${def.max}`;
      else out[def.name] = value;
    } else {
      const value = raw.toLowerCase();
      if (!def.values.includes(value)) problems[def.name] = `must be one of: ${def.values.join(', ')}`;
      else out[def.name] = value;
    }
  }
  if (Object.keys(problems).length) throw new ParamError(problems);
  return out;
}

/** Reads a validated number (the definitions guarantee required values exist). */
export function n(values: ParamValues, name: string): number {
  const v = values[name];
  if (typeof v !== 'number') throw new ParamError({ [name]: 'is required' });
  return v;
}

export function s(values: ParamValues, name: string): string {
  const v = values[name];
  if (typeof v !== 'string') throw new ParamError({ [name]: 'is required' });
  return v;
}
