-- 0009_ledger.sql — Tenant ledger & billing backbone.
-- A positive-amount, debit/credit ledger. Tenant balance = Σ(debit) − Σ(credit).

create type public.ledger_direction as enum ('debit', 'credit');
create type public.ledger_category as enum (
  'rent', 'deposit', 'water', 'service_charge', 'late_fee',
  'payment', 'adjustment', 'refund'
);
create type public.ledger_source as enum (
  'manual', 'rent_run', 'mpesa', 'paystack', 'token', 'system'
);

create table public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  lease_id      uuid references public.leases(id) on delete set null,
  -- denormalised for RLS / landlord-scoped queries
  landlord_id   uuid not null references public.landlords(id) on delete cascade,
  direction     public.ledger_direction not null,
  category      public.ledger_category not null,
  amount_kes    numeric(12,2) not null check (amount_kes >= 0),
  description   text,
  period        text,        -- 'YYYYMM' for recurring charges (rent), else null
  due_date      date,        -- when a charge is due
  source        public.ledger_source not null default 'manual',
  reference     text,
  payment_id    uuid references public.payments(id) on delete set null,
  voided        boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index ledger_entries_tenant_idx   on public.ledger_entries (tenant_id, created_at);
create index ledger_entries_landlord_idx on public.ledger_entries (landlord_id);
create index ledger_entries_lease_idx    on public.ledger_entries (lease_id);

-- Idempotency: a given lease can only be charged rent once per period.
create unique index ledger_rent_period_uniq
  on public.ledger_entries (lease_id, period)
  where category = 'rent' and period is not null and voided = false;

create trigger ledger_entries_set_updated_at
  before update on public.ledger_entries
  for each row execute procedure public.set_updated_at();

-- ---------- RLS ----------------------------------------------------------
alter table public.ledger_entries enable row level security;

create policy "ledger_admin_full" on public.ledger_entries
  for all using (public.is_admin()) with check (public.is_admin());

create policy "ledger_landlord_full" on public.ledger_entries
  for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

create policy "ledger_tenant_read" on public.ledger_entries
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = ledger_entries.tenant_id and t.profile_id = auth.uid()
    )
  );

-- ---------- Balance helper (source of truth) -----------------------------
create function public.tenant_balance_kes(p_tenant_id uuid) returns numeric
  language sql stable as $$
  select coalesce(sum(
    case when direction = 'debit' then amount_kes else -amount_kes end
  ), 0)
  from public.ledger_entries
  where tenant_id = p_tenant_id and voided = false;
$$;
