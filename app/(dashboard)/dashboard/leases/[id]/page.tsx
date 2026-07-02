import { notFound } from "next/navigation";

import { getGlobalTemplate, getLeaseById, listSignatures } from "@/lib/leases/queries";
import { parseClauses } from "@/lib/leases/templates";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LeaseDetailClient } from "./lease-detail-client";

export default async function LeaseDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await getSupabaseServerClient();
  const lease = await getLeaseById(client, id);
  if (!lease) notFound();
  const template = await getGlobalTemplate(client);
  const signatures = await listSignatures(client, id);
  return (
    <LeaseDetailClient
      lease={lease}
      clauses={parseClauses(template?.clauses)}
      signedRoles={signatures.map((s) => s.signer_role)}
    />
  );
}
