-- Phase E: User Segmentation + Feature Flags — both admin-only tools,
-- neither existed in any form before this.

-- ---------------------------------------------------------------------------
-- user_segments — a saved filter (plan/province/animal-count/activity)
-- for targeting, e.g. from the Notification Center. Membership is computed
-- live client-side from the criteria (farms/users/animals are all small
-- enough to fetch in full already, same pattern as the Analytics and
-- Users pages) rather than stored as a snapshot, so a segment always
-- reflects current data.
-- ---------------------------------------------------------------------------
create table public.user_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  criteria jsonb not null default '{}'::jsonb,
  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_segments enable row level security;

create trigger set_updated_at before update on public.user_segments
  for each row execute function public.set_updated_at();

create policy "user_segments_all_platform_admin" on public.user_segments
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- feature_flags — readable by everyone (same reasoning as system_settings:
-- harmless config, lets the main app check a flag without another
-- migration), writable by admins only. rollout_percentage exists for a
-- future gradual-rollout helper — nothing in either app currently reads
-- these flags to gate real behavior; this is the admin-side management UI
-- and schema only, ready for that to be wired up when a concrete feature
-- needs it.
-- ---------------------------------------------------------------------------
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  enabled boolean not null default false,
  rollout_percentage smallint not null default 100 check (rollout_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users (id) on delete set null
);

alter table public.feature_flags enable row level security;

create trigger set_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

create policy "feature_flags_select_all" on public.feature_flags
  for select using (true);
create policy "feature_flags_write_platform_admin" on public.feature_flags
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
