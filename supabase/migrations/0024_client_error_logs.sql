-- Error Monitoring (admin Phase D): nothing captured client errors before
-- this — no Sentry, no error table, no error.tsx boundary anywhere. This
-- is a best-effort client-side capture, not a full crash-reporting
-- service: it only sees errors React's error boundaries catch (render
-- errors in a mounted subtree), not every possible failure mode.
create table public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms (id) on delete set null,
  user_id uuid references public.users (id) on delete set null,
  message text not null,
  stack text,
  url text,
  user_agent text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index client_error_logs_created_at_idx on public.client_error_logs (created_at desc);

alter table public.client_error_logs enable row level security;

-- Any authenticated user may report an error, but only as themselves (or
-- anonymously with user_id null, e.g. an error before login completes) —
-- never on someone else's behalf.
create policy "client_error_logs_insert_own" on public.client_error_logs
  for insert with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "client_error_logs_select_platform_admin" on public.client_error_logs
  for select using (public.is_platform_admin());

-- Marking an error "resolved" (triage) is the only admin write here.
create policy "client_error_logs_update_platform_admin" on public.client_error_logs
  for update using (public.is_platform_admin());
