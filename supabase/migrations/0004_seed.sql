-- ============================================================================
-- Seed data — mirrors lib/tenants-data.ts, lib/landlords-data.ts,
-- lib/buildings-data.ts, lib/meters-data.ts, lib/shop-catalog.ts, lib/staff-data.ts
--
-- Idempotent: every insert uses `on conflict (code) do nothing` or similar so
-- repeated runs of `supabase db reset` won't double up.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Landlords
-- ---------------------------------------------------------------------------
insert into public.landlords
  (code, full_name, company, phone, email, region, account_opened,
   payout_schedule, status, monthly_collection_kes, open_alerts_count)
values
  ('LND-001', 'Esther Wanjiku', 'Wanjiku Properties Ltd',  '+254 720 100 200', 'esther@wanjikuproperties.co.ke', 'Nairobi County', '2024-03-12', 'monthly',  'active', 312400, 2),
  ('LND-002', 'Daniel Omondi',  'Metro Homes Kenya',       '+254 733 200 300', 'd.omondi@metrohomes.ke',         'Nairobi County', '2024-06-01', 'biweekly', 'active', 198750, 0),
  ('LND-003', 'Sarah Muthoni',  'Green Valley Developments','+254 711 300 400', 'sarah@gvdevelopments.co.ke',     'Kiambu County',  '2025-01-20', 'monthly',  'active', 267100, 1),
  ('LND-004', 'Joseph Kamau',   'Lakeview Housing Co-op',  '+254 722 400 500', 'jkamau@lakeviewhousing.or.ke',   'Nakuru County',  '2026-02-01', 'monthly',  'pending_verification', 0, 0),
  ('LND-005', 'Ruth Achieng',   'Coastal Properties Ltd',  '+254 733 500 600', 'ruth@coastalproperties.co.ke',   'Mombasa County', '2023-08-10', 'monthly',  'suspended', 0, 4)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Buildings
-- ---------------------------------------------------------------------------
insert into public.buildings
  (code, landlord_id, name, address_line, city, caretaker_name, caretaker_phone,
   house_count, meter_count, rent_model, rent_kes)
select v.code, l.id, v.name, v.address_line, v.city, v.caretaker_name,
       v.caretaker_phone, v.house_count, v.meter_count,
       v.rent_model::public.rent_model, v.rent_kes
from (values
  ('BLD-001', 'LND-001', 'Sunrise Apartments',  'Thika Road, Ruiru',        'Nairobi', 'John Mwangi',  '+254 722 100 001', 48,  48,  'per_unit',       18500),
  ('BLD-002', 'LND-002', 'Riverside Court',     'Woodvale Grove, Westlands','Nairobi', 'Alice Wambui', '+254 733 200 002', 120, 118, 'per_unit',       32000),
  ('BLD-003', 'LND-003', 'Green Valley Estate', 'Kiambu Road',              'Kiambu',  'Peter Ndegwa', '+254 711 300 003', 36,  36,  'whole_building', 540000),
  ('BLD-004', 'LND-004', 'Lakeview Phase 1',    'Lake Nakuru view road',    'Nakuru',  'Rose Chebet',  '+254 722 400 004', 6,   6,   'per_unit',       14000),
  ('BLD-005', 'LND-005', 'Coastal Towers',      'Nyali Beach Road',         'Mombasa', 'Hassan Omar',  '+254 733 500 005', 24,  20,  'per_unit',       28000)
) as v(code, landlord_code, name, address_line, city, caretaker_name, caretaker_phone, house_count, meter_count, rent_model, rent_kes)
join public.landlords l on l.code = v.landlord_code
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Water pricing (seed one default row per building)
-- ---------------------------------------------------------------------------
insert into public.water_pricing
  (building_id, price_per_unit_kes, unit_definition, standing_charge_kes, min_charge_kes, vat_rate_pct, notes)
select b.id, 55, '1 m³ prepaid block', case when b.rent_model = 'whole_building' then 3200 else 400 end,
       100, 16, 'STS unit tariff — seed default'
from public.buildings b
where not exists (
  select 1 from public.water_pricing wp where wp.building_id = b.id
);

-- ---------------------------------------------------------------------------
-- Meters (seeded by mock tenants — meter_no is the LONGi natural ID)
-- ---------------------------------------------------------------------------
insert into public.meters
  (meter_no, serial_number, model_type, lifecycle_status, connectivity_status, landlord_id, building_id)
