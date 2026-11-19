-- DevLens initial schema. Private workspace data is never publicly selectable.
create extension if not exists pgcrypto;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  content jsonb not null default '{"requests":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  variables jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS')),
  url text not null check (char_length(url) <= 4096),
  status_code integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- Public snapshots are a separate, deliberately limited data surface.
-- The publishing service must sanitize the JSON before inserting it here.
create table public.public_collection_snapshots (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-zA-Z0-9_-]{8,80}$'),
  title text not null check (char_length(title) between 1 and 120),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  published_at timestamptz not null default now(),
  unique (collection_id)
);

create index collections_owner_updated_idx on public.collections(owner_id, updated_at desc);
create index environments_owner_idx on public.environments(owner_id);
create index request_history_owner_created_idx on public.request_history(owner_id, created_at desc);
create index public_snapshots_slug_idx on public.public_collection_snapshots(slug);

alter table public.collections enable row level security;
alter table public.environments enable row level security;
alter table public.request_history enable row level security;
alter table public.public_collection_snapshots enable row level security;

create policy "Owners manage their collections"
on public.collections for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners manage their environments"
on public.environments for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners manage their request history"
on public.request_history for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners manage public snapshots"
on public.public_collection_snapshots for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Anyone can read published snapshots"
on public.public_collection_snapshots for select to anon, authenticated
using (true);

-- New Supabase projects no longer expose new public tables by default.
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.environments to authenticated;
grant select, insert, update, delete on public.request_history to authenticated;
grant select, insert, update, delete on public.public_collection_snapshots to authenticated;
grant select on public.public_collection_snapshots to anon;
