-- Require a verified sign-in for personal data.
--
-- APPLY ONLY AFTER email codes work end to end (custom SMTP + templates with {{ .Token }}, and the app deployed
-- with VITE_EMAIL_OTP=on). Before that, users who sign in with a password alone would see empty accounts.
--
-- Why: the app asks for an emailed code after the password, but a password-only session could still be used
-- directly against the database API. Supabase records how a session was created in the JWT "amr" claim. This
-- migration adds a RESTRICTIVE policy to every public table with a user_id column, so rows are readable and
-- writable only when the session came from an email code, OAuth (Google etc.), a magic/confirmation link,
-- password recovery, an invite, TOTP or SSO. Existing per-user policies (auth.uid() = user_id) still apply;
-- restrictive policies are ANDed with them. The service role (server) is unaffected.
--
-- Roll back: drop policy require_verified_session on each table, then drop function public.session_is_verified().

create or replace function public.session_is_verified()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role() = 'service_role', false)
    or exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as m(entry)
      where m.entry ->> 'method' in ('otp', 'oauth', 'magiclink', 'email/signup', 'recovery', 'invite', 'totp', 'sso/saml', 'email_change')
    );
$$;

comment on function public.session_is_verified() is
  'True when the current session was created by a method that proves control of the email (not a password alone).';

do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'user_id'
  loop
    execute format('drop policy if exists require_verified_session on public.%I', t.table_name);
    execute format(
      'create policy require_verified_session on public.%I as restrictive for all to authenticated '
      'using (public.session_is_verified()) with check (public.session_is_verified())',
      t.table_name
    );
  end loop;
end
$$;
