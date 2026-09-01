-- Artha Bench Pro: additive Financial Health + EMI Intelligence persistence model.
-- This migration does not replace existing workspace-state storage or change current app writes.
-- It prepares RLS-protected entities for future server-side snapshots, consented imports and provider syncs.

create table if not exists public.health_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  indicator numeric(5,2) check (indicator between 0 and 100),
  status text not null check (status in ('Stable','Watch','Review','Data needed')),
  data_completeness text not null check (data_completeness in ('Low','Medium','High')),
  weighting_version text not null default 'health-v1',
  calculation_version text not null default 'deterministic-v1',
  source_type text not null default 'workspace-records',
  calculated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.health_dimension_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  health_snapshot_id uuid not null references public.health_score_snapshots(id) on delete cascade,
  dimension_key text not null,
  dimension_name text not null,
  score numeric(5,2) check (score between 0 and 100),
  status text not null check (status in ('Stable','Watch','Review','Data needed')),
  weight numeric(5,2) not null check (weight between 0 and 100),
  calculation_inputs jsonb not null default '{}'::jsonb,
  calculation_method text not null,
  evidence jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  source_type text not null default 'workspace-records',
  calculated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(health_snapshot_id, dimension_key)
);

create table if not exists public.emi_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  lender text,
  category text,
  status text not null default 'active' check (status in ('active','closed')),
  emi_amount numeric(18,2) check (emi_amount is null or emi_amount >= 0),
  original_loan_amount numeric(18,2) check (original_loan_amount is null or original_loan_amount >= 0),
  outstanding_balance numeric(18,2) check (outstanding_balance is null or outstanding_balance >= 0),
  annual_interest_rate numeric(9,4) check (annual_interest_rate is null or annual_interest_rate >= 0),
  start_date date,
  next_due_date date,
  tenure_months integer check (tenure_months is null or tenure_months >= 0),
  remaining_installments integer check (remaining_installments is null or remaining_installments >= 0),
  source_type text not null default 'manual',
  provider text,
  fetched_at timestamptz,
  observed_at timestamptz,
  imported_at timestamptz,
  consent_id uuid,
  verification_state text not null default 'user-recorded',
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.emi_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  emi_record_id uuid not null references public.emi_records(id) on delete cascade,
  due_date date not null,
  amount numeric(18,2) check (amount is null or amount >= 0),
  payment_status text check (payment_status is null or payment_status in ('paid','pending','unpaid','unknown')),
  status_observed_at timestamptz,
  source_type text not null default 'manual',
  provider text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, emi_record_id, due_date)
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  connection_type text not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null check (status in ('pending','active','revoked','expired','denied')),
  granted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  consent_reference text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.emi_records
  drop constraint if exists emi_records_consent_id_fkey;
alter table public.emi_records
  add constraint emi_records_consent_id_fkey foreign key (consent_id) references public.consent_records(id) on delete set null;

create table if not exists public.emi_connection_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  connection_type text not null check (connection_type in ('manual','statement-import','account-aggregator','lender-api')),
  status text not null check (status in ('connected','not_connected','provider_unavailable','sync_needs_attention','disconnected')),
  consent_id uuid references public.consent_records(id) on delete set null,
  provider_account_reference text,
  data_categories jsonb not null default '[]'::jsonb,
  last_synced_at timestamptz,
  freshness_label text,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.emi_connection_syncs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_account_id uuid not null references public.emi_connection_accounts(id) on delete cascade,
  sync_key text not null,
  status text not null check (status in ('queued','running','succeeded','partial','failed')),
  started_at timestamptz,
  completed_at timestamptz,
  fetched_at timestamptz,
  observed_at timestamptz,
  imported_count integer not null default 0 check (imported_count >= 0),
  skipped_duplicate_count integer not null default 0 check (skipped_duplicate_count >= 0),
  error_summary text,
  provider_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, connection_account_id, sync_key)
);

