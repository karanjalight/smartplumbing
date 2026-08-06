-- Deposits are collectible payments. A new enum value cannot be referenced in
-- the same transaction it is added, so this migration ships alone
-- (see 0015_electricity_meter_types.sql).
alter type public.payment_category add value if not exists 'deposit';
