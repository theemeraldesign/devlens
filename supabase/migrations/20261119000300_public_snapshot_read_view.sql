-- Expose only the deliberately public fields. Never expose internal owner or collection IDs.
create or replace view public.public_collections
with (security_barrier = true)
as
select slug, title, snapshot, published_at
from public.public_collection_snapshots;

revoke all on table public.public_collection_snapshots from anon;
grant select on table public.public_collections to anon, authenticated;
