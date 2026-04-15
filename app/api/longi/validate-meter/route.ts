import { NextResponse } from "next/server";

import {
  getLongiConfigFromEnv,
  longiLogin,
  longiValidation,
  meterTypeLabel,
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

  let body: { meterNo?: string };
  try {
    body = (await request.json()) as { meterNo?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const meterNo = String(body.meterNo ?? "").trim();
  if (!meterNo) {
    return NextResponse.json({ ok: false, error: "Meter number is required" }, { status: 400 });
  }

  const login = await longiLogin(config);
  if (login.errorCode !== 0) {
    return NextResponse.json({
      ok: false,
      error: login.errorMsg || `Login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    });
  }

  const validation = await longiValidation(config, login.sessionId, meterNo);
  if (validation.errorCode !== 0) {
    return NextResponse.json({
      ok: false,
      error: validation.errorMsg || `Validation failed (${validation.errorCode})`,
      errorCode: validation.errorCode,
    });
  }

  return NextResponse.json({
    ok: true,
    meterNo: validation.meterNo ?? meterNo,
    meterType: validation.meterType,
    meterTypeLabel:
      typeof validation.meterType === "number" ? meterTypeLabel(validation.meterType) : undefined,
    customerName: validation.customerName,
    customerAddress: validation.customerAddress,
    latestVendingDate: validation.latestVendingDate,
    merchantBalance: login.merchantBalance,
    merchantName: login.merchantName,
  });
}
