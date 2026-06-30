import Link from "next/link";
import { notFound } from "next/navigation";

import { TenantDetailView } from "@/components/dashboard/tenant-detail-view";
import { getActiveLeaseForTenant } from "@/lib/leases/queries";
import {
  fetchTenantDetailById,
  getTenantById,
} from "@/lib/tenants-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

async function resolveTenant(id: string) {
  try {
    const supabase = await getSupabaseServerClient();
    const fromDb = await fetchTenantDetailById(supabase, id);
    if (fromDb) return fromDb;
  } catch {
    /* fall through to mock */
  }
  return getTenantById(id);
}

async function resolveActiveLease(id: string) {
  try {
    const supabase = await getSupabaseServerClient();
    return await getActiveLeaseForTenant(supabase, id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const tenant = await resolveTenant(id);
  return {
    title: tenant
      ? `${tenant.name} — Tenant — Mali Smart`
      : "Tenant — Mali Smart",
    description: "Tenant account, STS meter, payments, and landlord context.",
  };
}

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params;
  const tenant = await resolveTenant(id);
  if (!tenant) notFound();
  const lease = await resolveActiveLease(id);
  return (
    <>
      {lease && (
        <div className="px-6 pt-4">
          <Link
            href={`/dashboard/leases/${lease.id}`}
            className="text-sm underline"
          >
            View lease {lease.code} ({lease.status})
          </Link>
        </div>
      )}
      <TenantDetailView tenant={tenant} />
    </>
  );
}
