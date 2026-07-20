-- supabase/migrations/0016_electricity_meter_link.sql
-- Second, independent meter link on tenants for electricity (mirrors meter_id / water).
alter table public.tenants
  add column if not exists electricity_meter_id uuid references public.meters(id) on delete set null;

create index if not exists tenants_electricity_meter_idx
  on public.tenants (electricity_meter_id);

comment on column public.tenants.electricity_meter_id is
  'Electricity meter FK, independent of meter_id (water). Nullable — a tenant may have neither, either, or both.';

-- tenant_directory: append the two new columns at the END of the select list.
-- CREATE OR REPLACE VIEW can add trailing columns without dropping the view
-- (which would also drop its grants — see 0005_meter_supplier.sql's note on
-- meter_directory for why that matters).
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
  em.meter_no         as electricity_meter_no
from public.tenants t
left join public.landlords l  on l.id = t.landlord_id
left join public.buildings b  on b.id = t.building_id
left join public.units     u  on u.id = t.unit_id
left join public.meters    m  on m.id = t.meter_id
left join public.meters    em on em.id = t.electricity_meter_id;

-- meters RLS: a tenant can currently read their own meter only via meter_id
-- (see 0002_rls.sql policy "meters_tenant_read"). Extend it to also cover
-- electricity_meter_id, or lib/client-tenant-profile.ts's electricity meter
-- lookup (Task 7) will silently be blocked by RLS for signed-in tenants.
alter policy "meters_tenant_read" on public.meters
  using (
    exists (
      select 1 from public.tenants t
      where (t.meter_id = meters.id or t.electricity_meter_id = meters.id)
        and t.profile_id = auth.uid()
    )
  );
