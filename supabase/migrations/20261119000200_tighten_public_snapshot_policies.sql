drop policy if exists "Owners manage public snapshots" on public.public_collection_snapshots;
create policy "Owners insert public snapshots"
on public.public_collection_snapshots for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "Owners update public snapshots"
on public.public_collection_snapshots for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
create policy "Owners delete public snapshots"
on public.public_collection_snapshots for delete to authenticated
using ((select auth.uid()) = owner_id);
drop index if exists public.public_snapshots_slug_idx;
create index if not exists public_snapshots_owner_idx on public.public_collection_snapshots(owner_id);