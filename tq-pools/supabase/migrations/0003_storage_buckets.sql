-- ============================================================
-- STORAGE: public-images bucket for site imagery
-- ============================================================

insert into storage.buckets (id, name, public)
values ('public-images', 'public-images', true)
on conflict (id) do nothing;

-- Public read for site images
create policy "Public images are readable"
  on storage.objects for select
  using (bucket_id = 'public-images');

-- Admin upload/update/delete
create policy "Admins can upload images"
  on storage.objects for insert
  with check (bucket_id = 'public-images' and public.is_admin());

create policy "Admins can update images"
  on storage.objects for update
  using (bucket_id = 'public-images' and public.is_admin());

create policy "Admins can delete images"
  on storage.objects for delete
  using (bucket_id = 'public-images' and public.is_admin());

-- ============================================================
-- Optional: products bucket (separated for clearer asset boundary)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Product images are readable"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Admins manage product images"
  on storage.objects for all
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
