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

export type LongiUtility = "water" | "electricity";

function readLongiConfig(
  usernameVar: string,
  passwordVar: string,
  baseUrlVar: string,
  baseUrlDefault: string,
): LongiConfig | null {
  const username = process.env[usernameVar];
  const passwordMd5 = process.env[passwordVar];
  if (!username?.trim() || !passwordMd5?.trim()) return null;
  const raw = process.env[baseUrlVar] ?? baseUrlDefault;
  return {
    baseUrl: raw.replace(/\/$/, ""),
    username: username.trim(),
    passwordMd5: passwordMd5.trim(),
  };
}

/** Water LONGi credentials (existing env vars, unchanged). */
export function getLongiConfigFromEnv(): LongiConfig | null {
  return readLongiConfig(
    "LONGI_USERNAME",
    "LONGI_PASSWORD_MD5",
    "LONGI_VENDING_BASE_URL",
    "http://longimeter.net:21207/vendingservice",
  );
}

/** Electricity LONGi credentials — separate merchant account from water. */
export function getLongiConfigForElectricity(): LongiConfig | null {
  return readLongiConfig(
    "LONGI_ELECTRICITY_USERNAME",
    "LONGI_ELECTRICITY_PASSWORD_MD5",
    "LONGI_ELECTRICITY_BASE_URL",
    "http://longimeter.net:21207/vendingservice",
  );
}

