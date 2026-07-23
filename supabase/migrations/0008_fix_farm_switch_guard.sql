-- 0007's relaxed guard still special-cased "old.farm_id is null -> always
-- allowed" for the one-time onboarding transition. That's exactly the gap a
-- live test in this session caught: a brand-new user (farm_id still null)
-- could set their own farm_id to ANY existing farm's UUID with no
-- membership check at all, self-assigning into a farm they were never
-- invited to (only mitigated in practice by farm ids being random UUIDs,
-- not by any actual rule). Since the app always inserts a farm_members row
-- *before* updating users.farm_id — for both the first farm and any
-- additional one — the membership check can simply apply uniformly to
-- every farm_id transition, first one included, with no special case.

create or replace function public.guard_users_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role can only be changed by a farm administrator';
  end if;

  if new.farm_id is distinct from old.farm_id then
    if new.farm_id is not null and old.role = 'owner' and exists (
      select 1 from public.farm_members where farm_id = new.farm_id and user_id = old.id
    ) then
      null; -- owner attaching to (or switching to) a farm they're a member of
    else
      raise exception 'farm_id can only be changed by a farm administrator';
    end if;
  end if;

  return new;
end;
$$;
