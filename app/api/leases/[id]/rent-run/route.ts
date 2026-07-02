import { NextResponse } from "next/server";

import {
  buildRentEntries, insertLedgerEntries, postedRentPeriods, refreshTenantBalance,
} from "@/lib/billing/queries";
import { getLeaseById } from "@/lib/leases/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Posts any outstanding monthly rent charges for a lease, up to the current
 * month. Idempotent: periods already charged are skipped.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const lease = await getLeaseById(server, id); // RLS-scoped to admin/landlord
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  if (!lease.rent_kes || !lease.start_date) {
    return NextResponse.json(
      { ok: false, error: "Lease has no rent amount or start date" }, { status: 422 }
    );
  }

  const admin = getSupabaseAdminClient();
  const already = await postedRentPeriods(admin, lease.id);
  const entries = buildRentEntries(
    {
      id: lease.id,
      tenant_id: lease.tenant_id,
      landlord_id: lease.landlord_id,
      rent_kes: lease.rent_kes,
      start_date: lease.start_date,
      end_date: lease.end_date,
      payment_day: lease.payment_day,
    },
    new Date(),
    already
  );
  const posted = await insertLedgerEntries(admin, entries);
  const balance = await refreshTenantBalance(admin, lease.tenant_id);

  return NextResponse.json({ ok: true, posted, balance });
}
