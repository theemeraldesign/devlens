-- Keep authenticated readers on the same public-safe column surface as anonymous visitors.
-- The publish Edge Function uses its service-role client for writes.
revoke all on table public.public_collection_snapshots from authenticated;
grant select (slug, title, snapshot, published_at) on table public.public_collection_snapshots to authenticated;
revoke insert, update, delete on table public.public_collection_snapshots from authenticated;
