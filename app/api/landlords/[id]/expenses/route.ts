import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { OwnerExpenseCategory } from "@/lib/supabase/types";

const CATEGORIES: OwnerExpenseCategory[] = [
  "maintenance", "repairs", "utilities", "management", "insurance", "other",
];

/** Logs a property expense against a landlord (admin or the owning landlord). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    category?: OwnerExpenseCategory;
    amount_kes?: number;
    description?: string;
    building_id?: string;
    incurred_on?: string;
  };

  const category = body.category;
  const amount = Number(body.amount_kes);
  if (!category || !CATEGORIES.includes(category)) {
    return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Amount must be greater than zero" }, { status: 400 });
  }

  // Insert through the session client so RLS confirms the caller owns this
  // landlord (or is an admin).
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const { error } = await server.from("owner_expenses").insert({
    landlord_id: id,
    building_id: body.building_id ?? null,
    category,
    amount_kes: Math.round(amount * 100) / 100,
    description: body.description ?? null,
    incurred_on: body.incurred_on || undefined,
    created_by: auth.user.id,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
