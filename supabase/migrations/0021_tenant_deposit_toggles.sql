      -- Reconcile per-tenant deposit config to pay/waive toggles (amounts now on units).
      alter table public.tenants
        drop column if exists water_deposit_amount,
        drop column if exists electricity_deposit_amount;

      alter table public.tenants rename column water_deposit_required to pays_water_deposit;
      alter table public.tenants rename column electricity_deposit_required to pays_electricity_deposit;

      alter table public.tenants
        alter column pays_water_deposit set default true,
        alter column pays_electricity_deposit set default true,
        add column if not exists pays_rent_deposit boolean not null default true;

      comment on column public.tenants.pays_water_deposit is 'Whether this tenant pays the unit water-meter deposit (waivable).';
      comment on column public.tenants.pays_electricity_deposit is 'Whether this tenant pays the unit electricity-meter deposit (waivable).';
      comment on column public.tenants.pays_rent_deposit is 'Whether this tenant pays the unit rent deposit (waivable).';
