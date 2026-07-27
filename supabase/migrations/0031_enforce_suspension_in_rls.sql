-- User & Subscription Management Upgrade — server-side suspension
-- enforcement. Previously "suspended" was checked ONLY client-side
-- (auth-provider.tsx signs the user out when their profile next loads) —
-- a suspended user's still-valid session could keep calling the Supabase
-- API directly and every farm-scoped RLS policy would still allow it,
-- since none of them ever checked status.
--
-- current_farm_id() and current_role() are the two functions nearly every
-- farm-scoped RLS policy in the entire schema is built on (farms, animals,
-- birth/disease/feed records, notifications, ai_insights, payments,
-- marketplace, support tickets, storage bucket policies, and the delete-
-- guard trigger from 0006) — adding "and status = 'active'" here makes a
-- suspended user's identity resolve to NULL everywhere at once, which
-- correctly denies all of it in one place instead of touching dozens of
-- individual policies.
--
-- Verified NOT to affect: admin access (is_platform_admin() reads
-- public.users.is_platform_admin / admin_users directly, never calls
-- either of these two functions), or a suspended user's ability to read
-- their OWN row (users_select_self_or_farm's "id = auth.uid()" branch is
-- a direct comparison, not routed through current_farm_id()/current_role()
-- — this is what lets auth-provider.tsx detect status='suspended' and
-- sign them out at all).
create or replace function public.current_farm_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select farm_id from public.users where id = auth.uid() and status = 'active';
$$;

create or replace function public.current_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid() and status = 'active';
$$;
