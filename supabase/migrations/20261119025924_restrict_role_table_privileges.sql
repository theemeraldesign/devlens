-- Remove broad default privileges and grant only the minimum needed by each role.
revoke all on table public.collections, public.environments, public.request_history from public, anon, authenticated;
revoke all on table public.public_collection_snapshots from public, anon, authenticated;
revoke all on table public.public_collections from public, anon, authenticated;

grant select, insert, update, delete on table public.collections to authenticated;
grant select, insert, update, delete on table public.environments to authenticated;
grant select, insert, update, delete on table public.request_history to authenticated;
grant select, insert, update, delete on table public.public_collection_snapshots to authenticated;

grant select (slug, title, snapshot, published_at) on table public.public_collection_snapshots to anon;
grant select on table public.public_collections to anon, authenticated;
