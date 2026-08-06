-- supabase/migrations/0023_electricity_meter_readings.sql
-- Electricity meter readings (consumption, balance, voltage, power failures) pulled
-- from LONGi's Communication API Chapter 5 (communicationwithdevice). See
-- docs/superpowers/specs/2026-08-04-electricity-meter-readings-design.md.

alter table public.meters
  add column latest_daily_consumption_kwh numeric,
  add column latest_balance_kwh           numeric,
  add column latest_voltage               numeric,
  add column power_failure_count          integer;

-- meter_directory: append the four new columns at the end (same append-only
-- convention as every prior migration touching this view — see 0019's comment).
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
  m.relay_state_at,
  m.latest_daily_consumption_kwh,
  m.latest_balance_kwh,
  m.latest_voltage,
  m.power_failure_count
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id or t.electricity_meter_id = m.id;
