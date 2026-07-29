-- Age-in-months support for Single & Bulk Animal Registration: age is
-- treated as a convenience INPUT method, never a second persisted fact —
-- birth_date remains the single source of truth every age/juvenile
-- computation already derives from (ageInYears/effectiveAnimalType in
-- src/lib/animal-labels.ts). This only adds the "is this birth_date exact,
-- or an estimate derived from an age-in-months the farmer gave us"
-- distinction, so editing an animal later never silently treats an
-- approximate date as if it were precisely known, and an exact known
-- birth date is never overwritten by a derived approximate one.
alter table public.animals add column birth_date_is_estimated boolean not null default false;

-- Defense-in-depth: register/weight (the dedicated weight-entry form) has
-- always validated weight > 0 client-side, and a production check found
-- zero pre-existing non-positive rows, so this codifies that same rule at
-- the database level for every write path — including the new
-- weight-at-registration inserts added by this round.
alter table public.weight_records add constraint weight_records_positive check (weight > 0);

-- bulk_register_animals (0039) gains birth_date_is_estimated on the
-- per-animal insert — everything else about the function is unchanged.
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
      id, farm_id, ear_tag, species, animal_type, breed, gender, birth_date, birth_date_is_estimated, status, notes,
      confirmed_genetics, genetics_source, genetic_score,
      acquisition_type, batch_id, created_by
    ) values (
      v_new_id, v_farm_id, v_animal ->> 'ear_tag', p_species, v_animal ->> 'animal_type',
      coalesce(nullif(v_animal ->> 'breed', ''), p_breed), v_animal ->> 'gender',
      nullif(v_animal ->> 'birth_date', '')::date,
      coalesce((v_animal ->> 'birth_date_is_estimated')::boolean, false),
      'active', nullif(v_animal ->> 'notes', ''),
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
