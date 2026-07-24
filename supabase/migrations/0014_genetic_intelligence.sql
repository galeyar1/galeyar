-- GALEYAR v1.6 — Genetic Intelligence: genotype prediction/confirmation on
-- animals, lab test tracking, and a modification-history audit trail.
-- Plain text columns (not Postgres enums), matching every field added in
-- the last two rounds (is_pregnant, exit_reason, financial categories,
-- support ticket status, etc.) — the app-level TS unions are the source of
-- truth, and text avoids enum ALTER TYPE friction as the state list grows.

alter table public.animals
  add column predicted_genetics text,
  add column confirmed_genetics text,
  add column genetics_source text,
  add column genetic_score numeric;

-- ---------------------------------------------------------------------------
-- genetic_tests — laboratory results (blood test / DNA analysis / genetic
-- certificate), one row per test performed.
-- ---------------------------------------------------------------------------
create table public.genetic_tests (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  laboratory_name text not null,
  test_date date not null default current_date,
  result text not null,
  attachment_url text,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index genetic_tests_animal_id_idx on public.genetic_tests (animal_id) where deleted_at is null;

alter table public.genetic_tests enable row level security;

create trigger set_updated_at before update on public.genetic_tests
  for each row execute function public.set_updated_at();
create trigger guard_soft_delete_owner_only before update on public.genetic_tests
  for each row execute function public.guard_soft_delete_owner_only();

create policy "genetic_tests_select_farm" on public.genetic_tests
  for select using (farm_id = public.current_farm_id());
create policy "genetic_tests_insert_owner_operator_vet" on public.genetic_tests
  for insert with check (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "genetic_tests_update_owner_operator_vet" on public.genetic_tests
  for update using (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "genetic_tests_delete_owner" on public.genetic_tests
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- genetics_history — audit trail every time confirmed_genetics changes
-- (spec section 6: "track modification history, store timestamps"). Insert
-- only, no update/delete policy — history rows are never edited.
-- ---------------------------------------------------------------------------
create table public.genetics_history (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  previous_confirmed text,
  new_confirmed text not null,
  source text not null,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index genetics_history_animal_id_idx on public.genetics_history (animal_id);

alter table public.genetics_history enable row level security;

create policy "genetics_history_select_farm" on public.genetics_history
  for select using (farm_id = public.current_farm_id());
create policy "genetics_history_insert_owner_operator_vet" on public.genetics_history
  for insert with check (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator', 'vet')
  );

-- ---------------------------------------------------------------------------
-- Storage bucket for genetic test attachments (PDF certificate / image).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('genetic-test-attachments', 'genetic-test-attachments', false)
on conflict (id) do nothing;

create policy "genetic_test_attachments_select_farm" on storage.objects
  for select using (
    bucket_id = 'genetic-test-attachments'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
  );

create policy "genetic_test_attachments_insert_owner_operator_vet" on storage.objects
  for insert with check (
    bucket_id = 'genetic-test-attachments'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() in ('owner', 'operator', 'vet')
  );

create policy "genetic_test_attachments_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'genetic-test-attachments'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() = 'owner'
  );
