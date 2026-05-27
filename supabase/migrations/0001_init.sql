-- ============================================================================
-- Mali Smart — Core schema
-- Aligns with docs/PROJECT_PROPOSAL.md (multi-tenant water billing with STS
-- prepaid meters via LONGi, M-Pesa/Paystack collections, automated landlord
-- payouts) and the data shapes used by lib/*.ts in the Next.js app.
-- ============================================================================

create extension if not exists "pgcrypto"  with schema public;
create extension if not exists "citext"    with schema public;
create extension if not exists "pg_trgm"   with schema public;

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('admin', 'landlord', 'tenant', 'staff');

create type public.account_status as enum ('active', 'pending_verification', 'suspended', 'inactive');

create type public.tenant_billing_model as enum ('prepaid_sts', 'postpaid');

create type public.tenant_status as enum ('active', 'low_credit', 'inactive', 'overdue');

create type public.payout_schedule as enum ('monthly', 'biweekly');

create type public.payout_rail as enum ('m_pesa_b2b', 'bank_transfer');

create type public.rent_model as enum ('per_unit', 'whole_building');

create type public.meter_lifecycle as enum ('active', 'inactive', 'fault', 'maintenance');

create type public.meter_connectivity as enum ('online', 'offline', 'intermittent', 'unknown');

create type public.meter_model_type as enum (
  'water_prepay_m3',        -- LONGi meterType 1
  'water_prepay_currency',  -- LONGi meterType 5
  'postpay'                 -- LONGi meterType -1
);

create type public.payment_method as enum ('M-Pesa', 'Bank', 'Cash', 'STS credit', 'Card');

create type public.payment_category as enum ('rent', 'tokens', 'service', 'shop');

create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded', 'cancelled');

create type public.token_source as enum ('app', 'm_pesa', 'manual');

create type public.manual_token_channel as enum ('office', 'call_center', 'field');

create type public.staff_status as enum ('active', 'on_leave', 'inactive');

create type public.staff_serves as enum ('tenants', 'landlords', 'both');

create type public.staff_skill as enum (
  'plumbing', 'electrical', 'hvac', 'general_maintenance', 'meter_support'
);

create type public.service_urgency as enum ('low', 'standard', 'urgent');

create type public.service_request_status as enum (
  'submitted', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'cancelled'
);

create type public.appointment_status as enum (
  'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'
);

create type public.order_status as enum (
  'pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);

create type public.notification_category as enum (
  'meter', 'tenant', 'payment', 'leak', 'system', 'order', 'service', 'token', 'payout'
);

create type public.notification_severity as enum ('critical', 'warning', 'info');

-- ---------------------------------------------------------------------------
-- 2. UTILITY: updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. PROFILES (1-to-1 with auth.users) and roles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         public.user_role  not null default 'tenant',
  full_name    text              not null default '',
  email        citext            unique,
  phone        text,
  avatar_url   text,
  status       public.account_status not null default 'active',
  created_at   timestamptz       not null default timezone('utc', now()),
  updated_at   timestamptz       not null default timezone('utc', now())
);

create index profiles_role_idx   on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- Sync minimal data from auth.users on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper: who am I, what role.
create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_landlord()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'landlord' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_tenant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'tenant' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'staff' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- 4. LANDLORDS
-- ---------------------------------------------------------------------------

create table public.landlords (
  id                       uuid primary key default gen_random_uuid(),
  profile_id               uuid unique references public.profiles(id) on delete set null,
  code                     text unique,                       -- e.g. "LND-001" for display / import
  full_name                text not null,
  company                  text not null default '',
  phone                    text,
  email                    citext,
  region                   text,
  account_opened           date,
  payout_schedule          public.payout_schedule not null default 'monthly',
  payout_rail              public.payout_rail     not null default 'm_pesa_b2b',
  mpesa_till_label         text,
  bank_account_label       text,
  -- cached metrics (refreshed by job / trigger; not the source of truth)
  monthly_collection_kes   numeric(14,2) not null default 0,
  open_alerts_count        integer       not null default 0,
  last_payout_at           timestamptz,
  next_payout_at           timestamptz,
  status                   public.account_status not null default 'active',
  created_at               timestamptz not null default timezone('utc', now()),
  updated_at               timestamptz not null default timezone('utc', now())
);

create index landlords_status_idx     on public.landlords (status);
create index landlords_profile_id_idx on public.landlords (profile_id);

create trigger landlords_set_updated_at
  before update on public.landlords
  for each row execute procedure public.set_updated_at();

-- Helper: landlord row(s) belonging to current user.
create or replace function public.current_landlord_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.landlords where profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 5. BUILDINGS + UNITS
-- ---------------------------------------------------------------------------

create table public.buildings (
  id                uuid primary key default gen_random_uuid(),
  code              text unique,
  landlord_id       uuid not null references public.landlords(id) on delete cascade,
  name              text not null,
  address_line      text,
  city              text,
  region            text,
  caretaker_name    text,
  caretaker_phone   text,
  house_count       integer not null default 0,
  meter_count       integer not null default 0,
  rent_model        public.rent_model not null default 'per_unit',
  rent_kes          numeric(12,2) not null default 0,
  notes             text,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index buildings_landlord_idx on public.buildings (landlord_id);
create index buildings_name_trgm    on public.buildings using gin (name gin_trgm_ops);

create trigger buildings_set_updated_at
  before update on public.buildings
  for each row execute procedure public.set_updated_at();

create table public.units (
  id                uuid primary key default gen_random_uuid(),
  code              text,
  building_id       uuid not null references public.buildings(id) on delete cascade,
  label             text not null,                       -- e.g. "Block A · Unit 12"
  description       text,
  rent_kes          numeric(12,2),                       -- nullable: falls back to building.rent_kes
  is_vacant         boolean not null default true,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  unique (building_id, label)
);

create index units_building_idx on public.units (building_id);

create trigger units_set_updated_at
  before update on public.units
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. WATER PRICING (per building)
-- ---------------------------------------------------------------------------

create table public.water_pricing (
  id                    uuid primary key default gen_random_uuid(),
  building_id           uuid not null references public.buildings(id) on delete cascade,
  price_per_unit_kes    numeric(10,2) not null default 0,
  unit_definition       text          not null default '1 m³ prepaid block',
  standing_charge_kes   numeric(10,2) not null default 0,
  min_charge_kes        numeric(10,2) not null default 0,
  vat_rate_pct          numeric(5,2)  not null default 16,
  notes                 text,
  effective_from        timestamptz   not null default timezone('utc', now()),
  effective_to          timestamptz,
  created_at            timestamptz   not null default timezone('utc', now()),
  updated_at            timestamptz   not null default timezone('utc', now())
);

create index water_pricing_building_idx
  on public.water_pricing (building_id, effective_from desc);

create trigger water_pricing_set_updated_at
  before update on public.water_pricing
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. METERS (STS / LONGi-aware)
-- ---------------------------------------------------------------------------

create table public.meters (
  id                  uuid primary key default gen_random_uuid(),
  meter_no            text not null unique,    -- LONGi natural ID (e.g. "0159000000640")
  serial_number       text unique,             -- inventory serial; defaults to derived from meter_no
  model_type          public.meter_model_type not null default 'water_prepay_m3',
  lifecycle_status    public.meter_lifecycle  not null default 'active',
  connectivity_status public.meter_connectivity not null default 'unknown',
  landlord_id         uuid references public.landlords(id) on delete set null,
  building_id         uuid references public.buildings(id) on delete set null,
  unit_id             uuid references public.units(id)     on delete set null,
  -- STS device parameters (Chapter 6 transaction response)
  sts_sgc             integer,
  sts_ti              integer,
  -- runtime fields
  installed_on        date,
  latest_reading_m3   numeric(12,2),
  last_sync_at        timestamptz,
  open_alerts         integer not null default 0,
  notes               text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create index meters_landlord_idx     on public.meters (landlord_id);
create index meters_building_idx     on public.meters (building_id);
create index meters_unit_idx         on public.meters (unit_id);
create index meters_lifecycle_idx    on public.meters (lifecycle_status);
create index meters_connectivity_idx on public.meters (connectivity_status);

create trigger meters_set_updated_at
  before update on public.meters
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. TENANTS (linked to a profile, a unit, and (usually) a meter)
-- ---------------------------------------------------------------------------

create table public.tenants (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,                  -- e.g. "TNT-2026-001"
  profile_id          uuid unique references public.profiles(id) on delete set null,
  landlord_id         uuid not null references public.landlords(id) on delete restrict,
  building_id         uuid references public.buildings(id) on delete set null,
  unit_id             uuid references public.units(id)     on delete set null,
  meter_id            uuid references public.meters(id)    on delete set null,
  full_name           text not null,
  phone               text,
  email               citext,
  address_line        text,
  city                text,
  region              text,
  billing_model       public.tenant_billing_model not null default 'prepaid_sts',
  status              public.tenant_status not null default 'active',
  balance_kes         numeric(12,2) not null default 0,
  last_token_at       timestamptz,
  last_token_preview  text,
  account_opened      date,
  lease_notes         text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create index tenants_landlord_idx on public.tenants (landlord_id);
create index tenants_building_idx on public.tenants (building_id);
create index tenants_unit_idx     on public.tenants (unit_id);
create index tenants_meter_idx    on public.tenants (meter_id);
create index tenants_status_idx   on public.tenants (status);
create index tenants_profile_idx  on public.tenants (profile_id);
create index tenants_name_trgm    on public.tenants using gin (full_name gin_trgm_ops);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute procedure public.set_updated_at();

-- Helper: tenant rows belonging to current user.
create or replace function public.current_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants where profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 9. PAYMENTS (M-Pesa / Paystack / bank / cash / STS credit)
-- ---------------------------------------------------------------------------

create table public.payments (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid references public.tenants(id) on delete set null,
  landlord_id        uuid references public.landlords(id) on delete set null,
  meter_id           uuid references public.meters(id) on delete set null,
  amount_kes         numeric(12,2) not null check (amount_kes >= 0),
  method             public.payment_method   not null,
  category           public.payment_category not null default 'rent',
  status             public.payment_status   not null default 'pending',
  reference          text,                          -- M-Pesa receipt, bank ref, etc.
  provider           text,                          -- 'paystack', 'mpesa', 'manual', ...
  provider_reference text,                          -- raw provider transaction id
  raw_payload        jsonb,                         -- gateway webhook / verify response
  note               text,
  created_at         timestamptz not null default timezone('utc', now()),
  processed_at       timestamptz,
  updated_at         timestamptz not null default timezone('utc', now())
);

create index payments_tenant_idx     on public.payments (tenant_id);
create index payments_landlord_idx   on public.payments (landlord_id);
create index payments_status_idx     on public.payments (status);
create index payments_created_at_idx on public.payments (created_at desc);
create index payments_reference_idx  on public.payments (reference);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. STS TOKEN PURCHASES (LONGi vending ledger)
-- ---------------------------------------------------------------------------

create table public.token_purchases (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid references public.tenants(id) on delete set null,
  meter_id           uuid references public.meters(id)  on delete set null,
  meter_no           text not null,                  -- denormalized for receipts / history
  amount_kes         numeric(12,2) not null check (amount_kes >= 0),
  token_formatted    text not null,                  -- "5679-9426-0693-2990-4432"
  kct_token_1        text,
  kct_token_2        text,
  subsidy_token      text,
  longi_order_no     text,                           -- "ordno" from Ch. 7
  longi_sgc          integer,
  longi_ti           integer,
  longi_credit       numeric(12,3),                  -- units (m³) of water credit
  longi_raw_payload  jsonb,                          -- full transaction response
  source             public.token_source        not null default 'app',
  manual_channel     public.manual_token_channel,
  payment_id         uuid references public.payments(id) on delete set null,
  payment_ref        text,                           -- denorm for quick search
  issued_by          uuid references public.profiles(id) on delete set null,
  note               text,
  created_at         timestamptz not null default timezone('utc', now())
);

create index token_purchases_tenant_idx     on public.token_purchases (tenant_id);
create index token_purchases_meter_idx      on public.token_purchases (meter_id);
create index token_purchases_meter_no_idx   on public.token_purchases (meter_no);
create index token_purchases_created_at_idx on public.token_purchases (created_at desc);
create index token_purchases_source_idx     on public.token_purchases (source);

-- ---------------------------------------------------------------------------
-- 11. PAYOUTS (landlord settlements)
-- ---------------------------------------------------------------------------

create table public.payouts (
  id                uuid primary key default gen_random_uuid(),
  landlord_id       uuid not null references public.landlords(id) on delete cascade,
  period_label      text,                                   -- "Mar 2026"
  period_start      date,
  period_end        date,
  gross_kes         numeric(14,2) not null default 0,
  platform_fee_kes  numeric(14,2) not null default 0,
  net_payout_kes    numeric(14,2) not null default 0,
  rail              public.payout_rail   not null default 'm_pesa_b2b',
  status            public.payment_status not null default 'pending',
  reference         text,
  scheduled_at      timestamptz not null,
  paid_at           timestamptz,
  raw_payload       jsonb,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index payouts_landlord_idx     on public.payouts (landlord_id);
create index payouts_status_idx       on public.payouts (status);
create index payouts_scheduled_at_idx on public.payouts (scheduled_at desc);

create trigger payouts_set_updated_at
  before update on public.payouts
  for each row execute procedure public.set_updated_at();

-- Many-to-many: which payments were settled into which payout batch.
create table public.payout_payments (
  payout_id   uuid not null references public.payouts(id)  on delete cascade,
  payment_id  uuid not null references public.payments(id) on delete cascade,
  primary key (payout_id, payment_id)
);

create index payout_payments_payment_idx on public.payout_payments (payment_id);

-- ---------------------------------------------------------------------------
-- 12. STAFF (field technicians)
-- ---------------------------------------------------------------------------

create table public.staff (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,                          -- e.g. "STF-001"
  profile_id          uuid unique references public.profiles(id) on delete set null,
  full_name           text not null,
  phone               text,
  email               citext,
  region              text,
  status              public.staff_status not null default 'active',
  serves              public.staff_serves not null default 'both',
  completed_jobs_90d  integer not null default 0,
  notes               text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create index staff_status_idx on public.staff (status);

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute procedure public.set_updated_at();

create table public.staff_skills (
  staff_id  uuid not null references public.staff(id) on delete cascade,
  skill     public.staff_skill not null,
  primary key (staff_id, skill)
);

-- ---------------------------------------------------------------------------
-- 13. SERVICE REQUESTS + APPOINTMENTS
-- ---------------------------------------------------------------------------

create table public.service_requests (
  id                uuid primary key default gen_random_uuid(),
  code              text unique,
  tenant_id         uuid references public.tenants(id) on delete set null,
  landlord_id       uuid references public.landlords(id) on delete set null,
  building_id       uuid references public.buildings(id) on delete set null,
  unit_id           uuid references public.units(id)     on delete set null,
  service_type      text not null,                       -- "Plumbing Repair", etc.
  area              text,                                -- "Kitchen", "Block A Unit 12"
  fault_summary     text not null,
  preferred_date    date,
  urgency           public.service_urgency not null default 'standard',
  note              text,
  status            public.service_request_status not null default 'submitted',
  assigned_staff_id uuid references public.staff(id) on delete set null,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index service_requests_tenant_idx   on public.service_requests (tenant_id);
create index service_requests_landlord_idx on public.service_requests (landlord_id);
create index service_requests_status_idx   on public.service_requests (status);

create trigger service_requests_set_updated_at
  before update on public.service_requests
  for each row execute procedure public.set_updated_at();

create table public.appointments (
  id                  uuid primary key default gen_random_uuid(),
  service_request_id  uuid references public.service_requests(id) on delete set null,
  staff_id            uuid references public.staff(id) on delete set null,
  tenant_id           uuid references public.tenants(id) on delete set null,
  building_id         uuid references public.buildings(id) on delete set null,
  title               text not null,
  scheduled_at        timestamptz not null,
  duration_minutes    integer not null default 60,
  status              public.appointment_status not null default 'scheduled',
  note                text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create index appointments_scheduled_at_idx on public.appointments (scheduled_at);
create index appointments_staff_idx        on public.appointments (staff_id);
create index appointments_tenant_idx       on public.appointments (tenant_id);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 14. SHOP (catalog + orders)
-- ---------------------------------------------------------------------------

create table public.product_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  created_at  timestamptz not null default timezone('utc', now())
);

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  category_id       uuid references public.product_categories(id) on delete set null,
  name              text not null,
  short_description text,
  description       text,
  price_kes         numeric(12,2) not null default 0,
  stock             integer not null default 0,
  unit              text not null default 'piece',
  primary_image_url text,
  rating            numeric(3,2) not null default 0,
  tags              text[] not null default '{}',
  is_active         boolean not null default true,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

create index products_category_idx on public.products (category_id);
create index products_active_idx   on public.products (is_active);
create index products_name_trgm    on public.products using gin (name gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now())
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,                   -- "SO-20260514-1234"
  tenant_id          uuid references public.tenants(id) on delete set null,
  customer_profile_id uuid references public.profiles(id) on delete set null,
  phone_number       text not null,
  delivery_address   text,
  subtotal_kes       numeric(12,2) not null default 0,
  vat_kes            numeric(12,2) not null default 0,
  delivery_fee_kes   numeric(12,2) not null default 0,
  total_kes          numeric(12,2) not null default 0,
  status             public.order_status not null default 'pending_payment',
  payment_id         uuid references public.payments(id) on delete set null,
  note               text,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

create index orders_tenant_idx   on public.orders (tenant_id);
create index orders_status_idx   on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  product_name    text not null,
  quantity        integer not null check (quantity > 0),
  unit_price_kes  numeric(12,2) not null check (unit_price_kes >= 0),
  line_total_kes  numeric(12,2) not null check (line_total_kes >= 0),
  created_at      timestamptz not null default timezone('utc', now())
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- 15. NOTIFICATIONS / ALERTS
-- ---------------------------------------------------------------------------

create table public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_profile_id  uuid not null references public.profiles(id) on delete cascade,
  category              public.notification_category not null,
  severity              public.notification_severity not null default 'info',
  title                 text not null,
  description           text,
  href                  text,
  related_meter_id      uuid references public.meters(id)   on delete set null,
  related_tenant_id     uuid references public.tenants(id)  on delete set null,
  related_payment_id    uuid references public.payments(id) on delete set null,
  related_order_id      uuid references public.orders(id)   on delete set null,
  related_payout_id     uuid references public.payouts(id)  on delete set null,
  metadata              jsonb,
  read_at               timestamptz,
  dismissed_at          timestamptz,
  created_at            timestamptz not null default timezone('utc', now())
);

create index notifications_recipient_idx on public.notifications (recipient_profile_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (recipient_profile_id)
  where read_at is null and dismissed_at is null;
create index notifications_category_idx on public.notifications (category);

-- ---------------------------------------------------------------------------
-- 16. ACTIVITY LOG (audit trail)
-- ---------------------------------------------------------------------------

create table public.activity_logs (
  id                uuid primary key default gen_random_uuid(),
  actor_profile_id  uuid references public.profiles(id) on delete set null,
  actor_role        public.user_role,
  action            text not null,                  -- e.g. "tenant.created", "payout.scheduled"
  target_table      text,
  target_id         text,                           -- text so it can hold non-uuid keys
  before_state      jsonb,
  after_state       jsonb,
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz not null default timezone('utc', now())
);

create index activity_logs_actor_idx       on public.activity_logs (actor_profile_id);
create index activity_logs_action_idx      on public.activity_logs (action);
create index activity_logs_target_idx      on public.activity_logs (target_table, target_id);
create index activity_logs_created_at_idx  on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- 17. SETTINGS
-- ---------------------------------------------------------------------------

create table public.landlord_settings (
  landlord_id           uuid primary key references public.landlords(id) on delete cascade,
  notify_email          boolean not null default true,
  notify_sms            boolean not null default false,
  notify_push           boolean not null default true,
  digest_weekly         boolean not null default true,
  alert_meter_fault     boolean not null default true,
  alert_meter_offline   boolean not null default true,
  alert_payment_failed  boolean not null default true,
  alert_tenant_arrears  boolean not null default true,
  contact_email         citext,
  contact_phone         text,
  mpesa_till_label      text,
  bank_account_label    text,
  updated_at            timestamptz not null default timezone('utc', now())
);

create trigger landlord_settings_set_updated_at
  before update on public.landlord_settings
  for each row execute procedure public.set_updated_at();

create table public.tenant_settings (
  tenant_id          uuid primary key references public.tenants(id) on delete cascade,
  payment_alerts     boolean not null default true,
  service_alerts     boolean not null default true,
  low_balance_alerts boolean not null default true,
  push_enabled       boolean not null default true,
  updated_at         timestamptz not null default timezone('utc', now())
);

create trigger tenant_settings_set_updated_at
  before update on public.tenant_settings
  for each row execute procedure public.set_updated_at();

-- Platform-wide settings (singleton-ish, key/value).
create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default timezone('utc', now())
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute procedure public.set_updated_at();

insert into public.platform_settings (key, value) values
  ('platform_fee_rate', to_jsonb(0.05::numeric)),
  ('default_vat_rate',  to_jsonb(0.16::numeric)),
  ('currency',          to_jsonb('KES'::text))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 18. INTEGRATIONS — cached LONGi sessions + Paystack references
-- ---------------------------------------------------------------------------

create table public.longi_sessions (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null,
  username     text not null,
  merchant     text,
  balance      numeric(14,2),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default timezone('utc', now())
);

create index longi_sessions_expires_idx on public.longi_sessions (expires_at desc);

create table public.paystack_transactions (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  payment_id          uuid references public.payments(id)   on delete set null,
  order_id            uuid references public.orders(id)     on delete set null,
  token_purchase_id   uuid references public.token_purchases(id) on delete set null,
  amount_kes          numeric(12,2) not null,
  email               citext,
  status              text not null default 'initialized',
  authorization_url   text,
  access_code         text,
  raw_payload         jsonb,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);

create trigger paystack_transactions_set_updated_at
  before update on public.paystack_transactions
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 19. CONVENIENCE VIEWS used by dashboard / landlord portal screens
-- ---------------------------------------------------------------------------

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
  t.updated_at
from public.tenants t
left join public.landlords l on l.id = t.landlord_id
left join public.buildings b on b.id = t.building_id
left join public.units     u on u.id = t.unit_id
left join public.meters    m on m.id = t.meter_id;

create or replace view public.meter_directory as
select
  m.id,
  m.meter_no,
  m.serial_number,
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
  t.full_name  as tenant_name
from public.meters m
left join public.landlords l on l.id = m.landlord_id
left join public.buildings b on b.id = m.building_id
left join public.units     u on u.id = m.unit_id
left join public.tenants   t on t.meter_id = m.id;

-- ---------------------------------------------------------------------------
-- END OF SCHEMA
-- ---------------------------------------------------------------------------
