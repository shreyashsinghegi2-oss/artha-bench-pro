/**
 * Types for the fetch layer: every live source (documents, official sites, market data, news, web search,
 * optional scraper, reference) returns normalised items that the refine step numbers, ranks and cites.
 */
export type SourceKind = 'official' | 'market' | 'news' | 'web' | 'reference';

export interface FetchItem {
  /** Source id that produced the item (for metrics and debugging). */
  sourceId: string;
  kind: SourceKind;
  title: string;
  url?: string;
  publisher: string;
  /** ISO date or human date as published; empty when unknown. */
  publishedAt?: string;
  /** Plain text the model may quote. Never trusted as instructions. */
  text: string;
  fetchedAt: string;
  /** Freshness label shown to users, e.g. "delayed", "end of day", "official", "news". */
  freshness: string;
  /** Extra ranking weight a source can add (e.g. a quote for an instrument the user named). */
  boost?: number;
}

export interface FetchContext {
  /** The user's question, trimmed. */
  question: string;
  /** Raw prompt (may contain links the user shared). */
  prompt: string;
  webMode: 'auto' | 'on' | 'off';
  instruments: Array<{ symbol: string; label: string }>;
  wantNews: boolean;
  wantWeb: boolean;
  wantOfficial: boolean;
  isConcept: boolean;
}

export interface Source {
  id: string;
  kind: SourceKind;
  /** Lower number = more authoritative. Used for ranking. */
  priority: number;
  timeoutMs: number;
  cacheTtlMs: number;
  /** Hosts this source contacts; used for per-host back-off after 403/429. */
  hosts?: string[];
  enabled(ctx: FetchContext): boolean;
  fetch(ctx: FetchContext): Promise<FetchItem[]>;
}

export interface SourceRun {
  id: string;
  ok: boolean;
  cached: boolean;
  skipped?: 'disabled' | 'backoff' | 'budget';
  items: FetchItem[];
  latencyMs: number;
  bytes: number;
  error?: string;
}

/** Thrown by sources when a host answers 403/429 so the registry can back off from it. */
export class HostThrottledError extends Error {
  constructor(
    readonly host: string,
    readonly status: number,
  ) {
    super(`${host} answered HTTP ${status}`);
  }
}
