-- Supplier name on meters (replaces serial number in admin onboarding UI).

alter table public.meters
  add column if not exists supplier text;

comment on column public.meters.supplier is
  'Meter vendor / manufacturer (e.g. LONGi, Kamstrup).';

-- CREATE OR REPLACE cannot insert a column in the middle of an existing view
-- (Postgres treats it as renaming columns by position). Drop and recreate instead.
drop view if exists public.meter_directory;

create view public.meter_directory as
select
  m.id,
  m.meter_no,
  m.serial_number,
  m.supplier,
  m.model_type,
  m.lifecycle_status,
  m.connectivity_status,
  m.installed_on,
  m.latest_reading_m3,
  m.last_sync_at,
  m.open_alerts,
  m.landlord_id,
  l.company    as landlord_company,
  m.building_id,
  b.name       as building_name,
  m.unit_id,
  u.label      as unit_label,
  t.id         as tenant_id,
  t.full_name  as tenant_name
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id;

grant select on public.meter_directory to authenticated;
