# Artha Bench Pro — Personalized Accounts Setup

The application keeps all existing public functionality available when account services are not configured. To enable cross-device accounts and personalized ArthaMind data, connect a Supabase project using the steps below.

## 1. Create the Supabase project

Create a Supabase project in the region appropriate for your deployment and data-residency requirements. Do not put database passwords or the service-role key into frontend code.

Run the migration:

`supabase/migrations/20260828150000_personalized_accounts.sql`

The migration creates user-scoped tables, indexes, updated-at triggers, the new-user profile trigger, and Row Level Security policies. Every user-owned table uses `auth.uid() = user_id` for both read/write access.

## 2. Authentication configuration

In Supabase Authentication:

- Enable Email/Password.
- Enable email confirmation if verification is required for production.
- Configure the email sender/template settings used for verification and password recovery.
- Optional: enable Google and provide the Google OAuth client ID/secret in Supabase, not in Artha Bench frontend code.
- Add the deployed site URL and redirect URLs.

Recommended production URLs:

- Site URL: `https://artha-bench-pro.vercel.app/`
- OAuth callback: `https://artha-bench-pro.vercel.app/?auth=callback`
- Password recovery: `https://artha-bench-pro.vercel.app/?auth=reset`

For local development also allow your local origin, for example `http://localhost:3000/`.

## 3. Environment variables

Set these in local `.env` and in the Vercel `artha-bench-pro` project environment:

```text
VITE_SUPABASE_URL=<public project URL>
VITE_SUPABASE_ANON_KEY=<public anon/publishable key>
SUPABASE_URL=<same project URL, server use>
SUPABASE_ANON_KEY=<same anon/publishable key, server use>
SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public project configuration. `SUPABASE_SERVICE_ROLE_KEY` is privileged and must never use a `VITE_` prefix or appear in browser bundles. It is used only by the server-side permanent account deletion endpoint.

Existing Groq, market, FRED, World Bank, news and company-provider variables remain unchanged.

## 4. Data model and backward compatibility

The current application continues to use its existing local-storage services so Income, Expenses, Budgeting, Learning, paper trading, reports, theme and other modules do not need invasive rewrites.

When a user signs in:

1. Guest workspace values are preserved separately.
2. The authenticated user's RLS-protected `user_workspace_state` rows hydrate the existing storage keys before the dashboard renders.
3. Changes are periodically mirrored back to the user's cloud workspace.
4. On sign-out, authenticated workspace keys are removed and the prior guest workspace is restored.

This prevents silent mixing of guest/demo data with a user's private cloud workspace. The normalized tables in the migration provide the path for gradually migrating each domain away from the compatibility mirror later.

## 5. Personalized ArthaMind

The existing public `/api/dashboard/assistant` remains unchanged for logged-out/public dashboard analysis.

Signed-in users can explicitly enable personal sources in **AI Data Context**. If any personal source is enabled, the app calls the authenticated `/api/personal/assistant` route. That route:

- verifies the Supabase access token;
- loads only `user_workspace_state` rows visible through that user's RLS token;
- includes only the source groups the user enabled;
- refuses to invent missing records or balances;
- returns transparent `Personal data used` context references;
- preserves the educational-only, non-investment/tax/legal/financial-advice boundary.

Conversation persistence is disabled by default and only stores messages when the user enables **Save this conversation**.

## 6. Account deletion

Permanent account deletion is performed by `/api/account/delete` after validating the user's bearer token. The server then uses `SUPABASE_SERVICE_ROLE_KEY` to delete that exact authenticated user through the Supabase Admin endpoint. Because personal tables reference `auth.users` with `ON DELETE CASCADE`, user-owned rows are removed with the account.

If the service-role environment variable is not configured, the UI will report that permanent deletion is not yet configured rather than pretending deletion succeeded.

## 7. Verification checklist

After configuring Supabase, verify:

- sign up → verification email → sign in;
- Google sign-in if enabled;
- forgot/reset password redirect;
- Remember me on/off session behavior;
- optional onboarding can be skipped and completed later;
- create/edit/delete Income, Expense and Budget records, refresh, sign out/in, and verify persistence;
- test with two accounts and confirm neither can read the other's rows in Supabase/PostgREST;
- enable/disable every AI Data Context source and verify disabled sources do not appear in response context references;
- enable conversation saving, then delete one conversation and delete all history;
- export account data;
- confirm the searchable All Features menu opens/closes via pointer, Escape and route selection;
- verify all original routes, providers, charts, evaluation flows and settings still operate.

No existing provider integration must be removed or replaced to enable this account layer.
