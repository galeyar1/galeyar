-- Adds horse as a supported species, expands feed types (+ a free-text
-- custom type + per-unit cost for value/forecast reporting), restructures
-- birth_records to capture male/female offspring counts separately (so
-- offspring animal records can be auto-created per the new registration
-- flow), and closes a real RBAC gap: soft-delete (setting deleted_at) was
-- only blocked at the DB layer via the `delete` policies, but our app never
-- issues a hard DELETE — it does `UPDATE ... SET deleted_at = now()`, which
-- was covered by the more permissive owner+operator UPDATE policies. That
-- let an operator soft-delete records despite the spec saying operators
-- "cannot delete reports". A trigger enforces this independently of which
-- role can update other fields.

alter type public.species add value 'horse';
alter type public.feed_type add value 'barley';
alter type public.feed_type add value 'corn';
alter type public.feed_type add value 'wheat_bran';
alter type public.feed_type add value 'salt';
alter type public.feed_type add value 'mineral_supplements';
alter type public.feed_type add value 'custom';

alter table public.feed_inventory add column custom_label text;
alter table public.feed_inventory add column unit_cost numeric(12, 2);

alter table public.birth_records add column male_offspring_count integer not null default 0;
alter table public.birth_records add column female_offspring_count integer not null default 0;

-- Backfill existing rows before dropping the old columns. The old schema
-- only recorded a total + a "mixed" gender bucket with no true split, so a
-- mixed-gender row is approximated as evenly as possible (ceil/floor) —
-- the total offspring count is preserved exactly either way.
update public.birth_records
set
  male_offspring_count = case
    when gender = 'male' then offspring_count
    when gender = 'female' then 0
    else ceil(offspring_count / 2.0)::int
  end,
  female_offspring_count = case
    when gender = 'female' then offspring_count
    when gender = 'male' then 0
    else offspring_count - ceil(offspring_count / 2.0)::int
  end;

alter table public.birth_records drop column offspring_count;
alter table public.birth_records drop column gender;

alter table public.birth_records add constraint birth_records_offspring_positive
  check (male_offspring_count + female_offspring_count > 0);

create or replace function public.guard_soft_delete_owner_only()
returns trigger
language plpgsql
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and public.current_role() <> 'owner' then
    raise exception 'only a farm owner can delete this record';
  end if;
  return new;
end;
$$;

create trigger guard_soft_delete_owner_only before update on public.animals
  for each row execute function public.guard_soft_delete_owner_only();
create trigger guard_soft_delete_owner_only before update on public.milk_records
  for each row execute function public.guard_soft_delete_owner_only();
create trigger guard_soft_delete_owner_only before update on public.weight_records
  for each row execute function public.guard_soft_delete_owner_only();
create trigger guard_soft_delete_owner_only before update on public.disease_records
  for each row execute function public.guard_soft_delete_owner_only();
create trigger guard_soft_delete_owner_only before update on public.birth_records
  for each row execute function public.guard_soft_delete_owner_only();
create trigger guard_soft_delete_owner_only before update on public.treatments
  for each row execute function public.guard_soft_delete_owner_only();
