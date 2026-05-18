-- ============================================================================
-- Row Level Security (RLS) — Smart Plumbing
--
-- Roles (stored in public.profiles.role):
--   admin     -> full read/write everywhere
--   landlord  -> read/write own portfolio (buildings, units, tenants, meters,
--                pricing, payments received, payouts, settings)
--   tenant    -> read own profile + own meter, own tokens, own payments,
--                own orders, own service requests, own notifications
--   staff     -> read assignments (service requests / appointments assigned
--                to them); update appointment status
--
-- Note: every helper (`is_admin`, `current_landlord_ids`, …) is SECURITY DEFINER
-- and reads from public.profiles, so RLS on profiles cannot deadlock policies.
-- ============================================================================

-- Enable RLS on all tables.
alter table public.profiles                enable row level security;
alter table public.landlords               enable row level security;
alter table public.buildings               enable row level security;
alter table public.units                   enable row level security;
alter table public.water_pricing           enable row level security;
alter table public.meters                  enable row level security;
alter table public.tenants                 enable row level security;
alter table public.payments                enable row level security;
alter table public.token_purchases         enable row level security;
alter table public.payouts                 enable row level security;
alter table public.payout_payments         enable row level security;
alter table public.staff                   enable row level security;
alter table public.staff_skills            enable row level security;
alter table public.service_requests        enable row level security;
alter table public.appointments            enable row level security;
alter table public.product_categories      enable row level security;
alter table public.products                enable row level security;
alter table public.product_images          enable row level security;
alter table public.orders                  enable row level security;
alter table public.order_items             enable row level security;
alter table public.notifications           enable row level security;
alter table public.activity_logs           enable row level security;
alter table public.landlord_settings       enable row level security;
alter table public.tenant_settings         enable row level security;
alter table public.platform_settings       enable row level security;
alter table public.longi_sessions          enable row level security;
alter table public.paystack_transactions   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_self_read"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_admin_full"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- landlords
-- ---------------------------------------------------------------------------
create policy "landlords_admin_full"
  on public.landlords for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "landlords_self_read"
  on public.landlords for select
  using (profile_id = auth.uid());

create policy "landlords_self_update"
  on public.landlords for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Tenants can see their own landlord (read-only).
