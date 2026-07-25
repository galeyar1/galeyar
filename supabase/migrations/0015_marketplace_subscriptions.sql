-- GALEYAR v3.0 — Marketplace & Subscription Platform groundwork.
-- Plain text columns for plan/category/status (not enums), matching every
-- prior round's precedent — the app-level TS unions are the source of truth.
--
-- Scope note: per the spec's own IMPORTANT, no real payment gateway is wired
-- up (payment_transactions/providers are architecture-only scaffolding),
-- marketplace has no purchase/checkout flow (browse + seller contact only),
-- and advertisements stay in "Coming Soon" mode. Existing farms are
-- grandfathered onto the professional plan so no current functionality
-- regresses; only newly-created farms default to the free plan.

-- ---------------------------------------------------------------------------
-- Subscription plan on farms.
-- ---------------------------------------------------------------------------
alter table public.farms
  add column plan text not null default 'free',
  add column subscription_started_at timestamptz,
  add column subscription_expires_at timestamptz;

update public.farms set plan = 'professional', subscription_started_at = now();

-- ---------------------------------------------------------------------------
-- Platform admin flag (no admin role existed before — every prior role is
-- farm-scoped). Kept as a boolean flag rather than a 5th user_role value so
-- existing role-based RLS/UI branches are completely unaffected.
-- ---------------------------------------------------------------------------
alter table public.users add column is_platform_admin boolean not null default false;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_platform_admin from public.users where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- payment_transactions — architecture only; no gateway is called yet.
-- ---------------------------------------------------------------------------
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  plan text not null,
  amount numeric not null,
  currency text not null default 'IRT',
  provider text not null,
  status text not null default 'pending',
  transaction_id text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transactions_farm_id_idx on public.payment_transactions (farm_id);

alter table public.payment_transactions enable row level security;

create trigger set_updated_at before update on public.payment_transactions
  for each row execute function public.set_updated_at();

create policy "payment_transactions_select_farm" on public.payment_transactions
  for select using (farm_id = public.current_farm_id());
create policy "payment_transactions_select_platform_admin" on public.payment_transactions
  for select using (public.is_platform_admin());
create policy "payment_transactions_insert_owner" on public.payment_transactions
  for insert with check (farm_id = public.current_farm_id() and public.current_role() = 'owner');
create policy "payment_transactions_update_owner" on public.payment_transactions
  for update using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- marketplace_listings — one polymorphic table for all 5 categories
-- (animal/feed/equipment/service/medicine), category-specific fields kept in
-- `attributes` jsonb rather than 5 near-duplicate tables. Browse-only: no
-- order/cart/checkout tables exist yet (spec: marketplace purchases stay
-- "Coming Soon").
-- ---------------------------------------------------------------------------
create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  price numeric,
  currency text not null default 'IRT',
  province text,
  city text,
  contact_phone text,
  images jsonb not null default '[]'::jsonb,
  attributes jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index marketplace_listings_category_idx on public.marketplace_listings (category) where deleted_at is null and status = 'active';
create index marketplace_listings_farm_id_idx on public.marketplace_listings (farm_id) where deleted_at is null;

alter table public.marketplace_listings enable row level security;

create trigger set_updated_at before update on public.marketplace_listings
  for each row execute function public.set_updated_at();
create trigger guard_soft_delete_owner_only before update on public.marketplace_listings
  for each row execute function public.guard_soft_delete_owner_only();

-- Listings are cross-farm by design (that's the point of a marketplace), so
-- this intentionally does NOT follow the usual farm-scoped select template:
-- any authenticated user can browse active listings; a seller can also see
-- their own farm's non-active listings (draft/sold/removed).
create policy "marketplace_listings_select_active_or_own" on public.marketplace_listings
  for select using (
    (status = 'active' and deleted_at is null) or farm_id = public.current_farm_id()
  );
create policy "marketplace_listings_select_platform_admin" on public.marketplace_listings
  for select using (public.is_platform_admin());
-- Posting is a professional-plan capability (spec section 1: "Marketplace
-- Access" under PROFESSIONAL) — enforced here too, not just client-side.
create policy "marketplace_listings_insert_professional" on public.marketplace_listings
  for insert with check (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'operator')
    and (select plan from public.farms where id = public.current_farm_id()) = 'professional'
  );
create policy "marketplace_listings_update_owner_operator" on public.marketplace_listings
  for update using (
    farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator')
  );
create policy "marketplace_listings_delete_owner" on public.marketplace_listings
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- Referral system — "Invite a farmer" -> 30 days free premium.
-- ---------------------------------------------------------------------------
create table public.referral_codes (
  user_id uuid primary key references public.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

create policy "referral_codes_select_own" on public.referral_codes
  for select using (user_id = auth.uid());
create policy "referral_codes_insert_own" on public.referral_codes
  for insert with check (user_id = auth.uid());

create table public.referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  referrer_user_id uuid not null references public.users (id) on delete cascade,
  referred_user_id uuid not null references public.users (id) on delete cascade,
  reward_days integer not null default 30,
  redeemed_at timestamptz not null default now(),
  unique (referred_user_id)
);

alter table public.referral_redemptions enable row level security;

create policy "referral_redemptions_select_own" on public.referral_redemptions
  for select using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());

