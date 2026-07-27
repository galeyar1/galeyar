-- User & Subscription Management Upgrade — step 1 of 3: a real `plans`
-- table, replacing the hardcoded PLAN_LIMITS/PLAN_FEATURES constants as the
-- authoritative source. `key` is the STABLE identifier every existing
-- relationship (farms.plan today, subscriptions.plan_id next) points at —
-- renaming a plan's display `name` later never touches `key`, so renaming
-- "طلایی" to "الماس" cannot break anything referencing it.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  price numeric not null default 0,
  currency text not null default 'IRT',
  duration_days integer,
  max_animals integer,
  max_farms integer,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- Seed rows carry forward the exact values already live in
-- src/lib/subscription-plans.ts (PLAN_LIMITS/PLAN_FEATURES) — no existing
-- farm's effective limits/features change the moment this migration runs.
insert into public.plans (key, name, price, duration_days, max_animals, max_farms, features, sort_order) values
  ('free', 'رایگان', 0, null, 30, 1, '[]'::jsonb, 0),
  ('silver', 'نقره‌ای', 0, 30, 200, 1, '["reports","feed_management"]'::jsonb, 1),
  ('gold', 'طلایی', 0, 30, 1000, 3, '["reports","feed_management","ai_assistant","advanced_reports"]'::jsonb, 2),
  ('professional', 'حرفه‌ای', 0, 30, null, null,
    '["reports","feed_management","ai_assistant","advanced_reports","genetic_intelligence","pedigree","premium_support","marketplace_access","inbreeding_detection","advanced_forecasting","financial_intelligence"]'::jsonb,
    3);

alter table public.plans enable row level security;

-- Readable by everyone, same reasoning as system_settings/feature_flags —
-- the main app needs to read live limits/features without another
-- migration every time an admin edits a plan.
create policy "plans_select_all" on public.plans
  for select using (true);
create policy "plans_write_platform_admin" on public.plans
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
