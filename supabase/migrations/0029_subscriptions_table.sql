-- User & Subscription Management Upgrade — step 2 of 3: a real
-- `subscriptions` table as the system of record for status/source/history,
-- while farms.plan/subscription_started_at/subscription_expires_at stay
-- exactly as they are today and keep being what the main app reads for
-- every limit/feature check (zero changes needed there). Direction of
-- truth is one-way only, to avoid the two-sources-of-truth trap: admin
-- actions (and, later, real payments) write to `subscriptions`; a trigger
-- projects the current row back onto `farms` afterward. Nothing ever
-- writes farms.plan directly anymore except this trigger.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  -- restrict, not cascade: a plan referenced by any subscription (current
  -- or historical) can never be hard-deleted out from under that history.
  plan_id uuid not null references public.plans (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'suspended', 'cancelled', 'expired')),
  source text not null default 'admin' check (source in ('payment', 'admin', 'promotion')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  suspended_at timestamptz,
  suspended_by uuid references public.admin_users (id) on delete set null,
  suspension_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid references public.admin_users (id) on delete set null,
  cancellation_reason text,
  granted_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_farm_id_idx on public.subscriptions (farm_id, created_at desc);

create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- One subscription row per existing farm, carrying its current plan/dates
-- forward exactly as-is. source is 'admin' for all of these since there's
-- no way to know the true original source retroactively (real payment
-- gateway has never been wired up — see payment_transactions' own
-- "architecture only" comment).
insert into public.subscriptions (farm_id, plan_id, status, source, started_at, expires_at)
select f.id, p.id, 'active', 'admin', coalesce(f.subscription_started_at, f.created_at), f.subscription_expires_at
from public.farms f
join public.plans p on p.key = f.plan;

alter table public.subscriptions enable row level security;

create policy "subscriptions_select_platform_admin" on public.subscriptions
  for select using (public.is_platform_admin());
-- A farm's own owner/consultant can see their subscription history
-- (read-only — every write still goes through the admin panel).
create policy "subscriptions_select_own_farm" on public.subscriptions
  for select using (farm_id = public.current_farm_id());
create policy "subscriptions_write_platform_admin" on public.subscriptions
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Projects the most recent subscription row for a farm onto
-- farms.plan/subscription_started_at/subscription_expires_at. A farm can
-- accumulate history (a cancelled row, then a new granted one) — "current"
-- is simply the latest by created_at. Suspended/cancelled/expired all
-- collapse the effective plan to 'free' on farms, which is what every
-- existing limit/feature check in the main app already reads — this is
-- exactly how suspending a subscription "prevents paid-plan benefits"
-- without touching a single line of the main app's enforcement code.
create or replace function public.sync_farm_plan_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest record;
begin
  select s.status, s.expires_at, s.started_at, p.key as plan_key
  into latest
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.farm_id = coalesce(new.farm_id, old.farm_id)
  order by s.created_at desc
  limit 1;

  if latest is null then
    return coalesce(new, old);
  end if;

  update public.farms
  set
    plan = case when latest.status = 'active' then latest.plan_key else 'free' end,
    subscription_started_at = latest.started_at,
    subscription_expires_at = case when latest.status = 'active' then latest.expires_at else null end
  where id = coalesce(new.farm_id, old.farm_id);

  return coalesce(new, old);
end;
$$;

create trigger sync_farm_plan_from_subscription_trigger
  after insert or update on public.subscriptions
  for each row execute function public.sync_farm_plan_from_subscription();

-- Keeps every new farm consistent with the model going forward (matches
-- the existing default: a newly created farm starts on the free plan).
create or replace function public.create_default_subscription_for_farm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (farm_id, plan_id, status, source, started_at)
  select new.id, p.id, 'active', 'admin', now()
  from public.plans p
  where p.key = 'free'
  limit 1;
  return new;
end;
$$;

create trigger create_default_subscription_for_farm_trigger
  after insert on public.farms
  for each row execute function public.create_default_subscription_for_farm();
