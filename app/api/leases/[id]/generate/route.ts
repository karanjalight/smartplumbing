import { NextResponse } from "next/server";

import { renderLeasePdf } from "@/lib/leases/document";
import { getGlobalTemplate, getLeaseById } from "@/lib/leases/queries";
import { canGenerate } from "@/lib/leases/status";
import { parseClauses } from "@/lib/leases/templates";
import type { LeaseClause } from "@/lib/leases/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "tenant-documents";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Authorize from the session (admin or owning landlord via RLS).
  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  // RLS limits this read to leases the caller may manage.
  const lease = await getLeaseById(server, id);
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  if (!canGenerate(lease.status)) {
    return NextResponse.json(
      { ok: false, error: `Cannot generate a ${lease.status} lease` }, { status: 409 }
    );
  }

  // 2. Resolve the template clauses (lease.template_id or the global template).
  const admin = getSupabaseAdminClient();
  let templateClauses: LeaseClause[] = [];
  if (lease.template_id) {
    const { data: tpl } = await admin
      .from("lease_templates").select("*").eq("id", lease.template_id).maybeSingle();
    templateClauses = parseClauses(tpl?.clauses);
  }
  if (templateClauses.length === 0) {
    const global = await getGlobalTemplate(admin);
    templateClauses = parseClauses(global?.clauses);
  }
  if (templateClauses.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No lease template available" }, { status: 422 }
    );
  }

  // 3. Render the PDF and upload via service role.
  const pdf = await renderLeasePdf(lease, templateClauses);
  const path = `leases/${lease.id}/agreement.pdf`;
  const { error: upErr } = await admin.storage
    .from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  // 4. Move the lease to pending_signature.
  const { error: updErr } = await admin
    .from("leases")
    .update({ document_url: path, status: "pending_signature" })
    .eq("id", lease.id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document_url: path });
}
