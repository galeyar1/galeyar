-- Storage bucket for disease-record photos. Private bucket; objects are only
-- reachable through signed URLs or an authenticated request that passes RLS.
-- Path convention: {farm_id}/{animal_id}/{filename}.

insert into storage.buckets (id, name, public)
values ('disease-images', 'disease-images', false)
on conflict (id) do nothing;

create policy "disease_images_select_farm" on storage.objects
  for select using (
    bucket_id = 'disease-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
  );

create policy "disease_images_insert_owner_operator" on storage.objects
  for insert with check (
    bucket_id = 'disease-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() in ('owner', 'operator')
  );

create policy "disease_images_delete_owner" on storage.objects
  for delete using (
    bucket_id = 'disease-images'
    and (storage.foldername(name))[1] = public.current_farm_id()::text
    and public.current_role() = 'owner'
  );
