-- Bug: accept_farm_invite (0035) dropped the email-match requirement for
-- link-only invites entirely, so ANY currently-authenticated session that
-- opened an invite link got auto-accepted — including the owner who just
-- generated the link themselves (e.g. to copy/test it), silently
-- overwriting their own account's role from 'owner' down to whatever role
-- the invite was for. Reported by malekbabak128@gmail.com, whose own owner
-- account had been demoted to 'operator' this way.

-- One-time data repair for the reported account.
do $$
begin
  perform set_config('galeyar.accepting_invite', 'true', true);
  update public.users
    set role = 'owner'
    where lower(email) = 'malekbabak128@gmail.com' and role <> 'owner';
end $$;

-- Root-cause fix: accept_farm_invite now refuses to run when either
--   (a) the caller is the same account that created the invite, or
--   (b) the caller already owns a farm (a real owner, not a fresh
--       not-yet-onboarded signup whose farm_id is still null) —
-- an owner's identity should never be reassigned by opening/accepting an
-- invite link; that's not a supported way to change farm/role for an
-- owner account.
create or replace function public.accept_farm_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.farm_invites%rowtype;
  caller_email text;
  caller_role public.user_role;
  caller_farm_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  select role, farm_id into caller_role, caller_farm_id from public.users where id = auth.uid();

  select * into invite
    from public.farm_invites
    where token = p_token and status = 'pending'
    limit 1;

  if invite.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  if invite.expires_at < now() then
    update public.farm_invites set status = 'expired' where id = invite.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  if invite.invited_by is not null and invite.invited_by = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'cannot_accept_own_invite');
  end if;

  if caller_role = 'owner' and caller_farm_id is not null then
    return jsonb_build_object('ok', false, 'error', 'owner_cannot_accept_invite');
  end if;

  if invite.email is not null and (caller_email is null or lower(invite.email) <> lower(caller_email)) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  perform set_config('galeyar.accepting_invite', 'true', true);

  update public.users set farm_id = invite.farm_id, role = invite.role where id = auth.uid();

  update public.farm_invites set status = 'accepted', accepted_at = now() where id = invite.id;

  return jsonb_build_object('ok', true, 'farm_id', invite.farm_id, 'role', invite.role);
end;
$$;
