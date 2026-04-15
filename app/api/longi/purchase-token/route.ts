import { NextResponse } from "next/server";

import {
  getLongiConfigFromEnv,
  longiVendToken,
} from "@/lib/longi-vending";

export async function POST(request: Request) {
  const config = getLongiConfigFromEnv();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error: "LONGi vending is not configured. Set LONGI_USERNAME and LONGI_PASSWORD_MD5 on the server.",
      },
      { status: 503 }
    );
  }

  let body: { meterNo?: string; amount?: number };
  try {
    body = (await request.json()) as { meterNo?: string; amount?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const meterNo = String(body.meterNo ?? "").trim();
  const amount = Number(body.amount);
  if (!meterNo) {
    return NextResponse.json({ ok: false, error: "Meter number is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Enter a valid amount greater than zero" }, { status: 400 });
  }

  const vend = await longiVendToken(config, { meterNo, amount });
  if (!vend.ok) {
    return NextResponse.json({
      ok: false,
      error: vend.error,
      errorCode: vend.errorCode,
    });
  }

  return NextResponse.json(vend);
}
