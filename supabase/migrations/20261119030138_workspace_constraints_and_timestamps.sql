alter table public.collections
  add constraint collections_content_is_object
  check (jsonb_typeof(content) = 'object');

alter table public.environments
  add constraint environments_variables_are_object
  check (jsonb_typeof(variables) = 'object');

create unique index environments_one_active_per_owner_idx
  on public.environments(owner_id)
  where is_active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
before update on public.collections
for each row execute function public.set_updated_at();

drop trigger if exists environments_set_updated_at on public.environments;
create trigger environments_set_updated_at
before update on public.environments
for each row execute function public.set_updated_at();
