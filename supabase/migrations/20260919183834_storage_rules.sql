create policy "menu images: public read"
  on storage.objects for select to public
  using ( bucket_id = 'menu-images' );

create policy "menu images: manager uploads to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (select private.my_restaurant_id())::text
  );

create policy "menu images: manager updates own folder"
  on storage.objects for update to authenticated
  using ( bucket_id = 'menu-images'
          and (storage.foldername(name))[1] = (select private.my_restaurant_id())::text );

create policy "menu images: manager deletes own folder"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'menu-images'
          and (storage.foldername(name))[1] = (select private.my_restaurant_id())::text );
