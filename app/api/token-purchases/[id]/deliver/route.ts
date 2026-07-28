// app/api/token-purchases/[id]/deliver/route.ts
import { NextResponse, type NextRequest } from "next/server";

import { cancelTokenPurchase, uploadTokenToMeter, type DeliveryActor } from "@/lib/token-delivery";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/token-purchases/[id]/deliver">
) {
  const { id } = await ctx.params;

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "upload" && body.action !== "cancel") {
    return NextResponse.json(
      { ok: false, error: 'action must be "upload" or "cancel"' },
      { status: 400 }
    );
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "You must be signed in." }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) {
    return NextResponse.json(
      { ok: false, error: "Could not load your profile. Try again." },
      { status: 500 }
    );
  }
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Could not load your profile." }, { status: 400 });
  }

  let actor: DeliveryActor;
  if (profile.role === "admin") {
    actor = { kind: "admin" };
  } else if (profile.role === "landlord") {
    const { data: landlordRow, error: landlordErr } = await supabase
      .from("landlords")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (landlordErr) {
      return NextResponse.json(
        { ok: false, error: "Could not verify your landlord account. Try again." },
        { status: 500 }
      );
    }
    if (!landlordRow) {
      return NextResponse.json(
        { ok: false, error: "No landlord account is linked to your profile." },
        { status: 403 }
      );
    }
    actor = { kind: "landlord", landlordId: landlordRow.id };
  } else if (profile.role === "tenant") {
    const { data: tenantRow, error: tenantErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (tenantErr) {
      return NextResponse.json(
        { ok: false, error: "Could not verify your tenant account. Try again." },
        { status: 500 }
      );
    }
    if (!tenantRow) {
      return NextResponse.json(
        { ok: false, error: "No tenant account is linked to your profile." },
        { status: 403 }
      );
    }
    actor = { kind: "tenant", tenantId: tenantRow.id };
  } else {
    return NextResponse.json(
      { ok: false, error: "You do not have permission for this action." },
      { status: 403 }
    );
  }

  const result =
    body.action === "upload"
      ? await uploadTokenToMeter(actor, user.id, id)
      : await cancelTokenPurchase(actor, user.id, id);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
