import { notFound } from "next/navigation";

import { TenantDetailView } from "@/components/dashboard/tenant-detail-view";
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
  return <TenantDetailView tenant={tenant} />;
}
