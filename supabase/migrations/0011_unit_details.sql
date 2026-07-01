-- 0011_unit_details.sql — Unit type classification + per-unit photo gallery.

create type public.unit_type as enum (
  'bedsitter', 'studio',
  'one_bedroom', 'two_bedroom', 'three_bedroom', 'four_bedroom',
  'five_bedroom', 'six_bedroom', 'seven_bedroom', 'eight_bedroom'
);

alter table public.units
  add column if not exists unit_type public.unit_type;

comment on column public.units.unit_type is
  'House classification: bedsitter, studio, or N-bedroom.';

-- ---------- unit_images --------------------------------------------------
create table public.unit_images (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references public.units(id) on delete cascade,
  path        text not null,          -- object path in the unit-photos bucket
  sort_order  int not null default 0,
  created_at  timestamptz not null default timezone('utc', now())
);

create index unit_images_unit_idx on public.unit_images (unit_id, sort_order);

alter table public.unit_images enable row level security;

create policy "unit_images_admin_full" on public.unit_images
  for all using (public.is_admin()) with check (public.is_admin());

create policy "unit_images_landlord_full" on public.unit_images
  for all
  using (
    exists (
      select 1 from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = unit_images.unit_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  )
  with check (
    exists (
      select 1 from public.units u
      join public.buildings b on b.id = u.building_id
      where u.id = unit_images.unit_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "unit_images_tenant_read" on public.unit_images
  for select using (
    exists (
      select 1 from public.tenants t
      where t.unit_id = unit_images.unit_id and t.profile_id = auth.uid()
    )
  );

-- ---------- unit-photos bucket (public read) -----------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('unit-photos', 'unit-photos', true, 10 * 1024 * 1024,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "unit_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'unit-photos');

create policy "unit_photos_manager_write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'unit-photos' and (public.is_admin() or public.is_landlord())
  );

create policy "unit_photos_manager_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'unit-photos' and (public.is_admin() or public.is_landlord())
  );
