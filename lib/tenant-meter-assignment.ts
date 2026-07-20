export type MeterConflictRow = {
  id: string;
  meter_id: string | null;
  electricity_meter_id: string | null;
};

export type MeterTargetColumn = "meter_id" | "electricity_meter_id";

/**
 * Decides whether assigning `meterId` to `targetColumn` for `tenantId` conflicts with
 * existing tenant-meter links. Pure and DB-free so it can be unit tested directly —
 * `resolveMeterIdForTenant` in tenants/actions.ts is the Supabase-querying wrapper
 * around this decision.
 */
export function findMeterAssignmentConflict(
  conflictingTenants: MeterConflictRow[],
  tenantId: string,
  meterId: string,
  targetColumn: MeterTargetColumn,
): { conflict: true; error: string } | { conflict: false } {
  const otherColumn: MeterTargetColumn =
    targetColumn === "meter_id" ? "electricity_meter_id" : "meter_id";

  for (const row of conflictingTenants) {
    if (row.id !== tenantId) {
      return { conflict: true, error: "That meter is already linked to another tenant." };
    }
    if (row[otherColumn] === meterId) {
      return {
        conflict: true,
        error:
          targetColumn === "meter_id"
            ? "That meter is already assigned as this tenant's electricity meter."
            : "That meter is already assigned as this tenant's water meter.",
      };
    }
  }
  return { conflict: false };
}
