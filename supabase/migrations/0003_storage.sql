-- ============================================================================
-- Storage buckets + RLS policies
--
-- Buckets:
--   avatars             -> public read  (any profile picture)
--   product-images      -> public read  (shop catalog)
--   building-photos     -> auth read    (gallery for landlord portal)
--   meter-photos        -> auth read    (install / fault evidence)
--   tenant-documents    -> private      (lease, ID copy)
--   landlord-documents  -> private      (contracts, agreements)
--   payment-proofs      -> private      (M-Pesa screenshots / deposit slips)
--   receipts            -> private      (per-tenant PDF receipts)
--
-- Object paths use the convention "<owner-uuid-or-resource-id>/<filename>"
-- so that the first path segment can be checked against auth.uid() or a
-- joined resource owner via storage.foldername(name)[1].
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',             'avatars',             true,  5  * 1024 * 1024, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('product-images',      'product-images',      true,  10 * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('building-photos',     'building-photos',     false, 10 * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('meter-photos',        'meter-photos',        false, 10 * 1024 * 1024, array['image/jpeg','image/png','image/webp']),
  ('tenant-documents',    'tenant-documents',    false, 20 * 1024 * 1024, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('landlord-documents',  'landlord-documents',  false, 20 * 1024 * 1024, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('payment-proofs',      'payment-proofs',      false, 10 * 1024 * 1024, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('receipts',            'receipts',            false, 10 * 1024 * 1024, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- avatars: anyone can read; users can write only to their own folder.
-- Path: <profile_id>/<filename>
-- ---------------------------------------------------------------------------
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_write"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- product-images: public read; admin-only write.
-- ---------------------------------------------------------------------------
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product_images_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- building-photos: scoped to landlord (path = <landlord_id>/<building_id>/<file>)
-- ---------------------------------------------------------------------------
create policy "building_photos_admin_full"
  on storage.objects for all
  using (bucket_id = 'building-photos' and public.is_admin())
  with check (bucket_id = 'building-photos' and public.is_admin());

create policy "building_photos_landlord_full"
  on storage.objects for all
  using (
    bucket_id = 'building-photos'
    and (storage.foldername(name))[1]::uuid in (select public.current_landlord_ids())
  )
  with check (
    bucket_id = 'building-photos'
    and (storage.foldername(name))[1]::uuid in (select public.current_landlord_ids())
  );

-- Tenants can read photos of their own building (path matches their landlord).
create policy "building_photos_tenant_read"
  on storage.objects for select
  using (
    bucket_id = 'building-photos'
    and exists (
      select 1
        from public.tenants t
       where t.profile_id  = auth.uid()
         and t.landlord_id::text = (storage.foldername(name))[1]
    )
  );

-- ---------------------------------------------------------------------------
-- meter-photos: same scope as buildings (path = <landlord_id>/<meter_id>/<file>)
-- ---------------------------------------------------------------------------
create policy "meter_photos_admin_full"
  on storage.objects for all
  using (bucket_id = 'meter-photos' and public.is_admin())
  with check (bucket_id = 'meter-photos' and public.is_admin());

create policy "meter_photos_landlord_full"
  on storage.objects for all
  using (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1]::uuid in (select public.current_landlord_ids())
  )
  with check (
    bucket_id = 'meter-photos'
    and (storage.foldername(name))[1]::uuid in (select public.current_landlord_ids())
  );

create policy "meter_photos_tenant_read"
  on storage.objects for select
  using (
    bucket_id = 'meter-photos'
    and exists (
      select 1
        from public.tenants t
       where t.profile_id   = auth.uid()
         and t.landlord_id::text = (storage.foldername(name))[1]
    )
  );

-- ---------------------------------------------------------------------------
-- tenant-documents: per-tenant private (path = <tenant_profile_id>/<file>)
-- ---------------------------------------------------------------------------
create policy "tenant_documents_admin_full"
  on storage.objects for all
  using (bucket_id = 'tenant-documents' and public.is_admin())
  with check (bucket_id = 'tenant-documents' and public.is_admin());

create policy "tenant_documents_owner_full"
  on storage.objects for all
  using (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'tenant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Landlord can read documents belonging to their tenants.
create policy "tenant_documents_landlord_read"
  on storage.objects for select
  using (
    bucket_id = 'tenant-documents'
    and exists (
      select 1
        from public.tenants t
       where t.profile_id::text = (storage.foldername(name))[1]
         and t.landlord_id in (select public.current_landlord_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- landlord-documents: path = <landlord_id>/<file>
-- ---------------------------------------------------------------------------
create policy "landlord_documents_admin_full"
  on storage.objects for all
  using (bucket_id = 'landlord-documents' and public.is_admin())
  with check (bucket_id = 'landlord-documents' and public.is_admin());

create policy "landlord_documents_owner_full"
  on storage.objects for all
  using (
    bucket_id = 'landlord-documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_landlord_ids())
  )
  with check (
    bucket_id = 'landlord-documents'
    and (storage.foldername(name))[1]::uuid in (select public.current_landlord_ids())
  );

-- ---------------------------------------------------------------------------
-- payment-proofs: path = <tenant_profile_id>/<payment_id>/<file>
-- ---------------------------------------------------------------------------
create policy "payment_proofs_admin_full"
  on storage.objects for all
  using (bucket_id = 'payment-proofs' and public.is_admin())
  with check (bucket_id = 'payment-proofs' and public.is_admin());

create policy "payment_proofs_tenant_owner"
  on storage.objects for all
  using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "payment_proofs_landlord_read"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and exists (
      select 1
        from public.tenants t
       where t.profile_id::text = (storage.foldername(name))[1]
         and t.landlord_id in (select public.current_landlord_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- receipts: path = <tenant_profile_id>/<file>
-- ---------------------------------------------------------------------------
create policy "receipts_admin_full"
  on storage.objects for all
  using (bucket_id = 'receipts' and public.is_admin())
  with check (bucket_id = 'receipts' and public.is_admin());

create policy "receipts_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts_landlord_read"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and exists (
      select 1
        from public.tenants t
       where t.profile_id::text = (storage.foldername(name))[1]
         and t.landlord_id in (select public.current_landlord_ids())
    )
  );
