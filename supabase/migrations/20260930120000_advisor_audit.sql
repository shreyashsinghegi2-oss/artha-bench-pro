-- Advisory pipeline audit trail (Layer G). One row per answered question: the full layer-by-layer record
-- (parsed query, sources with timestamps, calculations with steps, guardrails, explanation and whether the
-- AI or the raw-data fallback produced it). Rows are written with the user's own session, so RLS limits every
-- user to their own rows; no service-role key is needed.
--
-- Sharing: the owner flips `shared` to true; anyone with the share_id can then read the answer through
-- get_shared_advice(), which strips personal profile data.

create table if not exists public.advisor_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  share_id text not null unique check (share_id ~ '^[A-Za-z0-9_-]{16,32}$'),
  question text not null check (char_length(question) between 1 and 1000),
  answer jsonb not null check (pg_column_size(answer) < 262144),
  answer_mode text not null check (answer_mode in ('ai', 'ai-retry', 'raw')),
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists advisor_audit_user_created_idx on public.advisor_audit (user_id, created_at desc);

alter table public.advisor_audit enable row level security;

drop policy if exists "advisor_audit_select_own" on public.advisor_audit;
create policy "advisor_audit_select_own" on public.advisor_audit for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "advisor_audit_insert_own" on public.advisor_audit;
create policy "advisor_audit_insert_own" on public.advisor_audit for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "advisor_audit_update_own" on public.advisor_audit;
create policy "advisor_audit_update_own" on public.advisor_audit for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "advisor_audit_delete_own" on public.advisor_audit;
create policy "advisor_audit_delete_own" on public.advisor_audit for delete to authenticated using (user_id = (select auth.uid()));

-- Only the `shared` flag may change after insert.
revoke update on public.advisor_audit from authenticated;
grant select, insert, delete on public.advisor_audit to authenticated;
grant update (shared) on public.advisor_audit to authenticated;

create or replace function public.get_shared_advice(p_share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'question', a.question,
    'created_at', a.created_at,
    'answer', (a.answer - 'profile') #- '{context,profile}'
  )
  from public.advisor_audit a
  where a.share_id = p_share_id and a.shared
$$;

revoke all on function public.get_shared_advice(text) from public;
grant execute on function public.get_shared_advice(text) to anon, authenticated;
