-- Market-alert webhooks for the public API (/api/v1/webhooks).
-- Written and read only by the API server with the service-role key; no browser access.

create table if not exists public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  key_id text not null,
  url text not null check (url ~ '^https://' and length(url) <= 500),
  symbol text not null check (symbol in ('nifty', 'btc')),
  condition text not null check (condition in ('above', 'below')),
  threshold numeric not null check (threshold > 0),
  secret text not null,
  last_state boolean,
  last_fired_at timestamptz,
  last_status integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists api_webhooks_key_idx on public.api_webhooks (key_id);
create index if not exists api_webhooks_active_idx on public.api_webhooks (active) where active;

-- Row-level security on with no policies: anon and authenticated users cannot read or write this table.
alter table public.api_webhooks enable row level security;
