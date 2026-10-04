-- RAG over official financial documents (SEBI, RBI, CBDT/Income Tax, AMFI fact sheets, NSE/BSE).
-- Public regulatory text only: no user data is stored in these tables.

create extension if not exists vector with schema extensions;

create table if not exists public.rag_documents (
  id           uuid primary key default gen_random_uuid(),
  content_hash text not null unique,             -- sha256 of cleaned text; re-ingest is a no-op
  source       text not null,                    -- file name or URL
  title        text,
  authority    text not null default 'OTHER' check (authority in ('SEBI','RBI','CBDT','AMFI','NSE','BSE','OTHER')),
  doc_type     text,
  doc_date     date,
  url          text,
  created_at   timestamptz not null default now()
);

create table if not exists public.rag_chunks (
  id           bigint generated always as identity primary key,
  document_id  uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index  int  not null,
  content      text not null,
  section      text,
  token_count  int  not null check (token_count > 0),
  metadata     jsonb not null default '{}'::jsonb,
  embedding    extensions.vector(768) not null,  -- nomic-embed-text v1.5 / bge-base (768 dims)
  fts          tsvector generated always as (to_tsvector('english', coalesce(section, '') || ' ' || content)) stored,
  unique (document_id, chunk_index)
);

-- Approximate nearest neighbour on cosine distance. m/ef_construction are pgvector defaults, good up to ~1M chunks.
create index if not exists rag_chunks_embedding_hnsw on public.rag_chunks
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);
create index if not exists rag_chunks_fts_gin on public.rag_chunks using gin (fts);
create index if not exists rag_chunks_document on public.rag_chunks (document_id);
create index if not exists rag_documents_authority_date on public.rag_documents (authority, doc_date desc);

-- Read-only for everyone (public regulatory text); writes only through the service role, which bypasses RLS.
alter table public.rag_documents enable row level security;
alter table public.rag_chunks enable row level security;
drop policy if exists "rag documents are readable" on public.rag_documents;
create policy "rag documents are readable" on public.rag_documents for select to anon, authenticated using (true);
drop policy if exists "rag chunks are readable" on public.rag_chunks;
create policy "rag chunks are readable" on public.rag_chunks for select to anon, authenticated using (true);

-- Hybrid search in one round trip: vector top-N and full-text top-N fused with Reciprocal Rank Fusion.
-- Re-ranking (cross-encoder) happens in the sidecar on the returned candidates.
create or replace function public.rag_hybrid_search(
  query_text       text,
  query_embedding  extensions.vector(768),
  match_count      int  default 20,
  rrf_k            int  default 60,
  filter_authority text default null
)
returns table (
  chunk_id bigint, document_id uuid, content text, section text, authority text, title text,
  doc_date date, url text, vector_rank bigint, keyword_rank bigint, rrf_score double precision
)
language sql stable
security invoker
set search_path = public, extensions
as $$
  with vector_hits as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from public.rag_chunks c join public.rag_documents d on d.id = c.document_id
    where filter_authority is null or d.authority = filter_authority
    order by c.embedding <=> query_embedding
    limit match_count
  ),
  keyword_hits as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) desc) as rank
    from public.rag_chunks c join public.rag_documents d on d.id = c.document_id
    where c.fts @@ websearch_to_tsquery('english', query_text)
      and (filter_authority is null or d.authority = filter_authority)
    order by ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) desc
    limit match_count
  ),
  fused as (
    select coalesce(v.id, k.id) as id, v.rank as vector_rank, k.rank as keyword_rank,
           coalesce(1.0 / (rrf_k + v.rank), 0.0) + coalesce(1.0 / (rrf_k + k.rank), 0.0) as rrf_score
    from vector_hits v full outer join keyword_hits k on v.id = k.id
  )
  select c.id, c.document_id, c.content, c.section, d.authority, d.title, d.doc_date, d.url,
         f.vector_rank, f.keyword_rank, f.rrf_score
  from fused f
  join public.rag_chunks c on c.id = f.id
  join public.rag_documents d on d.id = c.document_id
  order by f.rrf_score desc
  limit match_count;
$$;

grant execute on function public.rag_hybrid_search(text, extensions.vector, int, int, text) to anon, authenticated;
