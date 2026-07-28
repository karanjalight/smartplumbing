import { formatKes } from "@/lib/billing/money";
import {
  summarizeRentCommissions, type RentCommissionRow,
} from "@/lib/billing/commissions-data";

export function RentCommissionsPanel({
  rows, heading, subtitle,
}: {
  rows: RentCommissionRow[];
  heading: string;
  subtitle: string;
}) {
  const totals = summarizeRentCommissions(rows);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{heading}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rent collected" value={formatKes(totals.grossKes)} />
        <Stat label="Our commission" value={formatKes(totals.commissionKes)} />
        <Stat label="Landlord net" value={formatKes(totals.netToLandlordKes)} />
        <Stat label="Payments" value={String(totals.count)} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No rent payments recorded yet. Splits appear here once tenants pay rent.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Tenant</th>
                <th className="py-2 pr-3">Building</th>
                <th className="py-2 pr-3 text-right">Gross</th>
                <th className="py-2 pr-3 text-right">Commission</th>
                <th className="py-2 pr-3 text-right">Landlord net</th>
                <th className="py-2 pr-3">Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">
                    {new Date(r.createdAtIso).toLocaleDateString("en-KE")}
                  </td>
                  <td className="py-2 pr-3">{r.tenantName}</td>
                  <td className="py-2 pr-3">{r.buildingName}</td>
                  <td className="py-2 pr-3 text-right">{formatKes(r.grossKes)}</td>
                  <td className="py-2 pr-3 text-right">
                    {formatKes(r.commissionKes)}{" "}
                    <span className="text-xs text-slate-400">({r.commissionPct}%)</span>
                  </td>
                  <td className="py-2 pr-3 text-right">{formatKes(r.netToLandlordKes)}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {r.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
