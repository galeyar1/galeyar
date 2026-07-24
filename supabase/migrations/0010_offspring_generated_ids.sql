-- Automatic offspring identification system: SPECIES-MOTHERID-YEAR-GENDER+NUMBER
-- (e.g. "SH-125-05-M1"), assigned at birth registration and stored as the
-- animal's ear_tag going forward. These columns are the structured audit
-- trail behind that ear_tag; only animals auto-created from a birth record
-- have them set — manually-registered animals leave them null.

alter table public.animals
  add column generated_id text,
  add column species_code text,
  add column birth_year text,
  add column offspring_number integer,
  add column gender_code text;

-- Uniqueness only needs to hold among live (non-deleted) auto-generated IDs,
-- matching the existing ear_tag uniqueness pattern.
create unique index animals_farm_generated_id_idx
  on public.animals (farm_id, generated_id)
  where deleted_at is null and generated_id is not null;

-- Speeds up "what's the highest offspring_number for this mother+year+gender"
-- lookups, which run on every new birth registration.
create index animals_mother_year_gender_idx
  on public.animals (farm_id, mother_id, birth_year, gender_code)
  where deleted_at is null;

alter table public.birth_records
  add column offspring_generated_ids text[];
