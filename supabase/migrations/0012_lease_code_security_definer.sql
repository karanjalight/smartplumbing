-- 0012_lease_code_security_definer.sql
--
-- `leases.code` is globally UNIQUE, but `next_lease_code()` was plain SQL and
-- therefore counted `public.leases` under the *caller's* RLS. A landlord only
-- sees their own leases (policy `leases_landlord_full`), so two different
-- landlords would each compute `LSE-0001` and the second INSERT would fail the
-- unique constraint. Recreate the generator as SECURITY DEFINER so the count is
-- global and the sequence is monotonic across the whole platform.

create or replace function public.next_lease_code() returns text
  language sql
  security definer
  set search_path = public
as $$
  select 'LSE-' || lpad((count(*) + 1)::text, 4, '0') from public.leases;
$$;
