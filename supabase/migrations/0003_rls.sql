-- Row Level Security: every farm-scoped table is isolated by farm_id, and
-- role restrictions are enforced here (not just hidden in the UI) so that a
-- direct API call cannot bypass them either.

alter table public.farms enable row level security;
alter table public.users enable row level security;
alter table public.farm_invites enable row level security;
alter table public.animals enable row level security;
alter table public.milk_records enable row level security;
alter table public.weight_records enable row level security;
alter table public.disease_records enable row level security;
alter table public.birth_records enable row level security;
alter table public.treatments enable row level security;
alter table public.feed_inventory enable row level security;
alter table public.feed_consumption_log enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_insights enable row level security;

-- ---------------------------------------------------------------------------
-- farms
-- ---------------------------------------------------------------------------
create policy "farms_select_own" on public.farms
  for select using (id = public.current_farm_id());

create policy "farms_insert_onboarding" on public.farms
  for insert to authenticated with check (true);

create policy "farms_update_owner" on public.farms
  for update using (id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
create policy "users_select_self_or_farm" on public.users
  for select using (id = auth.uid() or farm_id = public.current_farm_id());

create policy "users_update_self" on public.users
  for update using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- farm_invites (owner only)
-- ---------------------------------------------------------------------------
create policy "farm_invites_owner_all" on public.farm_invites
  for all using (farm_id = public.current_farm_id() and public.current_role() = 'owner')
  with check (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- animals — owner: full CRUD (no hard delete from client either; the UI
-- issues soft deletes via UPDATE deleted_at). operator: register + view,
-- never delete. vet: view only. consultant: view only.
-- ---------------------------------------------------------------------------
create policy "animals_select_farm" on public.animals
  for select using (farm_id = public.current_farm_id());

create policy "animals_insert_owner_operator" on public.animals
  for insert with check (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'operator')
  );

create policy "animals_update_owner_operator" on public.animals
  for update using (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'operator')
  );

create policy "animals_delete_owner" on public.animals
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- milk_records / weight_records / birth_records — owner + operator register,
-- vet and consultant read-only, nobody but owner deletes.
-- ---------------------------------------------------------------------------
create policy "milk_select_farm" on public.milk_records
  for select using (farm_id = public.current_farm_id());
create policy "milk_insert_owner_operator" on public.milk_records
  for insert with check (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "milk_update_owner_operator" on public.milk_records
  for update using (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "milk_delete_owner" on public.milk_records
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

create policy "weight_select_farm" on public.weight_records
  for select using (farm_id = public.current_farm_id());
create policy "weight_insert_owner_operator" on public.weight_records
  for insert with check (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "weight_update_owner_operator" on public.weight_records
  for update using (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "weight_delete_owner" on public.weight_records
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

create policy "birth_select_farm" on public.birth_records
  for select using (farm_id = public.current_farm_id());
create policy "birth_insert_owner_operator" on public.birth_records
  for insert with check (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "birth_update_owner_operator" on public.birth_records
  for update using (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "birth_delete_owner" on public.birth_records
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- disease_records — owner + operator register & view. vet views only.
-- consultant views only.
-- ---------------------------------------------------------------------------
create policy "disease_select_farm" on public.disease_records
  for select using (farm_id = public.current_farm_id());
create policy "disease_insert_owner_operator" on public.disease_records
  for insert with check (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "disease_update_owner_operator" on public.disease_records
  for update using (farm_id = public.current_farm_id() and public.current_role() in ('owner', 'operator'));
create policy "disease_delete_owner" on public.disease_records
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- treatments — owner, operator AND vet can register; everyone in the farm
-- can view (consultant included).
-- ---------------------------------------------------------------------------
create policy "treatments_select_farm" on public.treatments
  for select using (farm_id = public.current_farm_id());
create policy "treatments_insert_owner_operator_vet" on public.treatments
  for insert with check (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "treatments_update_owner_operator_vet" on public.treatments
  for update using (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'operator', 'vet')
  );
create policy "treatments_delete_owner" on public.treatments
  for delete using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- feed_inventory / feed_consumption_log — owner manages; consultant views
-- (analytics/reports); operator and vet have no access (matches the
-- restricted operator/vet navigation in the spec).
-- ---------------------------------------------------------------------------
create policy "feed_inventory_select_owner_consultant" on public.feed_inventory
  for select using (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'consultant')
  );
create policy "feed_inventory_write_owner" on public.feed_inventory
  for all using (farm_id = public.current_farm_id() and public.current_role() = 'owner')
  with check (farm_id = public.current_farm_id() and public.current_role() = 'owner');

create policy "feed_consumption_select_owner_consultant" on public.feed_consumption_log
  for select using (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'consultant')
  );
create policy "feed_consumption_write_owner" on public.feed_consumption_log
  for insert with check (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- notifications — owner + consultant read; marking read is an owner action.
-- ---------------------------------------------------------------------------
create policy "notifications_select_owner_consultant" on public.notifications
  for select using (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'consultant')
  );
create policy "notifications_update_owner" on public.notifications
  for update using (farm_id = public.current_farm_id() and public.current_role() = 'owner');

-- ---------------------------------------------------------------------------
-- ai_insights — owner + consultant read only. Rows are produced by the
-- generate-ai-insights edge function (service role), never by clients.
-- ---------------------------------------------------------------------------
create policy "ai_insights_select_owner_consultant" on public.ai_insights
  for select using (
    farm_id = public.current_farm_id()
    and public.current_role() in ('owner', 'consultant')
  );
