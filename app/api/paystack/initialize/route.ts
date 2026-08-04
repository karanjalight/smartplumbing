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

  let body: {
    amount?: number; meterNo?: string; email?: string; customerName?: string;
    purpose?: "rent" | "water-token-purchase" | "deposit"; tenantId?: string;
    kind?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const purpose =
    body.purpose === "rent"
      ? "rent"
      : body.purpose === "deposit"
        ? "deposit"
        : "water-token-purchase";
  const amountKes = Number(body.amount);
  const meterNo = String(body.meterNo ?? "").trim();
  const tenantId = String(body.tenantId ?? "").trim();
  const email = String(body.email ?? "client@smartone.app").trim().toLowerCase();
  const customerName = String(body.customerName ?? "").trim();

  if (purpose === "water-token-purchase" && !meterNo) {
    return NextResponse.json({ ok: false, error: "Meter number is required" }, { status: 400 });
  }
  if (purpose === "rent" && !tenantId) {
    return NextResponse.json({ ok: false, error: "Tenant is required for rent payment" }, { status: 400 });
  }
  if (!Number.isFinite(amountKes) || amountKes <= 0) {
    return NextResponse.json({ ok: false, error: "Amount must be greater than zero" }, { status: 400 });
  }
  if (!email.includes("@")) {
    return NextResponse.json({ ok: false, error: "A valid email address is required" }, { status: 400 });
  }

  const kind = String(body.kind ?? "").trim();
  if (purpose === "deposit") {
    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant is required for deposit payment" }, { status: 400 });
    }
    if (!["water", "electricity", "rent"].includes(kind)) {
      return NextResponse.json({ ok: false, error: "A valid deposit kind is required" }, { status: 400 });
    }
  }

  const refSuffix =
    purpose === "water-token-purchase" ? meterNo.slice(-5) : tenantId.slice(-6);
  const reference = `smartone-${
    purpose === "rent" ? "rent" : purpose === "deposit" ? "deposit" : "token"
  }-${Date.now()}-${refSuffix}`;
  const payload = {
    email,
    amount: Math.round(amountKes * 100),
    currency: "KES",
    reference,
    metadata: {
      purpose,
      amountKes,
      customerName,
      ...(purpose === "water-token-purchase"
        ? { meterNo }
        : purpose === "deposit"
          ? { tenantId, kind }
          : { tenantId }),
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
