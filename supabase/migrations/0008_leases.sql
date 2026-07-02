-- 0008_leases.sql — Leases & contracts: templates, lease records, signatures.

create type public.lease_status as enum
  ('draft', 'pending_signature', 'active', 'expired', 'terminated', 'cancelled');
create type public.lease_signer_role as enum ('tenant', 'landlord');

-- ---------- lease_templates ----------------------------------------------
create table public.lease_templates (
  id             uuid primary key default gen_random_uuid(),
  landlord_id    uuid references public.landlords(id) on delete cascade, -- null = global
  name           text not null,
  description    text,
  clauses        jsonb not null default '[]'::jsonb,  -- [{key,title,body_markdown,editable}]
  governing_law  text not null default 'Laws of Kenya',
  is_active      boolean not null default true,
  version        int not null default 1,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);
create index lease_templates_landlord_idx on public.lease_templates (landlord_id);
create trigger lease_templates_set_updated_at
  before update on public.lease_templates
  for each row execute procedure public.set_updated_at();

-- ---------- leases --------------------------------------------------------
create table public.leases (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique,
  landlord_id         uuid not null references public.landlords(id) on delete cascade,
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  building_id         uuid references public.buildings(id) on delete set null,
  unit_id             uuid references public.units(id) on delete set null,
  template_id         uuid references public.lease_templates(id) on delete set null,
  -- snapshot fields (frozen at generation)
  landlord_name       text,
  tenant_name         text,
  tenant_national_id  text,
  property_label      text,
  rent_kes            numeric(12,2) check (rent_kes is null or rent_kes >= 0),
  deposit_kes         numeric(12,2) check (deposit_kes is null or deposit_kes >= 0),
  frequency           text not null default 'monthly',
  payment_day         int check (payment_day is null or (payment_day >= 1 and payment_day <= 31)),
  start_date          date,
  end_date            date,
  clause_overrides    jsonb not null default '{}'::jsonb,
  status              public.lease_status not null default 'draft',
  document_url        text,
  signed_document_url text,
  signed_at           timestamptz,
  terminated_at       timestamptz,
  termination_reason  text,
  notes               text,
  created_at          timestamptz not null default timezone('utc', now()),
  updated_at          timestamptz not null default timezone('utc', now())
);
create index leases_landlord_idx on public.leases (landlord_id);
create index leases_tenant_idx   on public.leases (tenant_id);
create index leases_status_idx   on public.leases (status);
create index leases_end_date_idx on public.leases (end_date);
create trigger leases_set_updated_at
  before update on public.leases
  for each row execute procedure public.set_updated_at();

-- ---------- lease_signatures ---------------------------------------------
create table public.lease_signatures (
  id                 uuid primary key default gen_random_uuid(),
  lease_id           uuid not null references public.leases(id) on delete cascade,
  signer_profile_id  uuid references public.profiles(id) on delete set null,
  signer_role        public.lease_signer_role not null,
  signer_name        text not null,
  signature_path     text not null,
  signed_at          timestamptz not null default timezone('utc', now()),
  signer_ip          text,
  user_agent         text,
  unique (lease_id, signer_role)
);
create index lease_signatures_lease_idx on public.lease_signatures (lease_id);

-- ---------- human-readable code generator --------------------------------
create function public.next_lease_code() returns text
  language sql as $$
  select 'LSE-' || lpad((count(*) + 1)::text, 4, '0') from public.leases;
$$;

-- ---------- RLS -----------------------------------------------------------
alter table public.lease_templates  enable row level security;
alter table public.leases           enable row level security;
alter table public.lease_signatures enable row level security;

-- lease_templates
create policy "lease_templates_admin_full" on public.lease_templates
  for all using (public.is_admin()) with check (public.is_admin());
create policy "lease_templates_landlord_read_global" on public.lease_templates
  for select using (landlord_id is null or landlord_id in (select public.current_landlord_ids()));
create policy "lease_templates_landlord_write_own" on public.lease_templates
  for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

-- leases
create policy "leases_admin_full" on public.leases
  for all using (public.is_admin()) with check (public.is_admin());
create policy "leases_landlord_full" on public.leases
  for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));
create policy "leases_tenant_read" on public.leases
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = leases.tenant_id and t.profile_id = auth.uid()
    )
  );

-- lease_signatures
create policy "lease_signatures_admin_full" on public.lease_signatures
  for all using (public.is_admin()) with check (public.is_admin());
create policy "lease_signatures_landlord_read" on public.lease_signatures
  for select using (
    exists (
      select 1 from public.leases l
      where l.id = lease_signatures.lease_id
        and l.landlord_id in (select public.current_landlord_ids())
    )
  );
create policy "lease_signatures_tenant_read" on public.lease_signatures
  for select using (
    exists (
      select 1 from public.leases l
      join public.tenants t on t.id = l.tenant_id
      where l.id = lease_signatures.lease_id and t.profile_id = auth.uid()
    )
  );

-- ---------- seed: one global Kenyan residential template -----------------
insert into public.lease_templates (landlord_id, name, description, clauses)
values (
  null,
  'Kenya Residential Tenancy Agreement',
  'Standard month-to-month residential tenancy for SMARTONE landlords.',
  '[
    {"key":"parties","title":"1. Parties","editable":false,
      "body_markdown":"This Tenancy Agreement is made between **{{landlord_name}}** (the Landlord) and **{{tenant_name}}**, ID **{{tenant_national_id}}** (the Tenant)."},
    {"key":"premises","title":"2. Premises","editable":false,
      "body_markdown":"The Landlord lets to the Tenant the premises known as **{{property_label}}**."},
    {"key":"term","title":"3. Term","editable":false,
      "body_markdown":"The tenancy runs from **{{start_date}}** to **{{end_date}}**, payable **{{frequency}}**."},
    {"key":"rent","title":"4. Rent & Deposit","editable":false,
      "body_markdown":"Rent is **KES {{rent_kes}}** per period, due on day **{{payment_day}}**. A deposit of **KES {{deposit_kes}}** is held by the Landlord."},
    {"key":"special_conditions","title":"5. Special Conditions","editable":true,
      "body_markdown":"None."},
    {"key":"house_rules","title":"6. House Rules","editable":true,
      "body_markdown":"The Tenant shall keep the premises clean and shall not cause nuisance."}
  ]'::jsonb
);

-- ---------- backfill: one lease per tenant that already has lease data ----
insert into public.leases
  (code, landlord_id, tenant_id, building_id, unit_id,
   tenant_name, tenant_national_id, rent_kes, deposit_kes,
   start_date, end_date, status, notes)
select
  'LSE-' || lpad((row_number() over (order by t.created_at))::text, 4, '0'),
  t.landlord_id, t.id, t.building_id, t.unit_id,
  t.full_name, t.national_id,
  coalesce(u.rent_kes, b.rent_kes), t.deposit_amount_paid,
  t.account_opened::date, t.lease_end_date, 'active', 'Backfilled from tenant record.'
from public.tenants t
left join public.units u on u.id = t.unit_id
left join public.buildings b on b.id = t.building_id
where (t.account_opened is not null or t.lease_end_date is not null)
  and not exists (select 1 from public.leases l where l.tenant_id = t.id);
