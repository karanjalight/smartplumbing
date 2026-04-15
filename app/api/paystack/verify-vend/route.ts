import { NextResponse } from "next/server";

import { getLongiConfigFromEnv, longiVendToken, type LongiVendResult } from "@/lib/longi-vending";

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    status?: string;
    reference?: string;
    amount?: number;
    paid_at?: string;
    customer?: { email?: string };
    metadata?: {
      meterNo?: string;
      amountKes?: number;
      customerName?: string;
      purpose?: string;
    };
  };
};

const processedReferences = new Map<string, LongiVendResult>();

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const longiConfig = getLongiConfigFromEnv();
  if (!secretKey) {
    return NextResponse.json(
      { ok: false, error: "PAYSTACK_SECRET_KEY is not configured on the server." },
      { status: 503 }
    );
  }
  if (!longiConfig) {
    return NextResponse.json(
      {
        ok: false,
        error: "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5.",
      },
      { status: 503 }
    );
  }

  let body: { reference?: string; meterNo?: string; amount?: number };
  try {
    body = (await request.json()) as { reference?: string; meterNo?: string; amount?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const reference = String(body.reference ?? "").trim();
  const requestedMeterNo = String(body.meterNo ?? "").trim();
  const requestedAmount = Number(body.amount);
  if (!reference) {
    return NextResponse.json({ ok: false, error: "Payment reference is required" }, { status: 400 });
  }

  const existing = processedReferences.get(reference);
  if (existing) {
    return NextResponse.json(existing);
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;

  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return NextResponse.json(
      {
        ok: false,
        error: verifyData.message || `Paystack verify failed (${verifyRes.status})`,
      },
      { status: 400 }
    );
  }

  if (verifyData.data.status !== "success") {
    return NextResponse.json(
      {
        ok: false,
        error: `Payment is not successful (status: ${verifyData.data.status ?? "unknown"})`,
      },
      { status: 400 }
    );
  }

  const metadata = verifyData.data.metadata ?? {};
  const meterNo = String(metadata.meterNo ?? requestedMeterNo).trim();
  const amountKesFromVerify =
    typeof verifyData.data.amount === "number" ? Number((verifyData.data.amount / 100).toFixed(2)) : NaN;
  const amountKes = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : amountKesFromVerify;

  if (!meterNo) {
    return NextResponse.json({ ok: false, error: "Meter number is missing in payment metadata." }, { status: 400 });
  }
  if (!Number.isFinite(amountKes) || amountKes <= 0) {
    return NextResponse.json({ ok: false, error: "Paid amount is invalid." }, { status: 400 });
  }

  const vend = await longiVendToken(longiConfig, { meterNo, amount: amountKes });
  if (!vend.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: vend.error,
        errorCode: vend.errorCode,
      },
      { status: 400 }
    );
  }

  processedReferences.set(reference, vend);
  return NextResponse.json(vend);
}
