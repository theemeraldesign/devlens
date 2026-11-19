alter table public.collections
  add column guest_id uuid;

alter table public.collections
  add constraint collections_owner_guest_id_key unique (owner_id, guest_id);
