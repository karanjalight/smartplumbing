import { NextResponse } from "next/server";

import { refreshTenantBalance } from "@/lib/billing/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LedgerCategory, LedgerDirection } from "@/lib/supabase/types";

const DIRECTIONS: LedgerDirection[] = ["debit", "credit"];
const CATEGORIES: LedgerCategory[] = [
  "rent", "deposit", "water", "service_charge", "late_fee",
  "payment", "adjustment", "refund",
];

/** Posts a manual ledger entry (a charge or a payment) for a tenant. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    direction?: LedgerDirection;
    category?: LedgerCategory;
    amount_kes?: number;
    description?: string;
    due_date?: string;
    reference?: string;
  };

  const direction = body.direction;
  const category = body.category;
  const amount = Number(body.amount_kes);
  if (!direction || !DIRECTIONS.includes(direction)) {
    return NextResponse.json({ ok: false, error: "Invalid direction" }, { status: 400 });
  }
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Amount must be greater than zero" }, { status: 400 });
  }

  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  // RLS confirms the caller (admin/landlord) may see this tenant.
  const { data: tenant } = await server
    .from("tenants").select("id, landlord_id").eq("id", id).maybeSingle();
  if (!tenant) {
    return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("ledger_entries").insert({
    tenant_id: tenant.id,
    landlord_id: tenant.landlord_id,
    direction,
    category,
    amount_kes: Math.round(amount * 100) / 100,
    description: body.description ?? null,
    due_date: body.due_date ?? null,
    reference: body.reference ?? null,
    source: "manual",
    created_by: auth.user.id,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const balance = await refreshTenantBalance(admin, tenant.id);
  return NextResponse.json({ ok: true, balance });
}
