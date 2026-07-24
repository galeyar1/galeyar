-- GALEYAR v2.0 — Financial Intelligence, cross-farm aggregation for the
-- Global Dashboard/Business Analytics, and the Support Center.
--
-- Per explicit confirmation before this round: no new auth roles were added
-- (Accountant reuses owner/consultant access; "Super Admin" doesn't map to
-- anything this app's model needs) and multi-farm membership stays
-- owner-only (unchanged from the existing farm_members model) — this
-- migration only *widens* an owner's own read access across farms they
-- already belong to, it does not change who can belong to a farm.

-- ---------------------------------------------------------------------------
-- is_owned_farm — lets an owner read (SELECT-only) rows from any farm they
-- have a farm_members row for, not just the currently active one. Combined
-- with the existing farm_id = current_farm_id() policies via OR (Postgres
-- RLS: multiple permissive policies for the same command are ORed), so this
-- only ever adds read access for the farm's own owner — never for other
-- roles, never for other farms, never for writes.
-- ---------------------------------------------------------------------------
create or replace function public.is_owned_farm(target_farm_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_role() = 'owner' and exists (
    select 1 from public.farm_members
    where farm_members.farm_id = target_farm_id
      and farm_members.user_id = auth.uid()
  );
$$;

create policy "animals_select_owned_farms" on public.animals
  for select using (public.is_owned_farm(farm_id));
create policy "birth_records_select_owned_farms" on public.birth_records
  for select using (public.is_owned_farm(farm_id));
create policy "vaccinations_select_owned_farms" on public.vaccinations
  for select using (public.is_owned_farm(farm_id));
create policy "deworming_records_select_owned_farms" on public.deworming_records
  for select using (public.is_owned_farm(farm_id));

-- ---------------------------------------------------------------------------
-- financial_transactions — one unified ledger for both income and expense.
-- Debtors = income rows with is_settled = false (money owed to the farm).
-- Creditors = expense rows with is_settled = false (money the farm owes).
-- Feed costs / salaries are just expense categories, not separate tables.
-- ---------------------------------------------------------------------------
create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric not null check (amount >= 0),
  transaction_date date not null default current_date,
  description text,
  party_name text,
  due_date date,
  is_settled boolean not null default true,
  animal_id uuid references public.animals (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index financial_transactions_farm_date_idx on public.financial_transactions (farm_id, transaction_date) where deleted_at is null;
create index financial_transactions_animal_idx on public.financial_transactions (animal_id) where deleted_at is null;

alter table public.financial_transactions enable row level security;

create trigger set_updated_at before update on public.financial_transactions
  for each row execute function public.set_updated_at();
create trigger guard_soft_delete_owner_only before update on public.financial_transactions
  for each row execute function public.guard_soft_delete_owner_only();

-- Financial data is owner/consultant ("accountant") visibility, not operator/vet.
create policy "financial_transactions_select" on public.financial_transactions
  for select using (
    (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'consultant'))
    or public.is_owned_farm(farm_id)
  );
create policy "financial_transactions_insert_owner" on public.financial_transactions
  for insert with check (farm_id = public.current_farm_id() and public.current_role() = 'owner');
create policy "financial_transactions_update_owner" on public.financial_transactions
  for update using (farm_id = public.current_farm_id() and public.current_role() = 'owner');
create policy "financial_transactions_delete_owner" on public.financial_transactions
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- support_tickets + support_ticket_messages — any farm member can file a
-- ticket and see/reply within their own farm; only the owner resolves
-- (updates status) or removes one.
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'technical',
  priority text not null default 'normal',
  status text not null default 'open',
  attachment_url text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index support_tickets_farm_idx on public.support_tickets (farm_id) where deleted_at is null;

alter table public.support_tickets enable row level security;

create trigger set_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create policy "support_tickets_select_farm" on public.support_tickets
  for select using (farm_id = public.current_farm_id());
create policy "support_tickets_insert_farm" on public.support_tickets
  for insert with check (farm_id = public.current_farm_id());
create policy "support_tickets_update_owner" on public.support_tickets
  for update using (farm_id = public.current_farm_id() and public.current_role() = 'owner');
create policy "support_tickets_delete_owner" on public.support_tickets
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  farm_id uuid not null references public.farms (id) on delete cascade,
  sender_id uuid references public.users (id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

create index support_ticket_messages_ticket_idx on public.support_ticket_messages (ticket_id);

alter table public.support_ticket_messages enable row level security;

create policy "support_ticket_messages_select_farm" on public.support_ticket_messages
  for select using (farm_id = public.current_farm_id());
create policy "support_ticket_messages_insert_farm" on public.support_ticket_messages
  for insert with check (farm_id = public.current_farm_id());

-- ---------------------------------------------------------------------------
-- Storage bucket for support-ticket attachments (image/video/PDF).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

create policy "support_attachments_select_farm" on storage.objects
  for select using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
  );

create policy "support_attachments_insert_farm" on storage.objects
  for insert with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
  );

create policy "support_attachments_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() = 'owner'
  );
