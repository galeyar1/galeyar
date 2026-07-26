-- farm_members had no platform-admin bypass policy (unlike farms, users,
-- marketplace_listings, payment_transactions, which all got one in v3.0/
-- v4.0) — only farm_members_select_own (user_id = auth.uid()). The admin
-- panel's users list/profile query farm_members with no per-user filter to
-- see every farm each account belongs to; under RLS that returned zero
-- rows for every user (an admin_users identity isn't a farm_members row
-- owner), so the UI's fallback to the single active farm_id kicked in and
-- silently showed "1 farm" for everyone regardless of the real count —
-- reproducing the same symptom the farms_select_member fix (0018) already
-- solved for the main app, but for this separate admin-side query.
create policy "farm_members_select_platform_admin" on public.farm_members
  for select using (public.is_platform_admin());
