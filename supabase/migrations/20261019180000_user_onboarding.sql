-- Answers to the required sign-up questions (one row per user). Only the user can read or write their row.
create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 2 check (version between 1 and 100),
  answers jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_onboarding' and policyname = 'user_onboarding_select_own') then
    create policy user_onboarding_select_own on public.user_onboarding for select to authenticated using ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_onboarding' and policyname = 'user_onboarding_insert_own') then
    create policy user_onboarding_insert_own on public.user_onboarding for insert to authenticated with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_onboarding' and policyname = 'user_onboarding_update_own') then
    create policy user_onboarding_update_own on public.user_onboarding for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;

revoke all on public.user_onboarding from anon;
grant select, insert, update on public.user_onboarding to authenticated;
