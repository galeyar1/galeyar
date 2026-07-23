-- Multi-farm support (owner-only, per the confirmed scope: an owner can
-- create/own several farms and switch between them; operator/vet/consultant
-- stay pinned to exactly one farm each, unchanged). Plus animal photo
-- gallery, a vaccinations module, and a pedigree table for ancestors that
-- aren't themselves tracked animal records.
--
-- Deliberately NOT creating a server-side "offline_sync_queue" table: the
-- pending-mutation queue is a client-only concept (IndexedDB, see
-- src/lib/db/schema.ts) representing writes this device hasn't pushed yet.
-- A server-side mirror would be redundant with what's already synced and
-- could easily present a stale/wrong "pending" state on a different device.
-- The "Pending Sync Operations" dashboard card reads the local queue directly.

-- ---------------------------------------------------------------------------
-- farm_members — which farms a user (an owner) belongs to/owns.
-- current_farm_id()/current_role() keep reading public.users as before;
-- "switching farms" just updates users.farm_id to point at a different
-- membership row, so every existing RLS policy needs zero changes.
-- ---------------------------------------------------------------------------
create table public.farm_members (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (farm_id, user_id)
);

alter table public.farm_members enable row level security;

create policy "farm_members_select_own" on public.farm_members
  for select using (user_id = auth.uid());

create policy "farm_members_insert_own_owner" on public.farm_members
  for insert to authenticated
  with check (user_id = auth.uid() and public.current_role() = 'owner');

-- Backfill: every existing owner becomes a member of the farm they're
-- already on, so the farm switcher has something to show immediately.
insert into public.farm_members (farm_id, user_id)
select farm_id, id from public.users
where role = 'owner' and farm_id is not null
on conflict (farm_id, user_id) do nothing;

-- Relax the farm_id guard: an owner may now switch to any farm_id they're a
-- confirmed member of. Every other case is unchanged — operator/vet/
-- consultant still only get the one-time null -> value onboarding/invite
-- transition, and role changes still require the service role.
create or replace function public.guard_users_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role can only be changed by a farm administrator';
  end if;

  if new.farm_id is distinct from old.farm_id then
    if old.farm_id is null then
      null; -- first-time onboarding / invite acceptance
    elsif old.role = 'owner' and new.farm_id is not null and exists (
      select 1 from public.farm_members where farm_id = new.farm_id and user_id = old.id
    ) then
      null; -- switching between farms this owner belongs to
    else
      raise exception 'farm_id can only be changed by a farm administrator';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- animal_images — photo gallery per animal (disease_records already has a
-- single image_url; this is a separate multi-photo gallery).
-- ---------------------------------------------------------------------------
create table public.animal_images (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  image_url text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index animal_images_animal_id_idx on public.animal_images (animal_id);

alter table public.animal_images enable row level security;

create policy "animal_images_select_farm" on public.animal_images
  for select using (farm_id = public.current_farm_id());
create policy "animal_images_insert_owner_operator" on public.animal_images
  for insert with check (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator')
  );
create policy "animal_images_delete_owner" on public.animal_images
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

insert into storage.buckets (id, name, public)
values ('animal-images', 'animal-images', false)
on conflict (id) do nothing;

create policy "animal_images_bucket_select_farm" on storage.objects
  for select using (
    bucket_id = 'animal-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
  );
create policy "animal_images_bucket_insert_owner_operator" on storage.objects
  for insert with check (
    bucket_id = 'animal-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() in ('owner', 'operator')
  );
create policy "animal_images_bucket_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'animal-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() = 'owner'
  );

-- ---------------------------------------------------------------------------
-- vaccinations — distinct from general treatments so "vaccinations due" can
-- be tracked by next_due_date. Offline-capable like every other record type.
-- ---------------------------------------------------------------------------
create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  vaccine_name text not null,
  date_given date not null default current_date,
  next_due_date date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vaccinations_animal_id_idx on public.vaccinations (animal_id) where deleted_at is null;
create index vaccinations_farm_due_idx on public.vaccinations (farm_id, next_due_date) where deleted_at is null;

alter table public.vaccinations enable row level security;

create trigger set_updated_at before update on public.vaccinations
  for each row execute function public.set_updated_at();
create trigger guard_soft_delete_owner_only before update on public.vaccinations
  for each row execute function public.guard_soft_delete_owner_only();

create policy "vaccinations_select_farm" on public.vaccinations
  for select using (farm_id = public.current_farm_id());
create policy "vaccinations_insert_owner_operator_vet" on public.vaccinations
  for insert with check (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "vaccinations_update_owner_operator_vet" on public.vaccinations
  for update using (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "vaccinations_delete_owner" on public.vaccinations
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- pedigree_relations — records an ancestor for the pedigree tree when that
-- ancestor is NOT itself a tracked animal record (e.g. a purchased sire from
-- another farm). Direct ancestors already in the system use animals.father_id
-- / mother_id and don't need a row here.
-- ---------------------------------------------------------------------------
create table public.pedigree_relations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  relation_type text not null check (relation_type in ('father', 'mother')),
  external_name text not null,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (animal_id, relation_type)
);

alter table public.pedigree_relations enable row level security;

create policy "pedigree_relations_select_farm" on public.pedigree_relations
  for select using (farm_id = public.current_farm_id());
create policy "pedigree_relations_insert_owner_operator" on public.pedigree_relations
  for insert with check (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator')
  );
create policy "pedigree_relations_delete_owner" on public.pedigree_relations
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');
