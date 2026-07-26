-- Fixes a real multi-farm visibility bug: farms_select_own (0003) only
-- lets a user see the ONE farm they're currently switched into
-- (id = current_farm_id()), so an owner with 2+ farms could never see
-- their non-active farm(s) through any query that embeds farms(*) —
-- e.g. src/app/(app)/farms/page.tsx's `farm_members.select("farm_id,
-- user_id, farms(*)")`. The dashboard's farm count (a direct
-- farm_members count with no farms(*) embed) was never affected, which
-- is exactly why the two screens disagreed (dashboard: correct count of
-- 2, "farms" list: only 1 visible).
--
-- Additive only — farms_select_own is untouched, this just widens who
-- can also see a farm via confirmed farm_members ownership.
create policy "farms_select_member" on public.farms
  for select using (
    exists (
      select 1 from public.farm_members
      where farm_members.farm_id = farms.id
        and farm_members.user_id = auth.uid()
    )
  );
