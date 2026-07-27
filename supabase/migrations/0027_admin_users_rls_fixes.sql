-- Two real gaps found during a full bug-hunt pass on the admin panel:
--
-- 1. admin_users_select_self_or_staff (0016) used `is_admin_user()`, which
--    is true for ANY active admin regardless of role — so a support/
--    finance/read_only admin could load /admins directly (bypassing the
--    sidebar, which only hides the link) and see every admin's name/email/
--    role. rbac.ts's matrix has always intended "admins" to be
--    super_admin-only; the DB read policy just never matched that intent.
--    Tightened to super_admin, plus every admin can still read their own
--    row (needed for AdminAuthProvider to resolve role on login).
--
-- 2. admin_users had no self-update policy at all — only
--    admin_users_write_super_admin (super_admin-only). This silently
--    broke AdminAuthProvider's last_login_at update on every login for
--    every non-super_admin role (0 rows affected, no error surfaced), so
--    the Admins page has always shown "—" for their last login. Adding a
--    narrow self-update policy + a guard trigger so it can only ever
--    change last_login_at (and updated_at) — never role/is_active/email/
--    full_name — for anyone but a super_admin.
drop policy "admin_users_select_self_or_staff" on public.admin_users;
create policy "admin_users_select_self_or_super_admin" on public.admin_users
  for select using (id = auth.uid() or public.current_admin_role() = 'super_admin');

create policy "admin_users_update_own_last_login" on public.admin_users
  for update using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.guard_admin_users_self_update()
returns trigger
language plpgsql
as $$
begin
  if public.current_admin_role() = 'super_admin' then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
    or new.full_name is distinct from old.full_name
    or new.email is distinct from old.email then
    raise exception 'only a super_admin can change this field';
  end if;

  return new;
end;
$$;

create trigger guard_admin_users_self_update_trigger
  before update on public.admin_users
  for each row execute function public.guard_admin_users_self_update();
