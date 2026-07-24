-- Pedigree module: father_id/mother_id have no index yet (only farm_id and
-- (farm_id, ear_tag) do), so every ancestor/descendant lookup was a
-- sequential scan. ear_tag itself is already covered by the unique index
-- from migration 0001 (animals_farm_ear_tag_idx) for the same farm-scoped
-- access pattern every query in this app uses.

create index animals_father_id_idx on public.animals (father_id) where deleted_at is null;
create index animals_mother_id_idx on public.animals (mother_id) where deleted_at is null;
