import { NextResponse } from "next/server";

import { recordRentPayment } from "@/lib/billing/payments";
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
    metadata?: { purpose?: string; tenantId?: string; amountKes?: number };
  };
};

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  // Require an authenticated caller; fall back to their tenant if metadata is missing.
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let body: { reference?: string; tenantId?: string };
  try {
    body = (await request.json()) as { reference?: string; tenantId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const reference = String(body.reference ?? "").trim();
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }

  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" }, cache: "no-store" }
  );
  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;

  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return NextResponse.json(
      { ok: false, error: verifyData.message || `Paystack verify failed (${verifyRes.status})` },
      { status: 400 }
    );
  }
  if (verifyData.data.status !== "success") {
    return NextResponse.json(
      { ok: false, error: `Payment is not successful (status: ${verifyData.data.status ?? "unknown"})` },
      { status: 400 }
    );
  }

  const metadata = verifyData.data.metadata ?? {};
  const tenantId = String(metadata.tenantId ?? body.tenantId ?? "").trim();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Tenant is missing from the payment." }, { status: 400 });
  }
  const grossKes =
    typeof verifyData.data.amount === "number"
      ? Number((verifyData.data.amount / 100).toFixed(2))
      : NaN;
  if (!Number.isFinite(grossKes) || grossKes <= 0) {
    return NextResponse.json({ ok: false, error: "Paid amount is invalid." }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  try {
    const result = await recordRentPayment(admin, {
      tenantId,
      reference,
      grossKes,
      rawPayload: verifyData as unknown as Json,
    });
    return NextResponse.json({
      ok: true,
      paymentId: result.paymentId,
      alreadyProcessed: result.alreadyProcessed,
      gross: grossKes,
      commissionKes: result.split?.commissionKes ?? null,
      netToLandlordKes: result.split?.netToLandlordKes ?? null,
      balance: result.balance,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record rent payment.";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}
