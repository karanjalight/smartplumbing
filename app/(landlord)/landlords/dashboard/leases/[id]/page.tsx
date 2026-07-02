import { notFound, redirect } from "next/navigation";

import { LeaseDetailClient } from "@/app/(dashboard)/dashboard/leases/[id]/lease-detail-client";
import { fetchSignedInLandlord } from "@/lib/landlord-session";
import { getGlobalTemplate, getLeaseById, listSignatures } from "@/lib/leases/queries";
import { parseClauses } from "@/lib/leases/templates";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Lease — Landlord portal",
  description: "Review, generate and sign a tenancy agreement.",
};

export default async function LandlordLeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const landlord = await fetchSignedInLandlord(supabase);
  if (!landlord) {
    redirect("/auth/login");
  }
  // RLS (leases_landlord_full) scopes this to the landlord's own leases.
  const lease = await getLeaseById(supabase, id);
  if (!lease || lease.landlord_id !== landlord.id) notFound();
  const template = await getGlobalTemplate(supabase);
  const signatures = await listSignatures(supabase, id);

  const backHref = lease.building_id
    ? `/landlords/dashboard/onboarding/building/${lease.building_id}`
    : "/landlords/dashboard/leases";
  const backLabel = lease.building_id ? "Back to onboarding" : "Back to leases";

  return (
    <LeaseDetailClient
      lease={lease}
      clauses={parseClauses(template?.clauses)}
      signedRoles={signatures.map((s) => s.signer_role)}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
