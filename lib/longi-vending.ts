/**
 * LONGi prepayment vending (server-side). See docs/API.md.
 * Credentials: LONGI_USERNAME + LONGI_PASSWORD_MD5 (MD5 of operator password per vendor API).
 */

export type LongiConfig = {
  baseUrl: string;
  username: string;
  passwordMd5: string;
};

export type ServiceBaseVo = {
  errorCode: number;
  errorMsg?: string | null;
};

export function getLongiConfigFromEnv(): LongiConfig | null {
  const username = process.env.LONGI_USERNAME;
  const passwordMd5 = process.env.LONGI_PASSWORD_MD5;
  if (!username?.trim() || !passwordMd5?.trim()) return null;
  const raw = process.env.LONGI_VENDING_BASE_URL ?? "http://longimeter.net:21207/vendingservice";
  return {
    baseUrl: raw.replace(/\/$/, ""),
    username: username.trim(),
    passwordMd5: passwordMd5.trim(),
  };
}

const JSON_HEADERS = { Accept: "application/json" } as const;

/** LONGi returns JSON; misconfigured URLs or proxies often return HTML error pages. */
function parseLongiBody(
  text: string,
  status: number,
  endpointHint: string
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: `Empty response from LONGi (${status}) at ${endpointHint}` };
  }
  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    return {
      ok: false,
      error: `LONGi returned HTML (${status}), not JSON. Check LONGI_VENDING_BASE_URL (include http://host:port/vendingservice), firewall, and that the service is reachable from this server.`,
    };
  }
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: `LONGi response was not valid JSON (${status}). ${endpointHint}: ${trimmed.slice(0, 160)}`,
    };
  }
}

async function fetchLongiText(url: string, method: "GET" | "POST"): Promise<{ status: number; text: string }> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: JSON_HEADERS,
  });
  const text = await res.text();
  return { status: res.status, text };
}

function sessionIdFromLogin(data: ServiceBaseVo & Record<string, unknown>): string | null {
  const a = data.sessionID;
  const b = data.sessionId;
  if (typeof a === "string" && a) return a;
  if (typeof b === "string" && b) return b;
  return null;
}

export async function longiLogin(config: LongiConfig): Promise<
  ServiceBaseVo & {
    sessionId: string;
    merchantBalance?: number;
    userName?: string;
    merchantName?: string;
  }
> {
  const url = new URL(`${config.baseUrl}/login`);
  url.searchParams.set("username", config.username);
  url.searchParams.set("password", config.passwordMd5);
  const loginUrl = url.toString();

  // Postman collections often use POST; vendor PDF uses GET — try POST first, then GET if body is not JSON.
  let { status, text } = await fetchLongiText(loginUrl, "POST");
  let parsed = parseLongiBody(text, status, "login");

  if (!parsed.ok) {
    ({ status, text } = await fetchLongiText(loginUrl, "GET"));
    parsed = parseLongiBody(text, status, "login");
  }

  if (!parsed.ok) {
    return {
      errorCode: -1,
      errorMsg: parsed.error,
      sessionId: "",
    };
  }

  const data = parsed.data as ServiceBaseVo & Record<string, unknown>;
  const sessionId = sessionIdFromLogin(data);
  const code = typeof data.errorCode === "number" ? data.errorCode : -1;
  if (code !== 0 || !sessionId) {
    return {
      errorCode: code,
      errorMsg: (data.errorMsg as string | undefined) ?? "Login failed",
      sessionId: "",
    };
  }
  return {
    errorCode: 0,
    errorMsg: data.errorMsg as string | undefined,
    sessionId,
    merchantBalance:
      typeof data.merchantBalance === "number" ? data.merchantBalance : undefined,
    userName: typeof data.userName === "string" ? data.userName : undefined,
    merchantName: typeof data.merchantName === "string" ? data.merchantName : undefined,
  };
}

export async function longiValidation(
  config: LongiConfig,
  token: string,
  meterNo: string
): Promise<
  ServiceBaseVo & {
    meterNo?: string;
    meterType?: number;
    customerName?: string;
    customerAddress?: string;
    latestVendingDate?: string;
  }
> {
  const url = new URL(`${config.baseUrl}/validation`);
  url.searchParams.set("meterNo", meterNo);
  url.searchParams.set("token", token);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "validation");
  if (!parsed.ok) {
    return { errorCode: -1, errorMsg: parsed.error };
  }
  return parsed.data as ServiceBaseVo & Record<string, unknown>;
}

export async function longiGetOrderNo(
  config: LongiConfig,
  token: string
): Promise<ServiceBaseVo & { orderNo: string; ordno?: string }> {
  const url = new URL(`${config.baseUrl}/getorderno`);
  url.searchParams.set("token", token);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "getorderno");
  if (!parsed.ok) {
    return { errorCode: -1, errorMsg: parsed.error, orderNo: "" };
  }
  const data = parsed.data as ServiceBaseVo & Record<string, unknown>;
  const ord =
    (typeof data.ordno === "string" && data.ordno) ||
    (typeof data.orderNo === "string" && data.orderNo) ||
    "";
  return { ...data, errorCode: data.errorCode as number, orderNo: ord };
}

export async function longiTransaction(
  config: LongiConfig,
  params: { token: string; orderNo: string; meterNo: string; amount: number }
): Promise<
  ServiceBaseVo & {
    orderNo?: string;
    meterNo?: string;
    token?: string;
    kctToken1?: string;
    kctToken2?: string;
    subsidyToken?: string | null;
    credit?: number;
    amount?: number;
    customerName?: string;
  }
