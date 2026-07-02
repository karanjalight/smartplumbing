import type { LeasePlaceholders } from "@/lib/leases/types";
import type { LeaseRow } from "@/lib/supabase/types";

const BLANK = "__________";

function money(value: number | null): string {
  if (value === null || Number.isNaN(value)) return BLANK;
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function text(value: string | number | null): string {
  if (value === null || value === "") return BLANK;
  return String(value);
}

export function leasePlaceholders(lease: LeaseRow): LeasePlaceholders {
  return {
    landlord_name: text(lease.landlord_name),
    tenant_name: text(lease.tenant_name),
    tenant_national_id: text(lease.tenant_national_id),
    property_label: text(lease.property_label),
    rent_kes: money(lease.rent_kes),
    deposit_kes: money(lease.deposit_kes),
    frequency: text(lease.frequency),
    payment_day: text(lease.payment_day),
    start_date: text(lease.start_date),
    end_date: text(lease.end_date),
  };
}

export function applyPlaceholders(
  markdown: string,
  values: LeasePlaceholders
): string {
  return markdown.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const v = (values as Record<string, string>)[key];
    return v === undefined ? match : v;
  });
}
