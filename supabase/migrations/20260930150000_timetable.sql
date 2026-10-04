-- Term timetable site (apps/timetable). Public read, admin write. The admin password is checked inside the
-- database (bcrypt via pgcrypto), so the site needs no server secret. Tables have RLS on and no policies:
-- all access goes through the SECURITY DEFINER functions below.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.timetable_state (
  id int primary key default 1 check (id = 1),
  title text not null default 'Class Timetable',
  term text not null default '',
  rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) <= 400),
  file_name text,
  file_type text check (file_type is null or file_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  file_data text check (file_data is null or length(file_data) <= 8000000),
  updated_at timestamptz not null default now()
);
insert into public.timetable_state (id) values (1) on conflict do nothing;

create table if not exists public.timetable_admin (
  id int primary key default 1 check (id = 1),
  password_hash text not null
);
insert into public.timetable_admin (id, password_hash) values (1, extensions.crypt('2402', extensions.gen_salt('bf', 10))) on conflict do nothing;

create table if not exists public.timetable_attempts (
  at timestamptz not null default now(),
  ok boolean not null
);
create index if not exists timetable_attempts_at_idx on public.timetable_attempts (at desc);

alter table public.timetable_state enable row level security;
alter table public.timetable_admin enable row level security;
alter table public.timetable_attempts enable row level security;
revoke all on public.timetable_state, public.timetable_admin, public.timetable_attempts from anon, authenticated;

-- Password check with a lockout: 10 wrong attempts in 15 minutes lock admin sign-in for everyone until the
-- window passes (a 4-digit code has only 10,000 possibilities). Returns 'ok', 'wrong' or 'locked'. It never
-- raises on a wrong password, so the failed attempt is recorded (a raise would roll the record back).
create or replace function public.timetable_verify(p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fails int;
  ok boolean;
begin
  delete from public.timetable_attempts where at < now() - interval '1 day';
  select count(*) into fails from public.timetable_attempts t where not t.ok and t.at > now() - interval '15 minutes';
  if fails >= 10 then
    return 'locked';
  end if;
  select a.password_hash = extensions.crypt(coalesce(p_password, ''), a.password_hash) into ok from public.timetable_admin a where a.id = 1;
  insert into public.timetable_attempts (ok) values (coalesce(ok, false));
  return case when coalesce(ok, false) then 'ok' else 'wrong' end;
end;
$$;

create or replace function public.timetable_auth_error(p_status text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('ok', false, 'error', case p_status when 'locked' then 'Too many wrong passwords. Try again in 15 minutes.' else 'Wrong password.' end)
$$;

create or replace function public.timetable_login(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := public.timetable_verify(p_password);
begin
  if st <> 'ok' then
    return public.timetable_auth_error(st);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.timetable_get()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('title', s.title, 'term', s.term, 'rows', s.rows, 'file_name', s.file_name, 'file_type', s.file_type, 'has_file', s.file_data is not null, 'updated_at', s.updated_at)
  from public.timetable_state s where s.id = 1
$$;

create or replace function public.timetable_file()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('file_name', s.file_name, 'file_type', s.file_type, 'file_data', s.file_data, 'updated_at', s.updated_at)
  from public.timetable_state s where s.id = 1
$$;

-- Replaces the current timetable. p_keep_file = true keeps the existing uploaded file.
create or replace function public.timetable_publish(p_password text, p_title text, p_term text, p_rows jsonb, p_file_name text, p_file_type text, p_file_data text, p_keep_file boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := public.timetable_verify(p_password);
begin
  if st <> 'ok' then
    return public.timetable_auth_error(st);
  end if;
  if p_file_data is not null and p_file_data !~ '^data:(image/(png|jpeg|webp)|application/pdf);base64,' then
    raise exception 'Upload a PNG, JPG, WebP or PDF file.' using errcode = 'P0001';
  end if;
  update public.timetable_state set
    title = left(coalesce(nullif(trim(p_title), ''), 'Class Timetable'), 120),
    term = left(coalesce(trim(p_term), ''), 120),
    rows = coalesce(p_rows, '[]'::jsonb),
    file_name = case when p_keep_file then file_name else left(p_file_name, 200) end,
    file_type = case when p_keep_file then file_type else p_file_type end,
    file_data = case when p_keep_file then file_data else p_file_data end,
    updated_at = now()
  where id = 1;
  return jsonb_build_object('ok', true, 'state', public.timetable_get());
end;
$$;

create or replace function public.timetable_change_password(p_password text, p_new text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  st text := public.timetable_verify(p_password);
begin
  if st <> 'ok' then
    return public.timetable_auth_error(st);
  end if;
  if length(coalesce(p_new, '')) < 4 then
    raise exception 'The new password must have at least 4 characters.' using errcode = 'P0001';
  end if;
  update public.timetable_admin set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)) where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.timetable_verify(text), public.timetable_auth_error(text) from public, anon, authenticated;
revoke all on function public.timetable_login(text), public.timetable_get(), public.timetable_file(), public.timetable_publish(text, text, text, jsonb, text, text, text, boolean), public.timetable_change_password(text, text) from public;
grant execute on function public.timetable_login(text), public.timetable_get(), public.timetable_file(), public.timetable_publish(text, text, text, jsonb, text, text, text, boolean), public.timetable_change_password(text, text) to anon, authenticated;