select v.meter_no, 'SN-' || lpad(regexp_replace(v.meter_no, '\D', '', 'g'), 12, '0'),
       v.model_type::public.meter_model_type,
       v.lifecycle::public.meter_lifecycle,
       v.connectivity::public.meter_connectivity,
       l.id, b.id
from (values
  ('0159000000640', 'water_prepay_m3',       'active',      'online',       'LND-001', 'BLD-001'),
  ('70000003130',   'water_prepay_currency', 'active',      'intermittent', 'LND-002', 'BLD-002'),
  ('0159000000891', 'water_prepay_m3',       'maintenance', 'offline',      'LND-001', 'BLD-001'),
  ('0159000001022', 'water_prepay_m3',       'active',      'online',       'LND-003', 'BLD-003'),
  ('70000004501',   'water_prepay_currency', 'inactive',    'offline',      'LND-002', 'BLD-002'),
  ('0159000000777', 'water_prepay_m3',       'active',      'online',       'LND-001', 'BLD-001'),
  ('70000005200',   'water_prepay_currency', 'active',      'intermittent', 'LND-003', 'BLD-003'),
  ('0159000000999', 'water_prepay_m3',       'active',      'online',       'LND-002', 'BLD-002'),
  ('70000006112',   'water_prepay_currency', 'active',      'intermittent', 'LND-001', 'BLD-001'),
  ('0159000000555', 'water_prepay_m3',       'active',      'online',       'LND-003', 'BLD-003')
) as v(meter_no, model_type, lifecycle, connectivity, landlord_code, building_code)
join public.landlords l on l.code = v.landlord_code
join public.buildings b on b.code = v.building_code
on conflict (meter_no) do nothing;

-- ---------------------------------------------------------------------------
-- Units (one per seeded tenant; created before tenants insert)
-- ---------------------------------------------------------------------------
insert into public.units (code, building_id, label, is_vacant)
select v.code, b.id, v.label, false
from (values
  ('U-001', 'BLD-001', 'Block A · Unit 12'),
  ('U-002', 'BLD-002', 'Tower 2 · Floor 5'),
  ('U-003', 'BLD-001', 'Block B · Unit 4'),
  ('U-004', 'BLD-003', 'House 18'),
  ('U-005', 'BLD-002', 'Tower 1 · Unit 8'),
  ('U-006', 'BLD-001', 'Block C · Unit 2'),
  ('U-007', 'BLD-003', 'House 3'),
  ('U-008', 'BLD-002', 'Tower 3 · Unit 11'),
  ('U-009', 'BLD-001', 'Block A · Unit 7'),
  ('U-010', 'BLD-003', 'House 22')
) as v(code, building_code, label)
join public.buildings b on b.code = v.building_code
on conflict (building_id, label) do nothing;

-- ---------------------------------------------------------------------------
-- Tenants (matches MOCK_TENANTS shape; profile_id stays null until users sign up)
-- ---------------------------------------------------------------------------
insert into public.tenants
  (code, landlord_id, building_id, unit_id, meter_id,
   full_name, phone, email, billing_model, status, balance_kes,
   last_token_at, last_token_preview)
select v.code, l.id, b.id, u.id, m.id,
       v.full_name, v.phone, v.email, 'prepaid_sts'::public.tenant_billing_model,
       v.status::public.tenant_status, v.balance_kes,
       v.last_token_at::timestamptz, v.last_token_preview
