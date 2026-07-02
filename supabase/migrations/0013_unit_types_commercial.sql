-- 0013_unit_types_commercial.sql
--
-- Broaden the residential-only `unit_type` enum with commercial + parking
-- classifications so the admin Units view can filter/group across the whole
-- portfolio. Additive only — units still require a parent building.
--
-- Each ADD VALUE is idempotent (IF NOT EXISTS) and the new labels are not used
-- in this migration, so it is safe under the migration runner.

alter type public.unit_type add value if not exists 'commercial';
alter type public.unit_type add value if not exists 'office';
alter type public.unit_type add value if not exists 'shop';
alter type public.unit_type add value if not exists 'warehouse';
alter type public.unit_type add value if not exists 'parking';
alter type public.unit_type add value if not exists 'other';
