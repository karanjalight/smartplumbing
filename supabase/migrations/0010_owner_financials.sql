-- 0010_owner_financials.sql — Owner (landlord) expenses for owner statements.

create type public.owner_expense_category as enum (
  'maintenance', 'repairs', 'utilities', 'management', 'insurance', 'other'
);

create table public.owner_expenses (
  id            uuid primary key default gen_random_uuid(),
  landlord_id   uuid not null references public.landlords(id) on delete cascade,
  building_id   uuid references public.buildings(id) on delete set null,
  category      public.owner_expense_category not null default 'other',
  amount_kes    numeric(12,2) not null check (amount_kes >= 0),
  description   text,
  incurred_on   date not null default current_date,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index owner_expenses_landlord_idx on public.owner_expenses (landlord_id, incurred_on);
create index owner_expenses_building_idx on public.owner_expenses (building_id);

create trigger owner_expenses_set_updated_at
  before update on public.owner_expenses
  for each row execute procedure public.set_updated_at();

alter table public.owner_expenses enable row level security;

create policy "owner_expenses_admin_full" on public.owner_expenses
  for all using (public.is_admin()) with check (public.is_admin());

create policy "owner_expenses_landlord_full" on public.owner_expenses
  for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));
