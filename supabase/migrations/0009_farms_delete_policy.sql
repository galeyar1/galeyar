-- farms had select/insert/update policies but no delete policy at all —
-- the "Edit & Delete for ALL entities, including Farms" requirement exposed
-- the gap: an owner could not actually delete a farm they own. Cascades
-- (farm_members, animals, and everything under a farm_id FK) already exist
-- from the original schema, so this is purely the missing policy.
--
-- Deliberately membership-based (farm_members), not current_farm_id()-based:
-- an owner with several farms must be able to delete one they aren't
-- currently viewing, without switching into it first.

create policy "farms_delete_owner" on public.farms
  for delete using (
    exists (
      select 1 from public.farm_members
      where farm_members.farm_id = farms.id and farm_members.user_id = auth.uid()
    )
    and public.current_role() = 'owner'
  );
