import { NextResponse } from "next/server";

import { recordDepositPayment } from "@/lib/billing/deposits";
import { resolveDepositVerification } from "@/lib/billing/deposit-verification";
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    metadata?: { purpose?: string; tenantId?: string; kind?: string };
  };
};

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let body: { reference?: string; tenantId?: string; kind?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const reference = String(body.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store" },
  );
  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;
  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return NextResponse.json(
      { ok: false, error: verifyData.message || `Paystack verify failed (${verifyRes.status})` },
      { status: 400 },
    );
  }

  const meta = verifyData.data.metadata ?? {};
  const tenantId = String(meta.tenantId ?? body.tenantId ?? "").trim() || null;
  const kind = String(meta.kind ?? body.kind ?? "").trim() || null;
  const grossKes =
    typeof verifyData.data.amount === "number"
      ? Number((verifyData.data.amount / 100).toFixed(2))
      : Number.NaN;

  const admin = getSupabaseAdminClient();

  // Ownership + idempotency facts.
  const { data: tenant } = tenantId
    ? await admin.from("tenants").select("profile_id, landlord_id").eq("id", tenantId).maybeSingle()
    : { data: null };
  const { data: existing } = await admin
    .from("payments")
    .select("id")
    .eq("reference", reference)
    .eq("category", "deposit")
    .maybeSingle();

  const decision = resolveDepositVerification({
    paymentSucceeded: verifyData.data.status === "success",
    tenantId,
    kind,
    grossKes,
    tenantProfileId: tenant?.profile_id ?? null,
    authUserId: auth.user.id,
    alreadyProcessed: Boolean(existing),
  });

  if (decision.kind === "error") {
    return NextResponse.json({ ok: false, error: decision.message }, { status: decision.status });
  }
  if (decision.kind === "already") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  try {
    const lease = await getActiveLeaseForTenant(admin, decision.tenantId);
    await recordDepositPayment(admin, {
      tenantId: decision.tenantId,
      landlordId: tenant!.landlord_id,
      leaseId: lease?.id ?? null,
      kind: decision.depositKind,
      amountKes: decision.grossKes,
      method: "M-Pesa",
      reference,
    });
    return NextResponse.json({ ok: true, gross: decision.grossKes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record deposit payment.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
