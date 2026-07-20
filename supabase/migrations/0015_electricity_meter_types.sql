-- Add electricity prepay meter types, mirroring LONGi meterType 0 (kWh) and 4 (currency).
-- Ships alone: a new enum value cannot be referenced by any statement in the
-- same transaction that adds it, so this must not be combined with a
-- migration that uses the new values.
alter type public.meter_model_type add value 'electricity_prepay_kwh';
alter type public.meter_model_type add value 'electricity_prepay_currency';
