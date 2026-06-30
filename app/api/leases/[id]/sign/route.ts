import { NextResponse } from "next/server";

import { stampSignatures, type StampInput } from "@/lib/leases/sign";
import { getLeaseById, listSignatures } from "@/lib/leases/queries";
import { canSign, isFullySigned } from "@/lib/leases/status";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { LeaseSignerRole } from "@/lib/supabase/types";

const BUCKET = "tenant-documents";

function dataUrlToPng(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    role?: LeaseSignerRole; signatureDataUrl?: string;
  };
  const role = body.role;
  if (role !== "tenant" && role !== "landlord") {
    return NextResponse.json({ ok: false, error: "Invalid signer role" }, { status: 400 });
  }
  if (!body.signatureDataUrl?.startsWith("data:image/png")) {
    return NextResponse.json({ ok: false, error: "Missing signature image" }, { status: 400 });
  }

  // Authorize: RLS read confirms the caller is party to this lease.
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const lease = await getLeaseById(server, id);
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  if (!canSign(lease.status) || !lease.document_url) {
    return NextResponse.json(
      { ok: false, error: "Lease is not awaiting signature" }, { status: 409 }
    );
  }

  const admin = getSupabaseAdminClient();
  const png = dataUrlToPng(body.signatureDataUrl);
  const signedAt = new Date().toISOString();

  // 1. Store the signature image.
  const sigPath = `leases/${lease.id}/signature-${role}.png`;
  await admin.storage.from(BUCKET).upload(sigPath, png, {
    contentType: "image/png", upsert: true,
  });

  // 2. Record the signature row (audit trail).
  const signerName = role === "tenant" ? lease.tenant_name : lease.landlord_name;
  await admin.from("lease_signatures").upsert(
    {
      lease_id: lease.id,
      signer_profile_id: auth.user.id,
      signer_role: role,
      signer_name: signerName ?? role,
      signature_path: sigPath,
      signed_at: signedAt,
      signer_ip: request.headers.get("x-forwarded-for"),
      user_agent: request.headers.get("user-agent"),
    },
    { onConflict: "lease_id,signer_role" }
  );

  // 3. Re-stamp the unsigned base PDF with every signature collected so far.
  const sigs = await listSignatures(admin, lease.id);
  const { data: baseFile, error: dlErr } = await admin.storage
    .from(BUCKET).download(lease.document_url);
  if (dlErr || !baseFile) {
    return NextResponse.json({ ok: false, error: "Base document missing" }, { status: 500 });
  }
  const baseBuf = Buffer.from(await baseFile.arrayBuffer());
  const stamps: StampInput[] = [];
  for (const s of sigs) {
    const { data: img } = await admin.storage.from(BUCKET).download(s.signature_path);
    if (img) {
      stamps.push({
        role: s.signer_role,
        name: s.signer_name,
        pngBytes: new Uint8Array(await img.arrayBuffer()),
        signedAt: s.signed_at,
      });
    }
  }
  const stamped = await stampSignatures(baseBuf, stamps);
  const signedPath = `leases/${lease.id}/agreement-signed.pdf`;
  await admin.storage.from(BUCKET).upload(signedPath, stamped, {
    contentType: "application/pdf", upsert: true,
  });

  // 4. Activate when all required parties have signed.
  const signedRoles = sigs.map((s) => s.signer_role);
  const fullySigned = isFullySigned(signedRoles);
  await admin.from("leases").update({
    signed_document_url: signedPath,
    status: fullySigned ? "active" : "pending_signature",
    signed_at: fullySigned ? signedAt : null,
  }).eq("id", lease.id);

  return NextResponse.json({
    ok: true, status: fullySigned ? "active" : "pending_signature",
  });
}
