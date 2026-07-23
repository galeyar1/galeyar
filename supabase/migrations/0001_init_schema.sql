-- Galeyar (گله‌یار) — core schema
-- Phase 1 foundation: farms, users, animals + shared audit/sync columns.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'operator', 'vet', 'consultant');
create type public.species as enum ('sheep', 'goat', 'cattle', 'camel');
create type public.animal_status as enum ('active', 'sold', 'dead');
create type public.disease_type as enum (
  'respiratory',
  'digestive',
  'fever',
  'infectious',
  'lameness',
  'other'
);
create type public.feed_type as enum ('hay', 'straw', 'flour', 'soybean', 'concentrate');
create type public.feed_unit as enum ('kg', 'ton', 'bag');
create type public.notification_type as enum ('feed_low', 'disease_alert', 'ai_suggestion', 'system');

-- ---------------------------------------------------------------------------
-- farms
-- ---------------------------------------------------------------------------
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  farm_name text not null,
  province text,
  city text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- users (1:1 profile row for every auth.users entry)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone_number text unique not null,
  role public.user_role not null default 'owner',
  farm_id uuid references public.farms (id) on delete set null,
  created_at timestamptz not null default now()
);

create index users_farm_id_idx on public.users (farm_id);

-- Pending invitations: an owner pre-registers a phone number + role for their
-- farm before that person ever logs in. When the phone verifies via OTP for
-- the first time, the verify-otp edge function consumes the matching invite
-- (service-role, bypasses RLS) and assigns farm_id/role automatically.
create table public.farm_invites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  phone_number text not null,
  role public.user_role not null,
  invited_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index farm_invites_pending_phone_idx
  on public.farm_invites (phone_number)
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- animals
-- ---------------------------------------------------------------------------
create table public.animals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  ear_tag text not null,
  name text,
  species public.species not null,
  animal_type text,
  breed text,
  gender text,
  birth_date date,
  father_id uuid references public.animals (id) on delete set null,
  mother_id uuid references public.animals (id) on delete set null,
  status public.animal_status not null default 'active',
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index animals_farm_ear_tag_idx on public.animals (farm_id, ear_tag) where deleted_at is null;
create index animals_farm_species_idx on public.animals (farm_id, species) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- milk_records
-- ---------------------------------------------------------------------------
create table public.milk_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  morning_milk numeric(6, 2),
  evening_milk numeric(6, 2),
  record_date date not null default current_date,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index milk_records_farm_date_idx on public.milk_records (farm_id, record_date);
create index milk_records_animal_idx on public.milk_records (animal_id);

-- ---------------------------------------------------------------------------
-- weight_records
-- ---------------------------------------------------------------------------
create table public.weight_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  weight numeric(6, 2) not null,
  record_date date not null default current_date,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index weight_records_farm_date_idx on public.weight_records (farm_id, record_date);
create index weight_records_animal_idx on public.weight_records (animal_id);

-- ---------------------------------------------------------------------------
-- disease_records
-- ---------------------------------------------------------------------------
create table public.disease_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  disease_type public.disease_type not null,
  description text,
  image_url text,
  record_date date not null default current_date,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index disease_records_farm_idx on public.disease_records (farm_id);
create index disease_records_animal_idx on public.disease_records (animal_id);

-- ---------------------------------------------------------------------------
-- birth_records
-- ---------------------------------------------------------------------------
create table public.birth_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  mother_id uuid not null references public.animals (id) on delete cascade,
  father_id uuid references public.animals (id) on delete set null,
  offspring_count integer not null default 1,
  gender text,
  birth_date date not null default current_date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index birth_records_farm_idx on public.birth_records (farm_id);
create index birth_records_mother_idx on public.birth_records (mother_id);

-- ---------------------------------------------------------------------------
-- treatments
-- ---------------------------------------------------------------------------
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  medication text not null,
  treatment_date date not null default current_date,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index treatments_farm_idx on public.treatments (farm_id);
create index treatments_animal_idx on public.treatments (animal_id);

-- ---------------------------------------------------------------------------
-- feed_inventory + consumption log
-- ---------------------------------------------------------------------------
create table public.feed_inventory (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  feed_type public.feed_type not null,
  quantity numeric(10, 2) not null default 0,
  unit public.feed_unit not null default 'kg',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feed_inventory_farm_idx on public.feed_inventory (farm_id);

create table public.feed_consumption_log (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  feed_type public.feed_type not null,
  amount_used numeric(10, 2) not null,
  log_date date not null default current_date,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index feed_consumption_farm_date_idx on public.feed_consumption_log (farm_id, log_date);

-- ---------------------------------------------------------------------------
-- notifications + AI insights
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type public.notification_type not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_farm_idx on public.notifications (farm_id, is_read);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  insight_type text not null,
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  valid_until timestamptz
);

create index ai_insights_farm_idx on public.ai_insights (farm_id, generated_at desc);

-- Note: there is no custom OTP table. Phone OTP is handled entirely by
-- Supabase's built-in Phone Auth (auth.signInWithOtp / verifyOtp); only the
-- actual SMS delivery is swapped out via the send-sms-hook edge function
-- (see supabase/functions/send-sms-hook), which calls Kavenegar instead of
-- the unavailable-in-Iran default providers. See README for hook wiring.
