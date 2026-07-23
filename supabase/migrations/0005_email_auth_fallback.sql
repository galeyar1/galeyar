-- Kavenegar's OTP business-verification (Enamad + promissory note) can take
-- days to clear, so email+password is added as a temporary parallel sign-in
-- path — phone stays the primary path once OTP is live. Both must be able to
-- create a public.users row, so phone_number can no longer be mandatory.

alter table public.users alter column phone_number drop not null;
alter table public.users add column email text unique;

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
      where phone_number = new.phone and accepted_at is null
      order by created_at desc
      limit 1;
  end if;

  if invite.id is not null then
    insert into public.users (id, phone_number, email, role, farm_id)
    values (new.id, new.phone, new.email, invite.role, invite.farm_id)
    on conflict (id) do nothing;

    update public.farm_invites set accepted_at = now() where id = invite.id;
  else
    insert into public.users (id, phone_number, email, role, farm_id)
    values (new.id, new.phone, new.email, 'owner', null)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
