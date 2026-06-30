import Link from "next/link";

import { LeaseStatusBadge } from "@/components/leases/lease-status-badge";
import { listLeases } from "@/lib/leases/queries";
import { deriveExpiry } from "@/lib/leases/status";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function LeasesPage() {
  const client = await getSupabaseServerClient();
  const leases = await listLeases(client);
  const now = new Date();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leases</h1>
        <Link href="/dashboard/leases/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white">
          New lease
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr><th className="py-2">Code</th><th>Tenant</th><th>Term</th>
            <th>Rent</th><th>Status</th></tr>
        </thead>
        <tbody>
          {leases.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="py-2">
                <Link href={`/dashboard/leases/${l.id}`} className="underline">
                  {l.code ?? l.id.slice(0, 8)}
                </Link>
              </td>
              <td>{l.tenant_name ?? "—"}</td>
              <td>{l.start_date ?? "—"} → {l.end_date ?? "—"}</td>
              <td>{l.rent_kes ? `KES ${l.rent_kes.toLocaleString("en-KE")}` : "—"}</td>
              <td><LeaseStatusBadge status={l.status} expiry={deriveExpiry(l, now)} /></td>
            </tr>
          ))}
          {leases.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-zinc-400">
              No leases yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