/** Pick the right LONGi credential set for a given utility. */
export function getLongiConfigForUtility(utility: LongiUtility): LongiConfig | null {
  return utility === "electricity" ? getLongiConfigForElectricity() : getLongiConfigFromEnv();
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

function longiTimeoutMs(): number {
  const raw = Number(process.env.LONGI_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 15000;
}

async function fetchLongiText(
  url: string,
  method: "GET" | "POST",
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), longiTimeoutMs());
  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      headers: JSON_HEADERS,
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch {
    // Timeout or network error → surface as an empty body so parseLongiBody
    // returns a clean error instead of throwing up through the caller.
    return { status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
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

/** Validation + result mapping using an EXISTING session (no login). */
export async function longiValidateMeterWithSession(
  config: LongiConfig,
  sessionId: string,
  meterNo: string,
): Promise<LongiValidateMeterResult> {
  const trimmed = meterNo.trim();
  if (!trimmed) {
    return { ok: false, error: "Meter number is required", errorCode: 9002 };
  }

  const validation = await longiValidation(config, sessionId, trimmed);
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

/** Login + GET /validation — used when onboarding a single meter. */
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

  return longiValidateMeterWithSession(config, login.sessionId, trimmed);
}

export function mapLongiMeterTypeToModel(
  meterType: number | undefined,
): "water_prepay_m3" | "water_prepay_currency" | "postpay" | "electricity_prepay_kwh" | "electricity_prepay_currency" {
  if (meterType === -1) return "postpay";
  if (meterType === 0) return "electricity_prepay_kwh";
  if (meterType === 4) return "electricity_prepay_currency";
  if (meterType === 5) return "water_prepay_currency";
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

/** Chapter 8: void a transaction so it can't be redeemed. */
export async function longiCancelTransaction(
  config: LongiConfig,
  params: { orderNo: string }
): Promise<{ ok: true; state?: number; raw: ServiceBaseVo & { state?: number } } | LongiVendError> {
  const orderNo = params.orderNo.trim();
  if (!orderNo) return { ok: false, error: "Order number is required", errorCode: 9004 };

  const login = await longiLogin(config);
  if (login.errorCode !== 0) {
    return {
      ok: false,
      error: login.errorMsg || `Login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    };
  }

  const url = new URL(`${config.baseUrl}/cancellation`);
  url.searchParams.set("token", login.sessionId);
  url.searchParams.set("orderNo", orderNo);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "cancellation");
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, errorCode: -1 };
  }

  const data = parsed.data as ServiceBaseVo & { state?: number };
  if (data.errorCode !== 0) {
    const msg =
      data.errorMsg ||
      (data.errorCode === 3006
        ? "This transaction has already been cancelled."
        : data.errorCode === 3007
          ? "This transaction can no longer be cancelled (it may already be redeemed)."
          : data.errorCode === 3005
            ? "This order does not exist."
            : `Cancellation failed (${data.errorCode})`);
    return { ok: false, error: msg, errorCode: data.errorCode };
  }

  return {
    ok: true,
    state: typeof data.state === "number" ? data.state : undefined,
    raw: data,
  };
}

/** Chapter 13: push the STS token straight to the meter over the network. */
export async function longiWriteToken(
  config: LongiConfig,
  params: { meterNo: string; ststoken: string }
): Promise<{ ok: true; raw: ServiceBaseVo } | LongiVendError> {
  const meterNo = params.meterNo.trim();
  const ststoken = params.ststoken.trim();
  if (!meterNo) return { ok: false, error: "Meter number is required", errorCode: 9002 };
  if (!ststoken) return { ok: false, error: "STS token is required", errorCode: 9010 };

  const login = await longiLogin(config);
  if (login.errorCode !== 0) {
    return {
      ok: false,
      error: login.errorMsg || `Login failed (${login.errorCode})`,
      errorCode: login.errorCode,
    };
  }

  const url = new URL(`${config.baseUrl}/writeToken`);
  url.searchParams.set("token", login.sessionId);
  url.searchParams.set("msno", meterNo);
  url.searchParams.set("ststoken", ststoken);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "writeToken");
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, errorCode: -1 };
  }

  const data = parsed.data as ServiceBaseVo;
  if (data.errorCode !== 0) {
    return {
      ok: false,
      error: data.errorMsg || `Remote token write failed (${data.errorCode})`,
      errorCode: data.errorCode,
    };
  }

  return { ok: true, raw: data };
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

export type MeterRelayState = "connected" | "disconnected" | "unknown";

/** Chapter 12's response array is positional, not keyed by meter number — a
 *  length mismatch means we can't safely map results back to specific
 *  meters, so callers get `null` and treat the whole batch as unknown. */
export function parseRelayStatusResponse(
  data: { dataTmp: string }[] | undefined,
  requestedMeterNos: string[]
): Map<string, MeterRelayState> | null {
  if (!data || data.length !== requestedMeterNos.length) return null;
  const out = new Map<string, MeterRelayState>();
  requestedMeterNos.forEach((meterNo, i) => {
    const raw = data[i]?.dataTmp;
    out.set(
      meterNo,
      raw === "Connected" ? "connected" : raw === "Disconnected" ? "disconnected" : "unknown"
    );
  });
  return out;
}

/** Communication API Ch. 4's response is keyed by meter number
 *  ("meterNo1:0,meterNo2:-2") — safe to parse even for a partial batch. */
export function parseOnlineStatusString(
  onlineStatus: string | undefined
): Map<string, "online" | "offline" | "unknown"> {
  const out = new Map<string, "online" | "offline" | "unknown">();
  if (!onlineStatus) return out;
  for (const pair of onlineStatus.split(",")) {
    const [meterNo, code] = pair.split(":");
    if (!meterNo) continue;
    out.set(meterNo.trim(), code === "0" ? "online" : code === "-2" ? "offline" : "unknown");
  }
  return out;
}

async function postLongiJsonBody(
  url: string,
  body: Record<string, unknown>
): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), longiTimeoutMs());
  try {
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { ...JSON_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch {
    return { status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

function relayErrorMessage(
  data: ServiceBaseVo & { errorDetails?: { code?: number; message?: string } }
): string {
  const detail = data.errorDetails?.message?.trim();
  if (detail) return detail;
  if (data.errorMsg?.trim()) return data.errorMsg.trim();
  return `LONGi error ${data.errorCode}`;
}

async function longiSetRelay(
  config: LongiConfig,
  sessionId: string,
  deviceSN: string,
  endpoint: "relayOpen" | "relayClosed"
): Promise<{ ok: true; data?: string } | LongiVendError> {
  const url = new URL(`${config.baseUrl}/${endpoint}`);
  url.searchParams.set("token", sessionId);
  url.searchParams.set("deviceSN", deviceSN);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, endpoint);
  if (!parsed.ok) return { ok: false, error: parsed.error, errorCode: -1 };
  const data = parsed.data as ServiceBaseVo & {
    data?: string;
    errorDetails?: { code?: number; message?: string };
  };
  if (data.errorCode !== 0) {
    return { ok: false, error: relayErrorMessage(data), errorCode: data.errorCode };
  }
  return { ok: true, data: data.data };
}

/** Chapter 10: disconnect an electricity meter's relay (cuts power). */
export async function longiRelayOpen(config: LongiConfig, sessionId: string, deviceSN: string) {
  return longiSetRelay(config, sessionId, deviceSN, "relayOpen");
}

/** Chapter 11: reconnect an electricity meter's relay (restores power). */
export async function longiRelayClosed(config: LongiConfig, sessionId: string, deviceSN: string) {
  return longiSetRelay(config, sessionId, deviceSN, "relayClosed");
}

/** Chapter 12: bulk relay status. `meterNoCsv` may be a comma-separated list. */
export async function longiGetRelayStatus(
  config: LongiConfig,
  sessionId: string,
  meterNoCsv: string
): Promise<ServiceBaseVo & { data?: { dataTmp: string }[] }> {
  const url = new URL(`${config.baseUrl}/relayStatus`);
  const { status, text } = await postLongiJsonBody(url.toString(), {
    token: sessionId,
    meterNo: meterNoCsv,
  });
  const parsed = parseLongiBody(text, status, "relayStatus");
  if (!parsed.ok) return { errorCode: -1, errorMsg: parsed.error };
  return parsed.data as ServiceBaseVo & { data?: { dataTmp: string }[] };
}

/** Communication API Ch. 4: bulk online/offline; `deviceListCsv` may be comma-separated. */
export async function longiGetOnlineStatus(
  config: LongiConfig,
  sessionId: string,
  deviceListCsv: string
): Promise<ServiceBaseVo & { onlineStatus?: string }> {
  const url = new URL(`${config.baseUrl}/getonlinestatus`);
  url.searchParams.set("token", sessionId);
  url.searchParams.set("deviceList", deviceListCsv);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "getonlinestatus");
  if (!parsed.ok) return { errorCode: -1, errorMsg: parsed.error };
  return parsed.data as ServiceBaseVo & { onlineStatus?: string };
}

export type AxdrDecodedValue =
  | { type: "null"; value: null }
  | { type: "boolean"; value: boolean }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "unsupported"; tag: number };

/**
 * Decodes a single A-XDR TLV-encoded value from a LONGi `communicationwithdevice`
 * hex response (see docs/API.md, "Table 1: A-XDR Data Type"). Returns `null` only for
 * malformed input (empty, odd-length hex, or a size/length that runs past the end of
 * the buffer) — a well-formed but unimplemented tag (date-time, array, structure, …)
 * decodes to `{ type: "unsupported", tag }` instead of throwing or guessing a value.
 *
 * long64/long64-unsigned (8-byte) values are read via repeated *256 accumulation,
 * which loses precision above Number.MAX_SAFE_INTEGER (2^53) — fine for realistic
 * meter reading magnitudes, called out here since it's an actual limitation.
 */
export function decodeAxdrValue(hex: string): AxdrDecodedValue | null {
  const trimmed = hex.trim();
  if (!trimmed || trimmed.length % 2 !== 0) return null;

  const bytes: number[] = [];
  for (let i = 0; i < trimmed.length; i += 2) {
    const byte = Number.parseInt(trimmed.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    bytes.push(byte);
  }
  if (bytes.length === 0) return null;

  const tag = bytes[0];
  const rest = bytes.slice(1);

  function readUint(n: number): number | null {
    if (rest.length < n) return null;
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + rest[i];
    return v;
  }

  function readInt(n: number): number | null {
    if (rest.length < n) return null;
    if ((rest[0] & 0x80) === 0) return readUint(n);
    // Negative: compute the two's-complement magnitude via invert+increment
    // (with carry propagation from the LSB), rather than forming the raw
    // unsigned value and subtracting 2**(8n). For n=8 that raw value is
    // ~2**64, which loses precision as a double *regardless of how small
    // the true (signed) magnitude is* — e.g. -100 would round-trip as 0.
    // Working with the small magnitude directly avoids that cliff.
    const inverted = new Array<number>(n);
    let carry = 1;
    for (let i = n - 1; i >= 0; i--) {
      const sum = ((~rest[i]) & 0xff) + carry;
      inverted[i] = sum & 0xff;
      carry = sum > 0xff ? 1 : 0;
    }
    let magnitude = 0;
    for (let i = 0; i < n; i++) magnitude = magnitude * 256 + inverted[i];
    return -magnitude;
  }

  function readFloat(n: 4 | 8): number | null {
    if (rest.length < n) return null;
    const buf = new ArrayBuffer(n);
    const view = new DataView(buf);
    for (let i = 0; i < n; i++) view.setUint8(i, rest[i]);
    return n === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
  }

  function readOctetStringHex(): string | null {
    if (rest.length < 1) return null;
    const len = rest[0];
    if (rest.length < 1 + len) return null;
    return rest
      .slice(1, 1 + len)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function readVisibleString(): string | null {
    if (rest.length < 1) return null;
    const len = rest[0];
    if (rest.length < 1 + len) return null;
    return rest
      .slice(1, 1 + len)
      .map((b) => String.fromCharCode(b))
      .join("");
  }

  switch (tag) {
    case 0:
      return { type: "null", value: null };
    case 3: {
      const v = readUint(1);
      return v === null ? null : { type: "boolean", value: v !== 0 };
    }
    case 5: {
      const v = readInt(4);
      return v === null ? null : { type: "number", value: v };
    }
    case 6: {
      const v = readUint(4);
      return v === null ? null : { type: "number", value: v };
    }
    case 9: {
      const v = readOctetStringHex();
      return v === null ? null : { type: "string", value: v };
    }
    case 10: {
      const v = readVisibleString();
      return v === null ? null : { type: "string", value: v };
    }
    case 15: {
      const v = readInt(1);
      return v === null ? null : { type: "number", value: v };
    }
    case 16: {
      const v = readInt(2);
      return v === null ? null : { type: "number", value: v };
    }
    case 17: {
      const v = readUint(1);
      return v === null ? null : { type: "number", value: v };
    }
    case 18: {
      const v = readUint(2);
      return v === null ? null : { type: "number", value: v };
    }
    case 20: {
      const v = readInt(8);
      return v === null ? null : { type: "number", value: v };
    }
    case 21: {
      const v = readUint(8);
      return v === null ? null : { type: "number", value: v };
    }
    case 22: {
      const v = readUint(1);
      return v === null ? null : { type: "number", value: v };
    }
    case 23: {
      const v = readFloat(4);
      return v === null ? null : { type: "number", value: v };
    }
    case 24: {
      const v = readFloat(8);
      return v === null ? null : { type: "number", value: v };
    }
    default:
      return { type: "unsupported", tag };
  }
}

/**
 * Communication API Ch. 5: read a single OBIS register from a device.
 * `dataItem` is the OBIS code in hex (Classid+LN+attributeId), e.g.
 * "00030100011E00FF02". Returns `data` as an A-XDR-encoded hex string — decode with
 * `decodeAxdrValue`. This endpoint is documented in a separate vendor PDF
 * ("LONGiPower Communication API") from the rest of this file's Vending API
 * wrappers, hit against the same base URL/session — see the design doc for why that's
 * a real, disclosed uncertainty this code can't resolve on its own.
 */
export async function longiReadDeviceData(
  config: LongiConfig,
  sessionId: string,
  deviceSN: string,
  dataItem: string
): Promise<ServiceBaseVo & { data?: string }> {
  const url = new URL(`${config.baseUrl}/communicationwithdevice`);
  url.searchParams.set("token", sessionId);
  url.searchParams.set("deviceSN", deviceSN);
  url.searchParams.set("operationType", "1");
  url.searchParams.set("dataItem", dataItem);
  const { status, text } = await fetchLongiText(url.toString(), "GET");
  const parsed = parseLongiBody(text, status, "communicationwithdevice");
  if (!parsed.ok) return { errorCode: -1, errorMsg: parsed.error };
  return parsed.data as ServiceBaseVo & { data?: string };
}
