-- Helper functions used throughout RLS policies + housekeeping triggers.

-- SECURITY DEFINER so it can read public.users without recursively
-- re-triggering RLS on the same table.
create or replace function public.current_farm_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select farm_id from public.users where id = auth.uid();
$$;

create or replace function public.current_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- Generic updated_at bump, attached to every mutable table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.animals
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.milk_records
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.weight_records
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.disease_records
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.birth_records
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.treatments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.feed_inventory
  for each row execute function public.set_updated_at();

-- Every auth.users row (created by the send-otp/verify-otp edge functions)
-- gets a matching public.users profile row automatically.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone_number, role, farm_id)
  values (new.id, new.phone, 'owner', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Prevents a user from granting themselves a farm/role after the fact from
-- the client. The only self-service transition allowed is the one-time
-- "create my farm" onboarding step (farm_id: null -> a value). Any further
-- change to role or farm_id must go through an edge function running with
-- the service-role key (e.g. the owner's user-management screen).
create or replace function public.guard_users_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.farm_id is not null and new.farm_id is distinct from old.farm_id then
    raise exception 'farm_id can only be changed by a farm administrator';
  end if;

  if new.role is distinct from old.role then
    raise exception 'role can only be changed by a farm administrator';
  end if;

  return new;
end;
$$;

create trigger guard_users_privilege_escalation
  before update on public.users
  for each row execute function public.guard_users_privilege_escalation();
