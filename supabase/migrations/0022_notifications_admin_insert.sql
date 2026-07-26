-- The admin User 360 profile's "Send Notification" action lets an admin
-- push a system message to a farm's in-app notification feed
-- (notifications.type = 'system'). No insert policy exists on this table
-- at all today — every existing row was seeded some other way (app-level
-- triggers not yet built, or manual inserts) — so without this, the admin
-- client would get a silent RLS-denied insert.
create policy "notifications_insert_platform_admin" on public.notifications
  for insert with check (public.is_platform_admin());