create table if not exists public.imported_statement_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('csv','pdf','statement-provider')),
  original_filename text,
  status text not null check (status in ('uploaded','extracting','review_required','confirmed','cancelled','failed')),
  extracted_rows jsonb not null default '[]'::jsonb,
  uncertain_fields jsonb not null default '[]'::jsonb,
  confirmed_record_ids jsonb not null default '[]'::jsonb,
  consent_id uuid references public.consent_records(id) on delete set null,
  imported_at timestamptz,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.verified_lender_products (
  id uuid primary key default gen_random_uuid(),
  institution_name text not null,
  product_category text not null,
  product_name text,
  published_rate_min numeric(9,4),
  published_rate_max numeric(9,4),
  representative_apr numeric(9,4),
  tenure_min_months integer,
  tenure_max_months integer,
  processing_fee_text text,
  official_terms_url text not null,
  source_url text not null,
  source_type text not null default 'official-or-licensed-provider',
  provider text not null,
  fetched_at timestamptz not null,
  observed_at timestamptz,
  verification_state text not null check (verification_state in ('verified','stale','unavailable')),
  sponsored boolean not null default false,
  sponsorship_disclosure text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.provider_status (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  provider_type text not null,
  status text not null check (status in ('connected','degraded','unavailable','not_configured')),
  freshness_label text,
  last_checked_at timestamptz not null default timezone('utc', now()),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.finance_data_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  source_type text,
  provider text,
  consent_id uuid references public.consent_records(id) on delete set null,
  event_metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_health_score_user_period on public.health_score_snapshots(user_id, period_end desc);
create index if not exists idx_health_dimension_user_snapshot on public.health_dimension_snapshots(user_id, health_snapshot_id);
create index if not exists idx_emi_records_user_status on public.emi_records(user_id, status, next_due_date);
create index if not exists idx_emi_schedule_user_due on public.emi_payment_schedules(user_id, due_date);
create index if not exists idx_emi_connections_user on public.emi_connection_accounts(user_id, status);
create index if not exists idx_emi_syncs_user_time on public.emi_connection_syncs(user_id, created_at desc);
create index if not exists idx_consent_user_provider on public.consent_records(user_id, provider, status);
create index if not exists idx_import_jobs_user_time on public.imported_statement_jobs(user_id, created_at desc);
create index if not exists idx_lender_products_category on public.verified_lender_products(product_category, verification_state, fetched_at desc);
create index if not exists idx_finance_audit_user_time on public.finance_data_audit_log(user_id, occurred_at desc);

-- Existing projects already define public.set_updated_at(). Reuse it without changing its behavior.
do $$
declare t text;
begin
  foreach t in array array[
    'health_score_snapshots','health_dimension_snapshots','emi_records','emi_payment_schedules',
    'consent_records','emi_connection_accounts','emi_connection_syncs','imported_statement_jobs',
    'verified_lender_products','provider_status'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- User-owned tables: explicit Data API grants plus strict ownership RLS.
do $$
declare t text; p text;
begin
  foreach t in array array[
    'health_score_snapshots','health_dimension_snapshots','emi_records','emi_payment_schedules',
    'consent_records','emi_connection_accounts','emi_connection_syncs','imported_statement_jobs','finance_data_audit_log'
  ]
  loop
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    p := t || '_user_isolation';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      p, t
    );
  end loop;
end $$;

-- Provider catalogs/status are deliberately server-managed. No anon/authenticated Data API access is granted.
alter table public.verified_lender_products enable row level security;
alter table public.provider_status enable row level security;
revoke all on table public.verified_lender_products from anon, authenticated;
revoke all on table public.provider_status from anon, authenticated;
grant select, insert, update, delete on table public.verified_lender_products to service_role;
grant select, insert, update, delete on table public.provider_status to service_role;

-- No table in this migration contains fields for net-banking passwords, UPI PINs, OTPs, ATM PINs, CVVs or full card numbers.
-- External syncs must use provider-issued server-side credentials and active consent records only.
