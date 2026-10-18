-- Daily voice credits per signed-in user (speech-to-text and text-to-speech), counted in India time.
-- Users can read their own counts; only use_voice_credit (security definer) can change them.
create table if not exists public.voice_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  stt integer not null default 0,
  tts integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.voice_usage enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'voice_usage' and policyname = 'voice_usage_select_own') then
    create policy "voice_usage_select_own" on public.voice_usage for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

-- Uses one credit of p_kind ('stt' or 'tts') when today's count is below p_limit.
create or replace function public.use_voice_credit(p_kind text, p_limit integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d date := (now() at time zone 'Asia/Kolkata')::date;
  used integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_kind not in ('stt', 'tts') then
    raise exception 'unknown kind';
  end if;
  insert into public.voice_usage (user_id, day) values (uid, d) on conflict do nothing;
  if p_kind = 'stt' then
    update public.voice_usage set stt = stt + 1, updated_at = now()
      where user_id = uid and day = d and stt < p_limit returning stt into used;
  else
    update public.voice_usage set tts = tts + 1, updated_at = now()
      where user_id = uid and day = d and tts < p_limit returning tts into used;
  end if;
  if not found then
    select case when p_kind = 'stt' then stt else tts end into used from public.voice_usage where user_id = uid and day = d;
    return json_build_object('allowed', false, 'used', used, 'limit', p_limit);
  end if;
  return json_build_object('allowed', true, 'used', used, 'limit', p_limit);
end;
$$;
revoke all on function public.use_voice_credit(text, integer) from public, anon;
grant execute on function public.use_voice_credit(text, integer) to authenticated;
