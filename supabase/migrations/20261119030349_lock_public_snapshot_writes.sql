-- Public snapshots must only be written by a trusted publishing service after server-side sanitization.
revoke insert, update, delete on table public.public_collection_snapshots from authenticated;
drop policy if exists "Owners insert public snapshots" on public.public_collection_snapshots;
drop policy if exists "Owners update public snapshots" on public.public_collection_snapshots;
drop policy if exists "Owners delete public snapshots" on public.public_collection_snapshots;
