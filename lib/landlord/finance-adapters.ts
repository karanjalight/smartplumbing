import type { PaymentRow } from "@/lib/supabase/types";
import type { DashboardPayment, PaymentCategory } from "@/lib/payments-data";

export function toDashboardPayments(
  payments: PaymentRow[],
  lookups: { tenantName: Map<string, string>; property: Map<string, string>; meterNo: Map<string, string> },
): DashboardPayment[] {
  return payments.map((p) => ({
    id: p.id,
    tenantId: p.tenant_id ?? "",
    tenantName: (p.tenant_id && lookups.tenantName.get(p.tenant_id)) || "—",
    property: (p.tenant_id && lookups.property.get(p.tenant_id)) || "—",
    meterNo: (p.meter_id && lookups.meterNo.get(p.meter_id)) || "—",
    amountKes: Number(p.amount_kes),
    method: p.method as DashboardPayment["method"],
    status: p.status as DashboardPayment["status"],
    category: p.category as PaymentCategory,
    reference: p.reference ?? "",
    createdAtIso: p.created_at,
  }));
}
