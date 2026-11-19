-- Keep the public view under caller privileges. Grant anon only the columns intended for publication.
alter view public.public_collections set (security_invoker = true, security_barrier = true);
revoke all on table public.public_collection_snapshots from anon;
grant select (slug, title, snapshot, published_at) on table public.public_collection_snapshots to anon;
grant select on table public.public_collections to anon, authenticated;
