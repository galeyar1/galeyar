-- The admin Data Health Center's "repair missing farm_membership" action
-- (galeyar-admin: src/app/(admin)/data-health/page.tsx) needs to insert a
-- farm_members row on behalf of an owner whose users.farm_id points at a
-- farm they have no membership row for. The only existing insert policy,
-- farm_members_insert_own_owner, requires user_id = auth.uid(), which can
-- never be true when an admin repairs someone else's record. Restricted to
-- super_admin only (not is_platform_admin(), which also covers admin/
-- support/finance/read_only) since this is a direct data-repair write, not
-- a read — matching rbac.ts's data_health module, where only super_admin
-- gets canManage("data_health").
create policy "farm_members_insert_platform_admin" on public.farm_members
  for insert with check (public.current_admin_role() = 'super_admin');
