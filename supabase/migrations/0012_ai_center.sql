-- GALEYAR v1.5 — AI Center: pregnancy tracking, disease vitals/quarantine,
-- feed daily-rate forecasting, herd-growth assumptions, deworming records,
-- and animal exit reasons.

-- ---------------------------------------------------------------------------
-- Pregnancy tracking (animals)
-- ---------------------------------------------------------------------------
alter table public.animals
  add column is_pregnant boolean not null default false,
  add column pregnancy_month integer,
  add column expected_birth_date date,
  add column exit_reason text;

create index animals_pregnant_idx on public.animals (farm_id, is_pregnant) where deleted_at is null and is_pregnant = true;

-- ---------------------------------------------------------------------------
-- Disease vitals/quarantine
-- ---------------------------------------------------------------------------
alter table public.disease_records
  add column body_temperature numeric,
  add column quarantine_until date;

-- ---------------------------------------------------------------------------
-- Feed daily-rate forecasting — set once instead of logged every day.
-- ---------------------------------------------------------------------------
alter table public.feed_inventory
  add column daily_rate numeric;

-- ---------------------------------------------------------------------------
-- Herd-growth assumptions, overridable per farm (defaults applied client-side).
-- ---------------------------------------------------------------------------
alter table public.farms
  add column twin_rate numeric,
  add column mortality_rate numeric;

-- ---------------------------------------------------------------------------
-- deworming_records — mirrors vaccinations (0007) exactly: same shape, same
-- RLS/trigger pattern, its own soft-delete-owner-only guard.
-- ---------------------------------------------------------------------------
create table public.deworming_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  deworming_type text not null default 'internal', -- 'internal' | 'external'
  product_name text not null,
  date_given date not null default current_date,
  next_due_date date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index deworming_records_animal_id_idx on public.deworming_records (animal_id) where deleted_at is null;
create index deworming_records_farm_due_idx on public.deworming_records (farm_id, next_due_date) where deleted_at is null;

alter table public.deworming_records enable row level security;

create trigger set_updated_at before update on public.deworming_records
  for each row execute function public.set_updated_at();
create trigger guard_soft_delete_owner_only before update on public.deworming_records
  for each row execute function public.guard_soft_delete_owner_only();

create policy "deworming_records_select_farm" on public.deworming_records
  for select using (farm_id = public.current_farm_id());
create policy "deworming_records_insert_owner_operator_vet" on public.deworming_records
  for insert with check (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "deworming_records_update_owner_operator_vet" on public.deworming_records
  for update using (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "deworming_records_delete_owner" on public.deworming_records
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');
