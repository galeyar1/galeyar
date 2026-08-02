-- Herd Age Balance & Replacement Intelligence: no per-animal age data is
-- duplicated here — everything is derived at read time from animals.
-- birth_date/species/breed/gender/status, birth_records, weight_records,
-- disease_records, and the existing is_pregnant/pregnancy_month columns.
-- Only two genuinely new, non-derivable pieces of state are added:

-- 1. The farmer's own herd objective — feeds ReplacementNeed's
-- GrowthRequirement term (spec: "if an existing herd-growth target exists,
-- reuse it; otherwise design the architecture so it can be added later").
-- Nullable/no default beyond 'maintain' semantics: null target_percent
-- with objective='maintain' means "hold steady," never inferred silently.
alter table public.farms
  add column herd_growth_objective text check (herd_growth_objective in ('maintain', 'grow', 'reduce')),
  add column herd_growth_target_percent numeric;

-- 2. Optional point-in-time snapshots of the computed (deterministic,
-- client-side) scores, purely so a real historical trend can be shown
-- later — never backfilled or fabricated from current data. A farmer (or
-- owner) explicitly records one; nothing here runs automatically.
create table public.herd_age_snapshots (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  snapshot_date date not null default current_date,
  youth_index integer not null check (youth_index between 0 and 100),
  age_balance_score integer not null check (age_balance_score between 0 and 100),
  replacement_coverage_percent numeric,
  component_scores jsonb not null default '{}'::jsonb,
  confidence text not null check (confidence in ('high', 'medium', 'low', 'insufficient')),
  model_version text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index herd_age_snapshots_farm_date_idx on public.herd_age_snapshots (farm_id, snapshot_date) where deleted_at is null;

create trigger set_updated_at before update on public.herd_age_snapshots
  for each row execute function public.set_updated_at();

alter table public.herd_age_snapshots enable row level security;

-- Same farm_id = current_farm_id() / current_role() shape every other
-- farm-scoped table uses (see animals_select_farm etc, 0003) — read for
-- any farm member, write for owner/operator only, matching animals' own
-- insert policy since a snapshot is really just a summary of animals data.
create policy "herd_age_snapshots_select_farm" on public.herd_age_snapshots
  for select using (farm_id = public.current_farm_id());
create policy "herd_age_snapshots_insert_owner_operator" on public.herd_age_snapshots
  for insert with check (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
