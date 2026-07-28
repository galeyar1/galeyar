-- farm_invites_contact_check (0034) required phone_number or email to be
-- set, written back when every invite still needed a contact address to
-- deliver to. Link-only invites (0035) have neither — the token itself,
-- carried in the shared URL, is now a valid identifier on its own — so
-- this constraint is obsolete and blocks the new invite-link flow outright.

alter table public.farm_invites drop constraint farm_invites_contact_check;
