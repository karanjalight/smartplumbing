-- supabase/migrations/0019_meter_relay_monitoring.sql
-- Remote relay (on/off) control + status monitoring for electricity meters.
-- See docs/superpowers/specs/2026-08-02-meter-relay-monitoring-design.md.

create type public.meter_relay_state as enum ('connected', 'disconnected', 'unknown');

alter table public.meters
  add column relay_state                public.meter_relay_state not null default 'unknown',
  add column relay_state_at             timestamptz,
  add column relay_last_action_by       uuid references public.profiles(id) on delete set null,
  add column relay_last_action_response jsonb;

create index meters_relay_state_idx on public.meters (relay_state);

-- Bug fix: a meter linked as someone's ELECTRICITY meter (tenants.electricity_meter_id)
-- previously had no tenant/unit attached here, since the join only matched
-- tenants.meter_id (water). CREATE OR REPLACE VIEW keeps existing grants; the
-- column list is unchanged except for the two relay columns appended at the end.
create or replace view public.meter_directory as
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
  t.full_name  as tenant_name,
  m.relay_state,
  m.relay_state_at
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id or t.electricity_meter_id = m.id;

-- tenant_directory: append the tenant's electricity meter relay state at the end
-- (same append-only convention as 0016_electricity_meter_link.sql).
create or replace view public.tenant_directory as
select
  t.id,
  t.code,
  t.profile_id,
  t.landlord_id,
  l.code              as landlord_code,
  l.full_name         as landlord_name,
  l.company           as landlord_company,
  t.building_id,
  b.name              as building_name,
  t.unit_id,
  u.label             as unit_label,
  t.meter_id,
  m.meter_no,
  t.full_name,
  t.phone,
  t.email,
  t.balance_kes,
  t.status,
  t.billing_model,
  t.last_token_at,
  t.last_token_preview,
  t.created_at,
  t.updated_at,
  t.electricity_meter_id,
  em.meter_no         as electricity_meter_no,
  em.relay_state       as electricity_meter_relay_state,
  em.relay_state_at    as electricity_meter_relay_state_at
from public.tenants t
left join public.landlords l  on l.id = t.landlord_id
left join public.buildings b  on b.id = t.building_id
left join public.units     u  on u.id = t.unit_id
left join public.meters    m  on m.id = t.meter_id
left join public.meters    em on em.id = t.electricity_meter_id;
