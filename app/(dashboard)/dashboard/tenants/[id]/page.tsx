import { notFound } from "next/navigation";
import { use } from "react";

import { TenantDetailView } from "@/components/dashboard/tenant-detail-view";
import { getTenantById } from "@/lib/tenants-data";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const tenant = getTenantById(id);
  return {
    title: tenant
      ? `${tenant.name} — Tenant — Smart Plumbing`
      : "Tenant — Smart Plumbing",
    description: "Tenant account, STS meter, payments, and landlord context.",
  };
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  const tenant = getTenantById(id);
  if (!tenant) notFound();
  return <TenantDetailView tenant={tenant} />;
}
