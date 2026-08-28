-- Artha Bench Pro V2.0 personalized accounts and user-scoped data.
-- Run with Supabase migrations. Every user-owned table is protected by RLS.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  country text not null default 'India',
  currency text not null default 'INR',
  market_focus text not null default 'India' check (market_focus in ('India','US','Global')),
  learning_level text not null default 'beginner' check (learning_level in ('beginner','intermediate','advanced')),
  primary_goal text not null default 'all',
  monthly_income_range text,
  financial_goal text,
  personal_data_insights_enabled boolean not null default false,
  onboarding_completed boolean not null default false,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  preference_key text not null, preference_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, preference_key)
);

-- Compatibility cloud mirror for the application's existing local-storage domains.
create table if not exists public.user_workspace_state (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  storage_key text not null, payload text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, storage_key)
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  income_type text not null, amount numeric(18,2) not null check (amount > 0), currency text not null default 'INR',
  frequency text not null, description text not null default '', tax_status text, start_date date not null, end_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0), currency text not null default 'INR', category text not null,
  expense_date date not null, merchant text not null default '', payment_method text, notes text not null default '', recurring boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, budget_month date not null, notes text not null default '', savings_target numeric(18,2) not null default 0 check (savings_target >= 0),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references public.budgets(id) on delete cascade, category text not null,
  planned_amount numeric(18,2) not null default 0 check (planned_amount >= 0), warning_threshold numeric(5,2) not null default 80 check (warning_threshold between 1 and 1000),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, target_amount numeric(18,2) check (target_amount > 0), current_amount numeric(18,2) not null default 0 check (current_amount >= 0), currency text not null default 'INR', target_date date, notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Watchlist', created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  watchlist_id uuid not null references public.watchlists(id) on delete cascade, symbol text not null, exchange text, alert_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(watchlist_id, symbol)
);

create table if not exists public.paper_portfolios (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  cash_balance numeric(18,4) not null default 100000, initial_balance numeric(18,4) not null default 100000, currency text not null default 'USD', positions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.paper_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.paper_portfolios(id) on delete cascade, symbol text not null, side text not null check (side in ('buy','sell')),
  quantity numeric(24,8) not null check (quantity > 0), price numeric(24,8) not null check (price >= 0), total_amount numeric(24,8) not null check (total_amount >= 0), traded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id)
);

create table if not exists public.saved_reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  verification_code text, title text, report jsonb not null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'ArthaMind conversation',
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')), content text not null, context_reference text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  budget_alerts boolean not null default true, watchlist_alerts boolean not null default false, learning_reminders boolean not null default true, product_updates boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id)
);

create table if not exists public.user_alerts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null, payload jsonb not null default '{}'::jsonb, enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workspace_user_updated on public.user_workspace_state(user_id, updated_at desc);
create index if not exists idx_income_user_start on public.incomes(user_id, start_date desc);
create index if not exists idx_expenses_user_date on public.expenses(user_id, expense_date desc);
create index if not exists idx_budgets_user_month on public.budgets(user_id, budget_month desc);
create index if not exists idx_budget_categories_user_budget on public.budget_categories(user_id, budget_id);
create index if not exists idx_savings_goals_user on public.savings_goals(user_id);
create index if not exists idx_watchlists_user on public.watchlists(user_id);
create index if not exists idx_watchlist_items_user on public.watchlist_items(user_id, symbol);
create index if not exists idx_paper_portfolios_user on public.paper_portfolios(user_id);
create index if not exists idx_paper_transactions_user_time on public.paper_transactions(user_id, traded_at desc);
create index if not exists idx_saved_reports_user_time on public.saved_reports(user_id, created_at desc);
create index if not exists idx_ai_conversations_user_time on public.ai_conversations(user_id, created_at desc);
create index if not exists idx_ai_messages_user_conversation on public.ai_messages(user_id, conversation_id, created_at);
create index if not exists idx_user_alerts_user on public.user_alerts(user_id, enabled);

-- Apply updated_at triggers.
do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','user_workspace_state','incomes','expenses','budgets','budget_categories','savings_goals','watchlists','watchlist_items','paper_portfolios','paper_transactions','learning_progress','saved_reports','ai_conversations','ai_messages','notification_preferences','user_alerts']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', t, t);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Enable RLS and create strict user-isolation policies on every user-owned table.
do $$
declare t text; p text;
begin
  foreach t in array array['profiles','user_preferences','user_workspace_state','incomes','expenses','budgets','budget_categories','savings_goals','watchlists','watchlist_items','paper_portfolios','paper_transactions','learning_progress','saved_reports','ai_conversations','ai_messages','notification_preferences','user_alerts']
  loop
    execute format('alter table public.%I enable row level security', t);
    p := t || '_user_isolation';
    execute format('drop policy if exists %I on public.%I', p, t);
    execute format('create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', p, t);
  end loop;
end $$;

-- Automatically initialize a minimal profile after verified user creation.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    user_id, full_name, country, personal_data_insights_enabled
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'country', 'India'),
    coalesce((new.raw_user_meta_data ->> 'personal_data_insights_enabled')::boolean, false)
  ) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
