-- Unit-level deposit prices (single source of truth; config only, no charges).
alter table public.units
  add column if not exists water_meter_deposit_kes numeric(12,2)
    check (water_meter_deposit_kes is null or water_meter_deposit_kes >= 0),
  add column if not exists electricity_meter_deposit_kes numeric(12,2)
    check (electricity_meter_deposit_kes is null or electricity_meter_deposit_kes >= 0),
  add column if not exists rent_deposit_kes numeric(12,2)
    check (rent_deposit_kes is null or rent_deposit_kes >= 0);

comment on column public.units.water_meter_deposit_kes is 'Required water-meter deposit price (KES); null = not set.';
comment on column public.units.electricity_meter_deposit_kes is 'Required electricity-meter deposit price (KES); null = not set.';
comment on column public.units.rent_deposit_kes is 'Required rent deposit price (KES); null = not set.';
