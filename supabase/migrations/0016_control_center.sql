-- GALEYAR v4.0 — Control Center: schema additions for the separate
-- admin.galeyar.ir application (its own Next.js codebase, same Supabase
-- project). Plain text columns for role/status/type, matching every prior
-- round's precedent — the app-level TS unions are the source of truth.

-- ---------------------------------------------------------------------------
-- admin_users — dedicated staff identities. Deliberately NOT the same
-- table as public.users (farm users): an admin doesn't need to belong to
-- a farm at all, so this references auth.users directly.
-- ---------------------------------------------------------------------------
create table public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'read_only',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create trigger set_updated_at before update on public.admin_users
  for each row execute function public.set_updated_at();

create or replace function public.current_admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.admin_users where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and is_active = true);
$$;

-- Widened (not replaced) so every existing v3.0 admin-bypass RLS policy —
-- farms, users, marketplace_listings, payment_transactions, advertisements —
-- automatically also accepts the new dedicated admin_users identities,
-- with zero additional policies needed on those tables.
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce((select is_platform_admin from public.users where id = auth.uid()), false)
    or public.is_admin_user();
$$;

create policy "admin_users_select_self_or_staff" on public.admin_users
  for select using (id = auth.uid() or public.is_admin_user());
create policy "admin_users_write_super_admin" on public.admin_users
  for all using (public.current_admin_role() = 'super_admin')
  with check (public.current_admin_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- admin_audit_logs — immutable trail of every admin action.
-- ---------------------------------------------------------------------------
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.admin_users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_at_idx on public.admin_audit_logs (created_at desc);

alter table public.admin_audit_logs enable row level security;

create policy "admin_audit_logs_select_admin" on public.admin_audit_logs
  for select using (public.is_admin_user());
create policy "admin_audit_logs_insert_admin" on public.admin_audit_logs
  for insert with check (public.is_admin_user() and admin_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- system_settings — singleton config row, toggled from the admin site.
-- Readable by everyone (harmless config, and lets the main app enforce
-- these flags in a future round without another migration); writable by
-- admins only.
-- ---------------------------------------------------------------------------
create table public.system_settings (
  id boolean primary key default true,
  registration_enabled boolean not null default true,
  maintenance_mode boolean not null default false,
  ai_enabled boolean not null default true,
  marketplace_enabled boolean not null default true,
  subscriptions_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users (id) on delete set null,
  constraint system_settings_singleton check (id)
);

insert into public.system_settings (id) values (true);

alter table public.system_settings enable row level security;

create trigger set_updated_at before update on public.system_settings
  for each row execute function public.set_updated_at();

create policy "system_settings_select_all" on public.system_settings
  for select using (true);
create policy "system_settings_update_admin" on public.system_settings
  for update using (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- content_articles — announcements / help articles / educational content /
-- FAQ / news, managed from the admin site's Content Management module.
-- ---------------------------------------------------------------------------
create table public.content_articles (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  status text not null default 'draft',
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_articles enable row level security;

create trigger set_updated_at before update on public.content_articles
  for each row execute function public.set_updated_at();

create policy "content_articles_select_published_or_admin" on public.content_articles
  for select using (status = 'published' or public.is_admin_user());
create policy "content_articles_write_admin" on public.content_articles
  for all using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------------------------------------------------------------------------
-- advertisements (from v3.0) — add scheduling, and relax created_by's FK
-- to auth.users so a pure admin_users identity (no public.users row) can
-- create one, same as a legacy is_platform_admin farm-user could.
-- ---------------------------------------------------------------------------
alter table public.advertisements
  add column starts_at timestamptz,
  add column ends_at timestamptz;

alter table public.advertisements drop constraint advertisements_created_by_fkey;
alter table public.advertisements
  add constraint advertisements_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- marketplace_listings (from v3.0) — moderation queue + featured flag.
-- Existing rows stay whatever status they already had (already implicitly
-- "approved" by having been live); only the default for new inserts
-- changes, so the main app's posting flow now starts a listing as pending
-- until an admin approves it. No RLS change needed: the existing
-- marketplace_listings_select_active_or_own policy already hides
-- non-active listings from everyone but the seller's own farm.
-- ---------------------------------------------------------------------------
alter table public.marketplace_listings alter column status set default 'pending';
alter table public.marketplace_listings add column featured boolean not null default false;

-- ---------------------------------------------------------------------------
-- users (farm users) — suspend/activate + last-login tracking for the
-- admin site's User Management module.
-- ---------------------------------------------------------------------------
alter table public.users
  add column status text not null default 'active',
  add column last_login_at timestamptz;

create policy "users_update_platform_admin" on public.users
  for update using (public.is_platform_admin());

-- users_update_self (0003) lets a user update any column on their own row
-- except role/farm_id (guarded below since 0002/0007) — status and
-- is_platform_admin were missed when they were added (v3.0/v4.0), which
-- would otherwise let a suspended user un-suspend themselves, or any user
-- grant themselves admin. Closing that gap here.
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

  if new.status is distinct from old.status and not public.is_platform_admin() then
    raise exception 'status can only be changed by an administrator';
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin and not public.is_platform_admin() then
    raise exception 'is_platform_admin can only be changed by an administrator';
  end if;

  if new.farm_id is distinct from old.farm_id then
    if old.farm_id is null then
      null; -- first-time onboarding / invite acceptance
    elsif old.role = 'owner' and new.farm_id is not null and exists (
      select 1 from public.farm_members where farm_id = new.farm_id and user_id = old.id
    ) then
      null; -- switching between farms this owner belongs to
    else
      raise exception 'farm_id can only be changed by a farm administrator';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- support_tickets / support_ticket_messages (from v2.0) — admin bypass +
-- assignment, and relax sender_id's FK the same way as advertisements.
-- ---------------------------------------------------------------------------
alter table public.support_tickets add column assigned_to uuid references public.admin_users (id) on delete set null;

create policy "support_tickets_select_admin" on public.support_tickets
  for select using (public.is_admin_user());
create policy "support_tickets_update_admin" on public.support_tickets
  for update using (public.is_admin_user());

alter table public.support_ticket_messages drop constraint support_ticket_messages_sender_id_fkey;
alter table public.support_ticket_messages
  add constraint support_ticket_messages_sender_id_fkey foreign key (sender_id) references auth.users (id) on delete set null;

create policy "support_ticket_messages_select_admin" on public.support_ticket_messages
  for select using (public.is_admin_user());
create policy "support_ticket_messages_insert_admin" on public.support_ticket_messages
  for insert with check (public.is_admin_user());
