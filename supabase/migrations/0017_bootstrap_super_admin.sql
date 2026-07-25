-- GALEYAR v4.0 — Bootstraps the first Control Center admin. admin_users'
-- own RLS policy requires an existing super_admin to write to that table
-- (chicken-and-egg for the very first one), so this one-time seed runs as
-- a migration instead, which executes with elevated privileges and
-- bypasses RLS. The auth.users row itself was created manually via the
-- Supabase Dashboard (Authentication -> Add User) before this ran.
insert into public.admin_users (id, full_name, email, role, is_active)
values ('26376d16-e130-421a-a1b5-817e7e01afc3', 'مدیر ارشد گله‌یار', 'admingaleyar@gmail.com', 'super_admin', true)
on conflict (id) do update set role = 'super_admin', is_active = true;