from (values
  ('TNT-2026-001', 'LND-001', 'BLD-001', 'U-001', '0159000000640', 'Mary Wanjiku',  '+254 712 345 678', 'mary.w@email.com',         'active',     1240, '2026-02-04 10:00', '5679-9426-0693-2990-4432'),
  ('TNT-2026-002', 'LND-002', 'BLD-002', 'U-002', '70000003130',   'James Ochieng', '+254 733 901 234', 'j.ochieng@email.com',      'low_credit',   85, '2026-02-01 10:00', '3330-3655-5982-2574-2945'),
  ('TNT-2026-003', 'LND-001', 'BLD-001', 'U-003', '0159000000891', 'Amina Hassan',  '+254 722 456 789', 'amina.hassan@email.com',   'overdue',       0, '2026-01-28 10:00', '5824-8151-0723-8904-2261'),
  ('TNT-2026-004', 'LND-003', 'BLD-003', 'U-004', '0159000001022', 'Peter Kimani',  '+254 711 222 333', 'peter.kimani@email.com',   'active',     5600, '2026-02-05 10:00', '1234-5678-9012-3456-7890'),
  ('TNT-2026-005', 'LND-002', 'BLD-002', 'U-005', '70000004501',   'Grace Mutua',   '+254 745 888 999', 'grace.mutua@email.com',    'inactive',    320, '2026-01-15 10:00', '9876-5432-1098-7654-3210'),
  ('TNT-2026-006', 'LND-001', 'BLD-001', 'U-006', '0159000000777', 'David Otieno',  '+254 701 111 222', 'david.otieno@email.com',   'active',     2100, '2026-02-03 10:00', '2468-1357-9753-0864-2468'),
  ('TNT-2026-007', 'LND-003', 'BLD-003', 'U-007', '70000005200',   'Lucy Njeri',    '+254 799 444 555', 'lucy.njeri@email.com',     'low_credit',   45, '2026-01-30 10:00', '1111-2222-3333-4444-5555'),
  ('TNT-2026-008', 'LND-002', 'BLD-002', 'U-008', '0159000000999', 'Brian Mwangi',  '+254 788 666 777', 'brian.mwangi@email.com',   'active',      890, '2026-02-02 10:00', '5555-6666-7777-8888-9999'),
  ('TNT-2026-009', 'LND-001', 'BLD-001', 'U-009', '70000006112',   'Faith Akinyi',  '+254 723 000 111', 'faith.akinyi@email.com',   'overdue',       0, '2025-12-20 10:00', '0000-1111-2222-3333-4444'),
  ('TNT-2026-010', 'LND-003', 'BLD-003', 'U-010', '0159000000555', 'Kevin Kipchoge','+254 756 321 654', 'kevin.kipchoge@email.com', 'active',     4500, '2026-02-05 10:00', '9999-8888-7777-6666-5555')
) as v(code, landlord_code, building_code, unit_code, meter_no, full_name, phone, email, status, balance_kes, last_token_at, last_token_preview)
join public.landlords l on l.code = v.landlord_code
join public.buildings b on b.code = v.building_code
join public.units     u on u.code = v.unit_code
join public.meters    m on m.meter_no = v.meter_no
on conflict (code) do nothing;

-- Wire meters back to their tenants now that tenants exist.
update public.meters m
   set unit_id  = t.unit_id,
       latest_reading_m3 = coalesce(m.latest_reading_m3, 50)
  from public.tenants t
 where t.meter_id = m.id;

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------
insert into public.staff (code, full_name, phone, email, region, status, serves, completed_jobs_90d, notes)
values
  ('STF-001', 'James Omondi',     '+254 712 100 201', 'j.omondi@malismart.ke',     'Nairobi County', 'active',   'both',     42, 'Lead plumber — burst pipes, leaks, meter box issues.'),
  ('STF-002', 'Mary Wanjiku',     '+254 723 200 302', 'm.wanjiku@malismart.ke',    'Nairobi County', 'active',   'tenants',  31, 'DB faults, prepaid meter power paths.'),
  ('STF-003', 'Peter Kiprotich',  '+254 711 300 403', 'p.kiprotich@malismart.ke',  'Kiambu County',  'active',   'both',     28, 'STS / LONGi field checks with landlords.'),
  ('STF-004', 'Grace Akinyi',     '+254 734 400 504', 'g.akinyi@malismart.ke',     'Kiambu County',  'on_leave', 'landlords', 0, 'On leave until Apr 15.'),
  ('STF-005', 'David Mwangi',     '+254 722 500 605', 'd.mwangi@malismart.ke',     'Nakuru County',  'active',   'both',     19, 'Pump rooms, tanks, pressure issues.'),
  ('STF-006', 'Lucy Chebet',      '+254 700 600 706', 'l.chebet@malismart.ke',     'Nairobi County', 'inactive', 'tenants',   0, 'Former contractor.')
on conflict (code) do nothing;

