-- Farm deactivation (reversible) — distinct from deletion (which already
-- existed via farms_delete_owner, 0009, with cascades already wired
-- through every farm_id FK in the schema; this migration doesn't touch
-- that path). A deactivated farm keeps every row exactly as-is; only
-- is_active flips, so it can be reactivated with zero data loss.
alter table public.farms
  add column is_active boolean not null default true,
  add column deactivated_at timestamptz;

-- farms_update_owner (0003) only allowed updating the CURRENTLY ACTIVE
-- farm (id = current_farm_id()) — an owner with several farms couldn't
-- deactivate one they weren't currently viewing. Replaced with the same
-- membership-based check farms_delete_owner (0009) already uses, for the
-- same reason: act on any farm you own without switching into it first.
drop policy "farms_update_owner" on public.farms;
create policy "farms_update_owner" on public.farms
  for update using (
    exists (
      select 1 from public.farm_members
      where farm_members.farm_id = farms.id and farm_members.user_id = auth.uid()
    )
    and public.current_role() = 'owner'
  );
