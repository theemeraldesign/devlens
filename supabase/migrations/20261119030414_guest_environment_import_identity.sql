alter table public.environments
  add column guest_id uuid;

alter table public.environments
  add constraint environments_owner_guest_id_key unique (owner_id, guest_id);