create policy "landlords_tenant_read"
  on public.landlords for select
  using (
    exists (
      select 1 from public.tenants t
      where t.landlord_id = landlords.id
        and t.profile_id  = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- buildings
-- ---------------------------------------------------------------------------
create policy "buildings_admin_full"
  on public.buildings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "buildings_landlord_full"
  on public.buildings for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

-- Tenants can read their own building.
create policy "buildings_tenant_read"
  on public.buildings for select
  using (
    exists (
      select 1 from public.tenants t
      where t.building_id = buildings.id
        and t.profile_id  = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------
create policy "units_admin_full"
  on public.units for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "units_landlord_full"
  on public.units for all
  using (
    exists (
      select 1 from public.buildings b
      where b.id = units.building_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  )
  with check (
    exists (
      select 1 from public.buildings b
      where b.id = units.building_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "units_tenant_read"
  on public.units for select
  using (
    exists (
      select 1 from public.tenants t
      where t.unit_id = units.id
        and t.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- water_pricing
-- ---------------------------------------------------------------------------
create policy "water_pricing_admin_full"
  on public.water_pricing for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "water_pricing_landlord_full"
  on public.water_pricing for all
  using (
    exists (
      select 1 from public.buildings b
      where b.id = water_pricing.building_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  )
  with check (
    exists (
      select 1 from public.buildings b
      where b.id = water_pricing.building_id
        and b.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "water_pricing_tenant_read"
  on public.water_pricing for select
  using (
    exists (
      select 1 from public.tenants t
      where t.building_id = water_pricing.building_id
        and t.profile_id  = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- meters
-- ---------------------------------------------------------------------------
create policy "meters_admin_full"
  on public.meters for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "meters_landlord_full"
  on public.meters for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

-- Tenant can read their own meter.
create policy "meters_tenant_read"
  on public.meters for select
  using (
    exists (
      select 1 from public.tenants t
      where t.meter_id  = meters.id
        and t.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
create policy "tenants_admin_full"
  on public.tenants for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "tenants_landlord_full"
  on public.tenants for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

create policy "tenants_self_read"
  on public.tenants for select
  using (profile_id = auth.uid());

create policy "tenants_self_update"
  on public.tenants for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create policy "payments_admin_full"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "payments_landlord_read"
  on public.payments for select
  using (
    landlord_id in (select public.current_landlord_ids())
    or exists (
      select 1 from public.tenants t
      where t.id = payments.tenant_id
        and t.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "payments_landlord_write"
  on public.payments for insert
  with check (
    landlord_id in (select public.current_landlord_ids())
    or exists (
      select 1 from public.tenants t
      where t.id = payments.tenant_id
        and t.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "payments_landlord_update"
  on public.payments for update
  using (
    landlord_id in (select public.current_landlord_ids())
    or exists (
      select 1 from public.tenants t
      where t.id = payments.tenant_id
        and t.landlord_id in (select public.current_landlord_ids())
    )
  )
  with check (
    landlord_id in (select public.current_landlord_ids())
    or exists (
      select 1 from public.tenants t
      where t.id = payments.tenant_id
        and t.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "payments_tenant_read"
  on public.payments for select
  using (tenant_id in (select public.current_tenant_ids()));

-- ---------------------------------------------------------------------------
-- token_purchases
-- ---------------------------------------------------------------------------
create policy "token_purchases_admin_full"
  on public.token_purchases for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "token_purchases_landlord_read"
  on public.token_purchases for select
  using (
    exists (
      select 1 from public.tenants t
      where t.id = token_purchases.tenant_id
        and t.landlord_id in (select public.current_landlord_ids())
    )
  );

create policy "token_purchases_tenant_read"
  on public.token_purchases for select
  using (tenant_id in (select public.current_tenant_ids()));

-- Inserts come from the trusted vending API (server-role).
-- We still allow landlords to insert manual rows for their own meters.
create policy "token_purchases_landlord_manual_insert"
  on public.token_purchases for insert
  with check (
    exists (
      select 1 from public.tenants t
      where t.id = token_purchases.tenant_id
        and t.landlord_id in (select public.current_landlord_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- payouts
-- ---------------------------------------------------------------------------
create policy "payouts_admin_full"
  on public.payouts for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "payouts_landlord_read"
  on public.payouts for select
  using (landlord_id in (select public.current_landlord_ids()));

create policy "payouts_landlord_write"
  on public.payouts for insert
  with check (landlord_id in (select public.current_landlord_ids()));

create policy "payouts_landlord_update"
  on public.payouts for update
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

create policy "payout_payments_admin_full"
  on public.payout_payments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "payout_payments_landlord_read"
  on public.payout_payments for select
  using (
    exists (
      select 1 from public.payouts p
      where p.id = payout_payments.payout_id
        and p.landlord_id in (select public.current_landlord_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create policy "staff_admin_full"
  on public.staff for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "staff_self_read"
  on public.staff for select
  using (profile_id = auth.uid());

-- Landlords + tenants can read staff (to see assigned technicians).
create policy "staff_authenticated_read"
  on public.staff for select
  using (auth.role() = 'authenticated');

create policy "staff_skills_admin_full"
  on public.staff_skills for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "staff_skills_authenticated_read"
  on public.staff_skills for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- service_requests / appointments
-- ---------------------------------------------------------------------------
create policy "service_requests_admin_full"
  on public.service_requests for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "service_requests_tenant_self"
  on public.service_requests for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create policy "service_requests_landlord_read"
  on public.service_requests for select
  using (landlord_id in (select public.current_landlord_ids()));

create policy "service_requests_staff_assigned"
  on public.service_requests for select
  using (
    exists (
      select 1 from public.staff s
      where s.id = service_requests.assigned_staff_id
        and s.profile_id = auth.uid()
    )
  );

create policy "appointments_admin_full"
  on public.appointments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "appointments_tenant_self"
  on public.appointments for select
  using (tenant_id in (select public.current_tenant_ids()));

create policy "appointments_staff_self"
  on public.appointments for all
  using (
    exists (
      select 1 from public.staff s
      where s.id = appointments.staff_id
        and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.staff s
      where s.id = appointments.staff_id
        and s.profile_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- shop: categories + products + images
--   - Catalog browsing is allowed for any authenticated user.
--   - Mutations are admin-only.
-- ---------------------------------------------------------------------------
create policy "product_categories_admin_full"
  on public.product_categories for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_categories_authenticated_read"
  on public.product_categories for select
  using (auth.role() = 'authenticated');

create policy "products_admin_full"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "products_authenticated_read"
  on public.products for select
  using (auth.role() = 'authenticated' and is_active);

create policy "product_images_admin_full"
  on public.product_images for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "product_images_authenticated_read"
  on public.product_images for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- orders + order_items
-- ---------------------------------------------------------------------------
create policy "orders_admin_full"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "orders_customer_self"
  on public.orders for all
  using (
    customer_profile_id = auth.uid()
    or tenant_id in (select public.current_tenant_ids())
  )
  with check (
    customer_profile_id = auth.uid()
    or tenant_id in (select public.current_tenant_ids())
  );

create policy "order_items_admin_full"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "order_items_customer_self"
  on public.order_items for all
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_profile_id = auth.uid()
             or o.tenant_id in (select public.current_tenant_ids()))
    )
  )
  with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_profile_id = auth.uid()
             or o.tenant_id in (select public.current_tenant_ids()))
    )
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy "notifications_admin_full"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "notifications_recipient_read"
  on public.notifications for select
  using (recipient_profile_id = auth.uid());

create policy "notifications_recipient_update"
  on public.notifications for update
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- activity_logs
--   - Visible only to admins. Inserts come from server-role / triggers.
-- ---------------------------------------------------------------------------
create policy "activity_logs_admin_read"
  on public.activity_logs for select
  using (public.is_admin());

create policy "activity_logs_admin_write"
  on public.activity_logs for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- settings
-- ---------------------------------------------------------------------------
create policy "landlord_settings_admin_full"
  on public.landlord_settings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "landlord_settings_self"
  on public.landlord_settings for all
  using (landlord_id in (select public.current_landlord_ids()))
  with check (landlord_id in (select public.current_landlord_ids()));

create policy "tenant_settings_admin_full"
  on public.tenant_settings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "tenant_settings_self"
  on public.tenant_settings for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create policy "platform_settings_admin_full"
  on public.platform_settings for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "platform_settings_authenticated_read"
  on public.platform_settings for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- integrations (server-only data)
-- ---------------------------------------------------------------------------
create policy "longi_sessions_admin_only"
  on public.longi_sessions for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "paystack_transactions_admin_full"
  on public.paystack_transactions for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "paystack_transactions_tenant_read"
  on public.paystack_transactions for select
  using (
    exists (
      select 1 from public.payments p
      where p.id = paystack_transactions.payment_id
        and p.tenant_id in (select public.current_tenant_ids())
    )
  );
