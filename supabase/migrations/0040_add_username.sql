-- Account & Security settings: lets a user set/change a username (a
-- profile-only identifier — GALEYAR authenticates by phone OTP or
-- email+password, never by username; this does not touch auth.users at
-- all). Nullable so every existing account is untouched until its owner
-- chooses one. Case-insensitively unique, ASCII alnum/underscore only
-- (the same conventions as most username systems, and simple to type
-- correctly on a phone keyboard) — normalized to lowercase on save by the
-- application before it ever reaches this column.
alter table public.users
  add column username text
  constraint users_username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index users_username_idx on public.users (username) where username is not null;

-- users_update_self (0003) already allows a user to update their own row
-- (no separate WITH CHECK, so USING doubles as the check), and
-- guard_users_privilege_escalation only blocks role/status/is_platform_admin/
-- farm_id changes — username passes through untouched, same as full_name
-- already does. No RLS change needed.
