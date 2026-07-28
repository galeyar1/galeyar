-- Link-only invites have no email/phone to identify who they're for in the
-- pending-invites list — the owner asked for a plain reference label
-- (e.g. the operator's name) to write down when generating the link.
-- Purely informational: never used for auth/matching, unlike email.

alter table public.farm_invites add column invitee_name text;
