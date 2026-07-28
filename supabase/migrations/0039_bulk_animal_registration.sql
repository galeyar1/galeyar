-- Bulk Animal Registration: register many animals purchased/born/transferred
-- together in one action instead of one-by-one, with automatic concurrency-
-- safe tag allocation and an optional linked purchase transaction in the
-- existing Business ledger (financial_transactions) — reusing every existing
-- table/enum rather than inventing a parallel system.

-- ---------------------------------------------------------------------------
-- animal_batches — the "created together" grouping. New concept (nothing
-- like it existed before). Every animal created through this flow still
-- becomes a fully independent public.animals row; batch_id is purely a
-- traceability link, never a substitute for individual records.
-- ---------------------------------------------------------------------------
create table public.animal_batches (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  species public.species not null,
  breed text,
  acquisition_type text not null check (acquisition_type in ('purchase', 'born_on_farm', 'transfer', 'other')),
  entry_date date not null default current_date,
  quantity integer not null check (quantity > 0),
  notes text,
  financial_transaction_id uuid,
  -- Client-generated per submission attempt — lets bulk_register_animals()
  -- detect and safely no-op a retried/duplicated submit (double-click,
  -- network retry after a timeout) instead of creating a second batch.
  idempotency_key uuid not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index animal_batches_farm_idempotency_idx on public.animal_batches (farm_id, idempotency_key);
create index animal_batches_farm_idx on public.animal_batches (farm_id) where deleted_at is null;

create trigger set_updated_at before update on public.animal_batches
  for each row execute function public.set_updated_at();

alter table public.animal_batches enable row level security;

-- Same farm_id = current_farm_id() / current_role() in (...) shape every
-- other farm-scoped table already uses (see animals_select_farm etc, 0003).
create policy "animal_batches_select_farm" on public.animal_batches
  for select using (farm_id = public.current_farm_id());
create policy "animal_batches_insert_owner_operator" on public.animal_batches
  for insert with check (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "animal_batches_update_owner_operator" on public.animal_batches
  for update using (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));

-- ---------------------------------------------------------------------------
-- animals: batch traceability + how the animal entered the farm. Both
-- nullable — every existing row is untouched and remains perfectly valid
-- (null batch_id/acquisition_type just means "not from a bulk-registration
-- batch", true for every animal registered before this migration).
-- ---------------------------------------------------------------------------
alter table public.animals
  add column batch_id uuid references public.animal_batches (id) on delete set null,
  add column acquisition_type text check (acquisition_type in ('purchase', 'born_on_farm', 'transfer', 'other'));

create index animals_batch_id_idx on public.animals (batch_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- financial_transactions: link a purchase transaction back to its batch.
-- category has no DB-level check (plain text, app-typed only), so the new
-- 'animal_purchase' expense category needs no migration of its own here.
-- ---------------------------------------------------------------------------
alter table public.financial_transactions
  add column batch_id uuid references public.animal_batches (id) on delete set null;

create index financial_transactions_batch_id_idx on public.financial_transactions (batch_id) where deleted_at is null;

alter table public.animal_batches
  add constraint animal_batches_financial_transaction_fk
  foreign key (financial_transaction_id) references public.financial_transactions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- suggest_next_tag_number — read-only convenience for the "پلاک خودکار" UI
-- to pre-fill a sensible starting number. Purely a suggestion: only looks at
-- purely-numeric existing ear_tags (this codebase has never had a tag-prefix
-- convention — every existing tag is free text, so anything non-numeric,
-- e.g. offspring-generated IDs like "SH-125-05-M1", is correctly ignored
-- rather than breaking the scan). The actual submission below re-validates
-- the whole proposed range from scratch — this function is never the
-- authority on whether a tag is actually free.
-- ---------------------------------------------------------------------------
create or replace function public.suggest_next_tag_number()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  -- bigint, not integer: a legacy tag that happens to be a very long digit
  -- string (unlikely, but this is free text with no length limit) must
  -- never make this suggestion helper throw an overflow error.
  select coalesce(max(ear_tag::bigint), 0) + 1
  from public.animals
  where farm_id = public.current_farm_id()
    and deleted_at is null
    and ear_tag ~ '^[0-9]+$'
    and length(ear_tag) < 18;
$$;

grant execute on function public.suggest_next_tag_number() to authenticated;

-- ---------------------------------------------------------------------------
-- bulk_register_animals — the one atomic entry point. A single PL/pgSQL
-- function call is implicitly one transaction: any exception (a tag
-- conflict discovered mid-loop, a bad plan-limit check, anything) rolls
-- back everything it already did, so a partial batch (18 animals created,
-- 7 failed) can never happen. farm_id is never trusted from the client —
-- current_farm_id()/current_role() are resolved server-side from auth.uid(),
-- exactly like current_farm_id()/current_role() themselves and like
-- accept_farm_invite (0034/0035), the only other multi-step atomic RPC in
-- this codebase.
--
-- Concurrency safety: pg_advisory_xact_lock(hashtext(farm_id)) serializes
-- concurrent bulk-registration calls for the SAME farm for the duration of
-- this transaction, so two operators submitting overlapping tag ranges at
-- the same moment can never both pass the tag-conflict check — the second
-- call simply waits for the first to commit (or roll back) before it even
-- starts checking, so it always sees the first call's newly-inserted tags.
-- Different farms never contend with each other (different lock keys).
-- ---------------------------------------------------------------------------
create or replace function public.bulk_register_animals(
  p_idempotency_key uuid,
  p_batch_name text,
  p_species public.species,
  p_breed text,
  p_acquisition_type text,
  p_entry_date date,
  p_notes text,
  p_animals jsonb,
  p_purchase jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id uuid;
  v_role public.user_role;
  v_quantity integer;
  v_tags text[];
  v_conflict text;
  v_plan text;
  v_expires timestamptz;
  v_max_animals integer;
  v_active_count integer;
  v_batch_id uuid;
  v_existing_batch record;
  v_animal jsonb;
  v_new_id uuid;
  v_row_json jsonb;
  v_animals_result jsonb := '[]'::jsonb;
  v_txn_id uuid;
begin
  v_farm_id := public.current_farm_id();
  v_role := public.current_role();

  if v_farm_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_farm');
  end if;

  if v_role not in ('owner', 'operator') then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if p_purchase is not null and v_role <> 'owner' then
    -- Matches financial_transactions_insert_owner (0013): only owners may
    -- create Business transactions, bulk registration is no exception.
    return jsonb_build_object('ok', false, 'error', 'purchase_requires_owner');
  end if;

  if p_acquisition_type not in ('purchase', 'born_on_farm', 'transfer', 'other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_acquisition_type');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_farm_id::text));

  select * into v_existing_batch
    from public.animal_batches
    where farm_id = v_farm_id and idempotency_key = p_idempotency_key;

  if v_existing_batch.id is not null then
    select coalesce(jsonb_agg(to_jsonb(a.*)), '[]'::jsonb) into v_animals_result
      from public.animals a
      where a.batch_id = v_existing_batch.id and a.deleted_at is null;
    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'batch_id', v_existing_batch.id,
      'animals', v_animals_result,
      'financial_transaction_id', v_existing_batch.financial_transaction_id
    );
  end if;

  v_quantity := jsonb_array_length(p_animals);
  if v_quantity is null or v_quantity < 1 or v_quantity > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_quantity');
  end if;

  -- Plan/animal-limit enforcement — mirrors isAtAnimalLimit()'s effective-
  -- plan logic (src/lib/subscription-plans.ts): an expired paid plan falls
  -- back to 'free' limits rather than keeping unlimited access forever.
  select plan, subscription_expires_at into v_plan, v_expires from public.farms where id = v_farm_id;
  if v_expires is not null and v_expires < now() then
    v_plan := 'free';
  end if;
  select max_animals into v_max_animals from public.plans where key = v_plan;
  if v_max_animals is not null then
    select count(*) into v_active_count
      from public.animals
      where farm_id = v_farm_id and deleted_at is null and status = 'active';
    if v_active_count + v_quantity > v_max_animals then
      return jsonb_build_object(
        'ok', false, 'error', 'plan_limit_exceeded',
        'max_animals', v_max_animals, 'active_count', v_active_count
      );
    end if;
  end if;

  select array_agg(elem ->> 'ear_tag') into v_tags from jsonb_array_elements(p_animals) elem;

  if array_length(v_tags, 1) is distinct from (select count(distinct t) from unnest(v_tags) t) then
    return jsonb_build_object('ok', false, 'error', 'duplicate_tags_in_batch');
  end if;

  select ear_tag into v_conflict
    from public.animals
    where farm_id = v_farm_id and deleted_at is null and ear_tag = any (v_tags)
    limit 1;

  if v_conflict is not null then
    return jsonb_build_object('ok', false, 'error', 'tag_conflict', 'tag', v_conflict);
  end if;

  insert into public.animal_batches (
    farm_id, name, species, breed, acquisition_type, entry_date, quantity, notes, idempotency_key, created_by
  ) values (
    v_farm_id, p_batch_name, p_species, p_breed, p_acquisition_type, p_entry_date, v_quantity, p_notes, p_idempotency_key, auth.uid()
  ) returning id into v_batch_id;

  for v_animal in select * from jsonb_array_elements(p_animals)
  loop
    v_new_id := gen_random_uuid();

    insert into public.animals (
      id, farm_id, ear_tag, species, animal_type, breed, gender, birth_date, status, notes,
      confirmed_genetics, genetics_source, genetic_score,
      acquisition_type, batch_id, created_by
    ) values (
      v_new_id, v_farm_id, v_animal ->> 'ear_tag', p_species, v_animal ->> 'animal_type',
      coalesce(nullif(v_animal ->> 'breed', ''), p_breed), v_animal ->> 'gender',
      nullif(v_animal ->> 'birth_date', '')::date, 'active', nullif(v_animal ->> 'notes', ''),
      nullif(v_animal ->> 'confirmed_genetics', ''),
      case when nullif(v_animal ->> 'confirmed_genetics', '') is not null then 'user_edited' else null end,
      nullif(v_animal ->> 'genetic_score', '')::numeric,
      p_acquisition_type, v_batch_id, auth.uid()
    )
    returning to_jsonb(animals.*) into v_row_json;

    v_animals_result := v_animals_result || jsonb_build_array(v_row_json);

    if nullif(v_animal ->> 'weight', '') is not null then
      insert into public.weight_records (farm_id, animal_id, weight, record_date, created_by)
      values (v_farm_id, v_new_id, (v_animal ->> 'weight')::numeric, p_entry_date, auth.uid());
    end if;
  end loop;

  if p_purchase is not null then
    insert into public.financial_transactions (
      farm_id, type, category, amount, transaction_date, description, party_name, batch_id, created_by
    ) values (
      v_farm_id, 'expense', 'animal_purchase', (p_purchase ->> 'amount')::numeric,
      coalesce(nullif(p_purchase ->> 'transaction_date', '')::date, p_entry_date),
      nullif(p_purchase ->> 'notes', ''), nullif(p_purchase ->> 'party_name', ''), v_batch_id, auth.uid()
    )
    returning id into v_txn_id;

    update public.animal_batches set financial_transaction_id = v_txn_id where id = v_batch_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'batch_id', v_batch_id,
    'animals', v_animals_result,
    'financial_transaction_id', v_txn_id
  );
end;
$$;

grant execute on function public.bulk_register_animals(uuid, text, public.species, text, text, date, text, jsonb, jsonb) to authenticated;