> {
  const url = new URL(`${config.baseUrl}/transaction`);
  url.searchParams.set("token", params.token);
  url.searchParams.set("orderNo", params.orderNo);
  url.searchParams.set("meterNo", params.meterNo);
  url.searchParams.set("amount", String(params.amount));
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "transaction");
  if (!parsed.ok) {
    return { errorCode: -1, errorMsg: parsed.error };
  }
  return parsed.data as ServiceBaseVo & Record<string, unknown>;
}

export type LongiVendResult = {
  ok: true;
  orderNo: string;
  meterNo: string;
  customerName?: string;
  amount?: number;
  credit?: number;
  token: string;
  kctToken1?: string;
  kctToken2?: string;
  subsidyToken?: string | null;
};

export type LongiVendError = {
  ok: false;
  error: string;
  errorCode: number;
};

export type LongiValidateMeterResult =
  | {
      ok: true;
      meterNo: string;
      meterType?: number;
      meterTypeLabel: string;
      customerName?: string;
      customerAddress?: string;
      latestVendingDate?: string;
    }
  | LongiVendError;

/** Login + GET /validation — used when onboarding a meter. */
export async function longiValidateMeter(
  config: LongiConfig,
  meterNo: string,
): Promise<LongiValidateMeterResult> {
  const trimmed = meterNo.trim();
  if (!trimmed) {
    return { ok: false, error: "Meter number is required", errorCode: 9002 };
  }

  const login = await longiLogin(config);
  if (login.errorCode !== 0 || !login.sessionId) {
    return {
      ok: false,
      error: login.errorMsg || `LONGi login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    };
  }

  const validation = await longiValidation(config, login.sessionId, trimmed);
  if (validation.errorCode !== 0) {
    const msg =
      validation.errorMsg ||
      (validation.errorCode === 2002
        ? "This meter is not registered with LONGi. Check the meter ID."
        : `Meter validation failed (${validation.errorCode})`);
    return { ok: false, error: msg, errorCode: validation.errorCode };
  }

  const meterType =
    typeof validation.meterType === "number" ? validation.meterType : undefined;

  return {
    ok: true,
    meterNo: validation.meterNo ?? trimmed,
    meterType,
    meterTypeLabel: meterType != null ? meterTypeLabel(meterType) : "Unknown",
    customerName: validation.customerName,
    customerAddress: validation.customerAddress,
    latestVendingDate: validation.latestVendingDate,
  };
}

export function mapLongiMeterTypeToModel(
  meterType: number | undefined,
): "water_prepay_m3" | "water_prepay_currency" | "postpay" {
  if (meterType === -1) return "postpay";
  if (meterType === 4 || meterType === 5) return "water_prepay_currency";
  return "water_prepay_m3";
}

/** Vending flow: login → validation → transaction ID → generate token. */
export async function longiVendToken(
  config: LongiConfig,
  params: { meterNo: string; amount: number; skipValidation?: boolean }
): Promise<LongiVendResult | LongiVendError> {
  const meterNo = params.meterNo.trim();
  if (!meterNo) return { ok: false, error: "Meter number is required", errorCode: 9002 };
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { ok: false, error: "Enter a valid amount greater than zero", errorCode: 9005 };
  }

  const login = await longiLogin(config);
  if (login.errorCode !== 0) {
    return {
      ok: false,
      error: login.errorMsg || `Login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    };
  }

  if (!params.skipValidation) {
    const validation = await longiValidation(config, login.sessionId, meterNo);
    if (validation.errorCode !== 0) {
      const msg =
        validation.errorMsg ||
        (validation.errorCode === 2002
          ? "Meter not found on LONGi. Validate the meter ID before vending."
          : `Meter validation failed (${validation.errorCode})`);
      return { ok: false, error: msg, errorCode: validation.errorCode };
    }
  }

  const order = await longiGetOrderNo(config, login.sessionId);
  if (order.errorCode !== 0 || !order.orderNo) {
    return {
      ok: false,
      error: order.errorMsg || "Could not generate order number",
      errorCode: order.errorCode,
    };
  }

  const tx = await longiTransaction(config, {
    token: login.sessionId,
    orderNo: order.orderNo,
    meterNo,
    amount: params.amount,
  });
  if (tx.errorCode !== 0) {
    return {
      ok: false,
      error: tx.errorMsg || `Vending failed (${tx.errorCode})`,
      errorCode: tx.errorCode,
    };
  }

  return {
    ok: true,
    orderNo: tx.orderNo ?? order.orderNo,
    meterNo: tx.meterNo ?? meterNo,
    customerName: tx.customerName,
    amount: tx.amount,
    credit: tx.credit,
    token: tx.token ?? "",
    kctToken1: tx.kctToken1,
    kctToken2: tx.kctToken2,
    subsidyToken: tx.subsidyToken,
  };
}

export function meterTypeLabel(meterType: number): string {
  switch (meterType) {
    case -1:
      return "Postpay";
    case 0:
      return "Prepay electricity (kWh)";
    case 1:
      return "Prepay water (m³)";
    case 4:
      return "Prepay electricity (currency)";
    case 5:
      return "Prepay water (currency)";
    default:
      return `Type ${meterType}`;
  }
}