insert into public.staff_skills (staff_id, skill)
select s.id, x.skill::public.staff_skill
from (values
  ('STF-001', 'plumbing'),
  ('STF-001', 'general_maintenance'),
  ('STF-002', 'electrical'),
  ('STF-002', 'hvac'),
  ('STF-003', 'plumbing'),
  ('STF-003', 'meter_support'),
  ('STF-004', 'electrical'),
  ('STF-004', 'general_maintenance'),
  ('STF-005', 'general_maintenance'),
  ('STF-005', 'hvac'),
  ('STF-006', 'meter_support'),
  ('STF-006', 'plumbing')
) as x(code, skill)
join public.staff s on s.code = x.code
on conflict (staff_id, skill) do nothing;

-- ---------------------------------------------------------------------------
-- Shop catalog
-- ---------------------------------------------------------------------------
insert into public.product_categories (slug, name)
values
  ('household',         'Household'),
  ('repairs',           'Repairs'),
  ('electronics',       'Electronics'),
  ('towels-and-clothes','Towels & Clothes')
on conflict (slug) do nothing;

insert into public.products
  (slug, category_id, name, short_description, description, price_kes, stock, unit, primary_image_url, rating, tags)
select v.slug, c.id, v.name, v.short_description, v.description, v.price_kes,
       v.stock, v.unit, v.primary_image_url, v.rating, v.tags
from (values
  ('microfiber-cleaning-kit', 'household',
    'Microfiber Cleaning Kit',
    'Set of lint-free cloths for kitchen and bathroom cleaning.',
    'Soft, durable microfiber cloths for daily cleaning around sinks, counters, mirrors, and appliances.',
    750, 48, 'pack',
    'https://images.pexels.com/photos/4239037/pexels-photo-4239037.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.6, array['cleaning','kitchen','bathroom']),
  ('chrome-faucet-head', 'repairs',
    'Chrome Faucet Head',
    'Universal replacement head for kitchen and bathroom taps.',
    'A universal faucet head with aerated flow and splash control.',
    1200, 35, 'piece',
    'https://images.pexels.com/photos/7027855/pexels-photo-7027855.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.7, array['tap','plumbing','repair']),
  ('smart-energy-kettle', 'electronics',
    'Smart Energy Kettle',
    'Fast-boil kettle with auto shutoff and low-energy mode.',
    'Electric kettle with fast heating coil and temperature safety controls.',
    3850, 22, 'piece',
    'https://images.pexels.com/photos/7345447/pexels-photo-7345447.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.4, array['appliance','kitchen','electric']),
  ('bath-towel-set', 'towels-and-clothes',
    'Cotton Bath Towel Set',
    'Absorbent cotton towels, ideal for short-term rentals.',
    'Premium cotton bath towels that dry quickly and hold softness after repeated washing.',
    2150, 40, 'set',
    'https://images.pexels.com/photos/6663465/pexels-photo-6663465.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.8, array['bathroom','linen','hospitality']),
  ('multi-tool-repair-set', 'repairs',
    'Multi-Tool Repair Set',
    'Household toolkit for quick plumbing and utility fixes.',
    'A compact toolkit with screwdrivers, pliers, adjustable wrench, and tape measure.',
    3200, 19, 'set',
    'https://images.pexels.com/photos/8985445/pexels-photo-8985445.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.5, array['toolkit','maintenance','service']),
  ('led-emergency-lantern', 'electronics',
    'LED Emergency Lantern',
    'Rechargeable lantern for power outages and night repairs.',
    'Portable LED lantern with long battery life and USB recharge support.',
    2650, 28, 'piece',
    'https://images.pexels.com/photos/7089010/pexels-photo-7089010.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.3, array['lighting','backup','safety']),
  ('heavy-duty-gloves', 'repairs',
    'Heavy Duty Service Gloves',
    'Protective gloves for plumbing and cleaning tasks.',
    'Rubberized, anti-slip gloves that protect hands during drain work and installations.',
    640, 64, 'pair',
    'https://images.pexels.com/photos/6195125/pexels-photo-6195125.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.2, array['safety','protection','tools']),
  ('laundry-basket-foldable', 'household',
    'Foldable Laundry Basket',
    'Space-saving laundry basket for apartment living.',
    'Lightweight foldable laundry basket with reinforced handles.',
    1450, 31, 'piece',
    'https://images.pexels.com/photos/3952236/pexels-photo-3952236.jpeg?auto=compress&cs=tinysrgb&w=800',
    4.4, array['laundry','storage','home'])
) as v(slug, category_slug, name, short_description, description, price_kes, stock, unit, primary_image_url, rating, tags)
join public.product_categories c on c.slug = v.category_slug
on conflict (slug) do nothing;