-- Validates + records a redemption + extends the referrer's farm expiration,
-- all in one transaction so the reward can never be granted without a valid
-- redemption row (or vice versa). security definer since the redeemer
-- generally can't see the referrer's users/farms rows directly.
create or replace function public.redeem_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referrer_farm_id uuid;
begin
  select user_id into v_referrer_id from public.referral_codes where code = p_code;
  if v_referrer_id is null or v_referrer_id = auth.uid() then
    return false;
  end if;
  if exists (select 1 from public.referral_redemptions where referred_user_id = auth.uid()) then
    return false;
  end if;

  insert into public.referral_redemptions (code, referrer_user_id, referred_user_id)
  values (p_code, v_referrer_id, auth.uid());

  select farm_id into v_referrer_farm_id from public.users where id = v_referrer_id;
  if v_referrer_farm_id is not null then
    update public.farms
    set subscription_expires_at = greatest(coalesce(subscription_expires_at, now()), now()) + interval '30 days'
    where id = v_referrer_farm_id;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- advertisements — admin-managed, "Coming Soon" (not yet rendered to users).
-- ---------------------------------------------------------------------------
create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  link_url text,
  sponsor_name text,
  status text not null default 'draft',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advertisements enable row level security;

create trigger set_updated_at before update on public.advertisements
  for each row execute function public.set_updated_at();

create policy "advertisements_select_platform_admin" on public.advertisements
  for select using (public.is_platform_admin());
create policy "advertisements_write_platform_admin" on public.advertisements
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Platform-admin cross-farm read access, added additively (existing
-- farm-scoped policies are untouched — Postgres OR's multiple permissive
-- policies together for the same action).
-- ---------------------------------------------------------------------------
create policy "farms_select_platform_admin" on public.farms
  for select using (public.is_platform_admin());
-- Lets the admin panel manually grant/change a farm's plan (the only "grant
-- a plan" mechanism that exists while payments are stubbed) and moderate
-- marketplace listings (spec: "Manage Plans" / "Moderate Content").
create policy "farms_update_platform_admin" on public.farms
  for update using (public.is_platform_admin());
create policy "marketplace_listings_update_platform_admin" on public.marketplace_listings
  for update using (public.is_platform_admin());

-- Lets a browsing buyer resolve a listing's seller farm name via the
-- Supabase embedded-resource join (marketplace_listings -> farms). This
-- necessarily exposes the whole farms row (incl. plan/subscription dates,
-- not just farm_name) to anyone browsing that farm's listing — an accepted
-- low-sensitivity trade-off rather than building a separate public sellers
-- view for this round.
create policy "farms_select_marketplace_sellers" on public.farms
  for select using (
    exists (
      select 1 from public.marketplace_listings
      where marketplace_listings.farm_id = farms.id
        and marketplace_listings.status = 'active'
        and marketplace_listings.deleted_at is null
    )
  );
create policy "users_select_platform_admin" on public.users
  for select using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- New notification types for subscription/marketplace/payment events.
-- Standalone statements (each ALTER TYPE ... ADD VALUE commits on its own),
-- so later statements in this file may safely reference the users table etc.
-- ---------------------------------------------------------------------------
alter type public.notification_type add value 'subscription_expiring';
alter type public.notification_type add value 'marketplace_listing';
alter type public.notification_type add value 'premium_feature';
alter type public.notification_type add value 'payment_success';

-- ---------------------------------------------------------------------------
-- Storage bucket for marketplace listing photos — PUBLIC (unlike every
-- other bucket in this app so far), because listings must be visible to
-- buyers outside the seller's own farm; the usual
-- `(storage.foldername(name))[1] = current_farm_id()` read-policy pattern
-- doesn't apply to genuinely cross-farm content.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('marketplace-images', 'marketplace-images', true)
on conflict (id) do nothing;

create policy "marketplace_images_insert_professional" on storage.objects
  for insert with check (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() in ('owner', 'operator')
    and (select plan from public.farms where id = public.current_farm_id()) = 'professional'
  );

create policy "marketplace_images_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'marketplace-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() = 'owner'
  );
