-- Team invitations no longer go out by email (Resend removed) — the owner
-- now generates a link (a plain token) in the Settings team section and
-- shares it manually (WhatsApp/Telegram/in person). Those invites are
-- created with email left null on purpose, so accept_farm_invite (0034)
-- must stop treating "invite.email is null" as an automatic mismatch:
-- an email is only ever enforced when the inviter actually set one.

create or replace function public.accept_farm_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.farm_invites%rowtype;
  caller_email text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select email into caller_email from auth.users where id = auth.uid();

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

  -- Only enforce an email match when the invite was actually bound to one
  -- (the phone/email flows). A link-only invite (email is null) is claimed
  -- by whichever authenticated account opens it — the unguessable token
  -- itself is the authorization, same as it already is for get_invite_by_token.
  if invite.email is not null and (caller_email is null or lower(invite.email) <> lower(caller_email)) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  perform set_config('galeyar.accepting_invite', 'true', true);

  update public.users set farm_id = invite.farm_id, role = invite.role where id = auth.uid();

  update public.farm_invites set status = 'accepted', accepted_at = now() where id = invite.id;

  return jsonb_build_object('ok', true, 'farm_id', invite.farm_id, 'role', invite.role);
end;
$$;
