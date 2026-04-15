import { NextResponse } from "next/server";

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
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

  let body: { amount?: number; meterNo?: string; email?: string; customerName?: string };
  try {
    body = (await request.json()) as { amount?: number; meterNo?: string; email?: string; customerName?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const amountKes = Number(body.amount);
  const meterNo = String(body.meterNo ?? "").trim();
  const email = String(body.email ?? "client@smartone.app").trim().toLowerCase();
  const customerName = String(body.customerName ?? "").trim();

  if (!meterNo) {
    return NextResponse.json({ ok: false, error: "Meter number is required" }, { status: 400 });
  }
  if (!Number.isFinite(amountKes) || amountKes <= 0) {
    return NextResponse.json({ ok: false, error: "Amount must be greater than zero" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "A valid email address is required" }, { status: 400 });
  }

  const reference = `smartone-${Date.now()}-${meterNo.slice(-5)}`;
  const payload = {
    email,
    amount: Math.round(amountKes * 100),
    currency: "KES",
    reference,
    metadata: {
      meterNo,
      amountKes,
      customerName,
      purpose: "water-token-purchase",
    },
  };

  const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const initData = (await initRes.json()) as PaystackInitializeResponse;
  if (!initRes.ok || !initData.status || !initData.data) {
    return NextResponse.json(
      {
        ok: false,
        error: initData.message || `Paystack initialize failed (${initRes.status})`,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    reference: initData.data.reference,
    accessCode: initData.data.access_code,
    authorizationUrl: initData.data.authorization_url,
    amountKes,
    email,
  });
}
