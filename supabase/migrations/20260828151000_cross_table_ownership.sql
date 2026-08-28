-- Prevent cross-user parent references even when a UUID is guessed.
-- RLS protects row access; these composite foreign keys additionally bind every child to a parent owned by the same user.

create unique index if not exists uq_budgets_user_id_id on public.budgets(user_id, id);
create unique index if not exists uq_watchlists_user_id_id on public.watchlists(user_id, id);
create unique index if not exists uq_paper_portfolios_user_id_id on public.paper_portfolios(user_id, id);
create unique index if not exists uq_ai_conversations_user_id_id on public.ai_conversations(user_id, id);

alter table public.budget_categories drop constraint if exists budget_categories_budget_id_fkey;
alter table public.budget_categories
  add constraint budget_categories_owner_budget_fkey
  foreign key (user_id, budget_id) references public.budgets(user_id, id) on delete cascade;

alter table public.watchlist_items drop constraint if exists watchlist_items_watchlist_id_fkey;
alter table public.watchlist_items
  add constraint watchlist_items_owner_watchlist_fkey
  foreign key (user_id, watchlist_id) references public.watchlists(user_id, id) on delete cascade;

alter table public.paper_transactions drop constraint if exists paper_transactions_portfolio_id_fkey;
alter table public.paper_transactions
  add constraint paper_transactions_owner_portfolio_fkey
  foreign key (user_id, portfolio_id) references public.paper_portfolios(user_id, id) on delete cascade;

alter table public.ai_messages drop constraint if exists ai_messages_conversation_id_fkey;
alter table public.ai_messages
  add constraint ai_messages_owner_conversation_fkey
  foreign key (user_id, conversation_id) references public.ai_conversations(user_id, id) on delete cascade;
