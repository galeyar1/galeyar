-- Team Invitations via Email — extends the existing farm_invites table
-- (phone-based, implicit accept-on-first-login) rather than building a
-- parallel invitation system. phone_number becomes optional, email joins
-- it as an alternative, and a real token/status/expiry are added for the
-- link-based email flow the phone flow never needed (a phone invite is
-- "claimed" just by that exact number completing OTP signup).

alter table public.farm_invites
  alter column phone_number drop not null,
  add column email text,
  add column token uuid not null default gen_random_uuid(),
  add column status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  add column expires_at timestamptz not null default (now() + interval '7 days'),
  add column cancelled_at timestamptz,
  add constraint farm_invites_contact_check check (phone_number is not null or email is not null);

-- Backfill status for existing phone invites from the column that already
-- tracked this (accepted_at) — every pre-existing row is either accepted
-- or still genuinely pending; none can be "expired"/"cancelled" since
-- those states didn't exist before this migration.
update public.farm_invites set status = 'accepted' where accepted_at is not null;

-- Prevents duplicate active invites for the same email+farm+role (phone's
-- existing farm_invites_pending_phone_idx is untouched — different rule,
-- global-per-phone rather than per-farm-per-role, left as-is since it's
-- not part of this change).
create unique index farm_invites_pending_email_idx
  on public.farm_invites (farm_id, lower(email), role)
  where status = 'pending' and email is not null;

create index farm_invites_token_idx on public.farm_invites (token);

-- farm_invites_owner_all (0003) was scoped to current_farm_id() (only the
-- farm you're currently viewing) — widened to the same membership-based
-- ownership check farms_delete_owner/farms_update_owner already use, so
-- an owner can manage invites for any farm they own.
drop policy "farm_invites_owner_all" on public.farm_invites;
create policy "farm_invites_owner_all" on public.farm_invites
  for all using (
    exists (
      select 1 from public.farm_members
      where farm_members.farm_id = farm_invites.farm_id and farm_members.user_id = auth.uid()
    )
    and public.current_role() = 'owner'
  )
  with check (
    exists (
      select 1 from public.farm_members
      where farm_members.farm_id = farm_invites.farm_id and farm_members.user_id = auth.uid()
    )
    and public.current_role() = 'owner'
  );

-- handle_new_auth_user (0002/0005) matched pending invites by phone only —
-- email/password signups never matched anything and always became a
-- fresh owner. Now checks email too (only if no phone invite matched),
-- so a brand-new user registering via the invite link is joined straight
-- into the inviting farm, same as the phone flow already does.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.farm_invites%rowtype;
begin
  if new.phone is not null then
    select * into invite
      from public.farm_invites
      where phone_number = new.phone and status = 'pending'
      order by created_at desc
      limit 1;
  end if;

  if invite.id is null and new.email is not null then
    select * into invite
      from public.farm_invites
      where email is not null
        and lower(email) = lower(new.email)
        and status = 'pending'
        and expires_at > now()
      order by created_at desc
      limit 1;
  end if;

  if invite.id is not null then
    insert into public.users (id, phone_number, email, role, farm_id)
    values (new.id, new.phone, new.email, invite.role, invite.farm_id)
    on conflict (id) do nothing;

    update public.farm_invites set status = 'accepted', accepted_at = now() where id = invite.id;
  else
    insert into public.users (id, phone_number, email, role, farm_id)
    values (new.id, new.phone, new.email, 'owner', null)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

-- guard_users_privilege_escalation (0016) unconditionally blocked role
-- changes and blocked farm_id changes except first-time onboarding or an
-- owner switching between their own farms — correctly so, since a client
-- should never grant itself a new role/farm on its own. accept_farm_invite
-- (below) is the one legitimate exception: it independently re-validates
-- the token, expiry, and that the invite's email matches auth.uid()'s own
-- verified email before ever touching this row, then sets this
-- transaction-local flag so the trigger lets its own already-validated
-- change through. No other code path can set this flag.
create or replace function public.guard_users_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if current_setting('galeyar.accepting_invite', true) = 'true' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role can only be changed by a farm administrator';
  end if;

  if new.status is distinct from old.status and not public.is_platform_admin() then
    raise exception 'status can only be changed by an administrator';
  end if;

  if new.is_platform_admin is distinct from old.is_platform_admin and not public.is_platform_admin() then
    raise exception 'is_platform_admin can only be changed by an administrator';
  end if;

  if new.farm_id is distinct from old.farm_id then
    if old.farm_id is null then
      null; -- first-time onboarding / invite acceptance
    elsif old.role = 'owner' and new.farm_id is not null and exists (
      select 1 from public.farm_members where farm_id = new.farm_id and user_id = old.id
    ) then
      null; -- switching between farms this owner belongs to
    else
      raise exception 'farm_id can only be changed by a farm administrator';
    end if;
  end if;

  return new;
end;
$$;

-- Safe public lookup for the accept-invite landing page — callable by an
-- unauthenticated visitor (grant to anon below) so they can see which
-- farm/role they're invited to before logging in or registering. Returns
-- only these four fields for the one matching token, never the full row
-- or any other invite — knowing the (unguessable) token is what unlocks
-- this, nothing else.
create or replace function public.get_invite_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result record;
begin
  select fi.email, fi.role, fi.status, fi.expires_at, f.farm_name
    into result
    from public.farm_invites fi
    join public.farms f on f.id = fi.farm_id
    where fi.token = p_token;

  if result is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', result.email,
    'role', result.role,
    'status', case when result.status = 'pending' and result.expires_at < now() then 'expired' else result.status end,
    'farm_name', result.farm_name
  );
end;
$$;

grant execute on function public.get_invite_by_token(uuid) to anon, authenticated;

-- The actual acceptance — called by an ALREADY-AUTHENTICATED user (an
-- existing account logging in; a brand-new signup is auto-accepted by
-- handle_new_auth_user above already, so this simply no-ops for them with
-- ok:false/'invalid_or_expired' since the invite is already accepted).
-- Never trusts anything from the client except the token: looks up
-- auth.uid()'s own verified email server-side and requires it to match
-- the invite's email exactly (case-insensitive) before changing anything.
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

  if invite.email is null or caller_email is null or lower(invite.email) <> lower(caller_email) then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  perform set_config('galeyar.accepting_invite', 'true', true);

  update public.users set farm_id = invite.farm_id, role = invite.role where id = auth.uid();

  update public.farm_invites set status = 'accepted', accepted_at = now() where id = invite.id;

  return jsonb_build_object('ok', true, 'farm_id', invite.farm_id, 'role', invite.role);
end;
$$;

grant execute on function public.accept_farm_invite(uuid) to authenticated;
