import { NextResponse } from "next/server";

import { getLeaseById } from "@/lib/leases/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "tenant-documents";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wantSigned = new URL(request.url).searchParams.get("signed") === "1";

  const server = await getSupabaseServerClient();
  const { data: auth } = await server.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const lease = await getLeaseById(server, id); // RLS-scoped
  if (!lease) {
    return NextResponse.json({ ok: false, error: "Lease not found" }, { status: 404 });
  }
  const path = wantSigned ? lease.signed_document_url : lease.document_url;
  if (!path) {
    return NextResponse.json({ ok: false, error: "Document not generated" }, { status: 404 });
  }
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Could not sign URL" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: data.signedUrl });
}
