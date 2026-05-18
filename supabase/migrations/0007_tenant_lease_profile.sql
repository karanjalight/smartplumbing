-- Optional tenant identity, lease, and contact fields for onboarding.

alter table public.tenants
  add column if not exists national_id text,
  add column if not exists kra_pin text,
  add column if not exists deposit_amount_paid numeric(12,2)
    check (deposit_amount_paid is null or deposit_amount_paid >= 0),
  add column if not exists lease_end_date date,
  add column if not exists secondary_phones text;

comment on column public.tenants.national_id is 'National ID / passport number (optional).';
comment on column public.tenants.kra_pin is 'Kenya Revenue Authority PIN (optional).';
comment on column public.tenants.deposit_amount_paid is 'Security deposit received (KES), optional.';
comment on column public.tenants.lease_end_date is 'Lease end date; account_opened remains lease start.';
comment on column public.tenants.secondary_phones is 'Additional phone numbers (comma-separated).';
