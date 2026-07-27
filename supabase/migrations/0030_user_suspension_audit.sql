-- User & Subscription Management Upgrade — suspension audit trail.
-- users.status (active/suspended) already existed from an earlier round;
-- these three columns were missing for a proper suspend action.
alter table public.users
  add column suspended_at timestamptz,
  add column suspended_by uuid references public.admin_users (id) on delete set null,
  add column suspension_reason text;

-- Clearing these on reactivation is an app-layer responsibility (the admin
-- panel's reactivate action sets suspended_at/by/reason back to null),
-- not enforced here — matches how every other status-transition field in
-- this schema works.
