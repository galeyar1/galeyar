-- Group Deworming: registering one deworming event for many animals at once
-- must still create one fully independent deworming_records row per animal
-- (so each animal's own medical history shows it correctly) — this column
-- is purely a traceability link back to "these rows came from one group
-- submission," not a replacement for the per-animal record.
alter table public.deworming_records add column treatment_batch_id uuid;

create index deworming_records_batch_id_idx on public.deworming_records (treatment_batch_id) where deleted_at is null;
