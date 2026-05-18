-- Building management fee % and optional recurring charges (garbage, security, etc.)

create type public.recurring_bill_frequency as enum ('monthly', 'quarterly', 'yearly');

alter table public.buildings
  add column if not exists management_fee_pct numeric(5,2)
    check (management_fee_pct is null or (management_fee_pct >= 0 and management_fee_pct <= 100));

comment on column public.buildings.management_fee_pct is
  'Optional platform/management cut as % of total building income (rent + recurring).';

create table public.building_recurring_bills (
  id              uuid primary key default gen_random_uuid(),
  building_id     uuid not null references public.buildings(id) on delete cascade,
  label           text not null,
  amount_kes      numeric(12,2) not null check (amount_kes >= 0),
  frequency       public.recurring_bill_frequency not null default 'monthly',
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create index building_recurring_bills_building_idx
  on public.building_recurring_bills (building_id);

create trigger building_recurring_bills_set_updated_at
  before update on public.building_recurring_bills
  for each row execute procedure public.set_updated_at();

alter table public.building_recurring_bills enable row level security;

create policy "building_recurring_bills_admin_full"
  on public.building_recurring_bills for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "building_recurring_bills_landlord_full"
  on public.building_recurring_bills for all
  using (
    exists (
      select 1 from public.buildings b
      where b.id = building_recurring_bills.building_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  )
  with check (
    exists (
      select 1 from public.buildings b
      where b.id = building_recurring_bills.building_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "building_recurring_bills_tenant_read"
  on public.building_recurring_bills for select
  using (
    exists (
      select 1 from public.tenants t
      where t.building_id = building_recurring_bills.building_id
        and t.profile_id = auth.uid()
    )
  );
