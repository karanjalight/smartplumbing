-- Per-meter security deposit configuration (policy only; no payment tracking).
-- A tenant may have a water meter, an electricity meter, neither, or both.
-- Each `_required` flag is an operator decision; each `_amount` is the required
-- deposit in KES, stored only when its meter's deposit is required.

alter table public.tenants
  add column if not exists water_deposit_required boolean not null default false,
  add column if not exists water_deposit_amount numeric(12,2)
    check (water_deposit_amount is null or water_deposit_amount >= 0),
  add column if not exists electricity_deposit_required boolean not null default false,
  add column if not exists electricity_deposit_amount numeric(12,2)
    check (electricity_deposit_amount is null or electricity_deposit_amount >= 0);

comment on column public.tenants.water_deposit_required is
  'Whether a security deposit is required for the tenant''s water meter.';
comment on column public.tenants.water_deposit_amount is
  'Required water-meter deposit in KES; null when not required.';
comment on column public.tenants.electricity_deposit_required is
  'Whether a security deposit is required for the tenant''s electricity meter.';
comment on column public.tenants.electricity_deposit_amount is
  'Required electricity-meter deposit in KES; null when not required.';
