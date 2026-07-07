-- 0014_payment_commissions.sql — Per-payment platform-commission / landlord-net split.
-- One row per rent payment. Sits beside the tenant ledger; NOT part of tenant balance.

create table public.payment_commissions (
  id                  uuid primary key default gen_random_uuid(),
  payment_id          uuid not null references public.payments(id) on delete cascade,
  tenant_id           uuid references public.tenants(id) on delete set null,
  landlord_id         uuid not null references public.landlords(id) on delete cascade,
  building_id         uuid references public.buildings(id) on delete set null,
  gross_kes           numeric(12,2) not null check (gross_kes >= 0),
  commission_pct      numeric(5,2)  not null check (commission_pct >= 0 and commission_pct <= 100),
  commission_kes      numeric(12,2) not null check (commission_kes >= 0),
  net_to_landlord_kes numeric(12,2) not null check (net_to_landlord_kes >= 0),
  period              text,
  created_at          timestamptz not null default timezone('utc', now())
);

create unique index payment_commissions_payment_uniq
  on public.payment_commissions (payment_id);
create index payment_commissions_landlord_idx
  on public.payment_commissions (landlord_id, created_at);

alter table public.payment_commissions enable row level security;

create policy "payment_commissions_admin_full" on public.payment_commissions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "payment_commissions_landlord_read" on public.payment_commissions
  for select using (landlord_id in (select public.current_landlord_ids()));
