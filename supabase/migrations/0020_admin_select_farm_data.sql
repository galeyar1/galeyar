-- Same bug class as 0018/0019, on `animals` this time: it has
-- animals_select_farm (farm_id = current_farm_id()) and
-- animals_select_owned_farms (keyed off the querying user's OWN
-- users.farm_id/farm_members), but no platform-admin bypass at all. A
-- pure admin_users identity has no public.users row, so current_farm_id()
-- resolves to null and every admin-side animal count/list (dashboard KPI,
-- users-list per-user animal totals, the upcoming Livestock/Farm 360
-- views) has been silently returning zero rows all along.
create policy "animals_select_platform_admin" on public.animals
  for select using (public.is_platform_admin());

-- Auditing every other farm-scoped table the admin dashboard/analytics
-- pages already query (or the upcoming Farm 360 / Data Health work will)
-- turned up the identical gap on all of these — none had a platform-admin
-- bypass either, so their admin-side counts have been silently wrong too.
-- Read-only: admins get visibility, not write access, on farm operational
-- data they don't own.
create policy "birth_records_select_platform_admin" on public.birth_records
  for select using (public.is_platform_admin());
create policy "disease_records_select_platform_admin" on public.disease_records
  for select using (public.is_platform_admin());
create policy "feed_inventory_select_platform_admin" on public.feed_inventory
  for select using (public.is_platform_admin());
create policy "feed_consumption_log_select_platform_admin" on public.feed_consumption_log
  for select using (public.is_platform_admin());
create policy "ai_insights_select_platform_admin" on public.ai_insights
  for select using (public.is_platform_admin());
create policy "genetic_tests_select_platform_admin" on public.genetic_tests
  for select using (public.is_platform_admin());
