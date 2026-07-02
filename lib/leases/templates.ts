import type { LeaseClause } from "@/lib/leases/types";

/**
 * Returns a new clause list where editable clauses adopt the landlord's
 * per-lease override (when present). Non-editable clauses are never changed.
 */
export function mergeClauses(
  clauses: LeaseClause[],
  overrides: Record<string, string>
): LeaseClause[] {
  return clauses.map((clause) => {
    if (!clause.editable) return { ...clause };
    const override = overrides[clause.key];
    return override === undefined
      ? { ...clause }
      : { ...clause, body_markdown: override };
  });
}

/** Narrowing parser for the jsonb `clauses` column. */
export function parseClauses(value: unknown): LeaseClause[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is LeaseClause =>
      !!c &&
      typeof (c as LeaseClause).key === "string" &&
      typeof (c as LeaseClause).title === "string" &&
      typeof (c as LeaseClause).body_markdown === "string" &&
      typeof (c as LeaseClause).editable === "boolean"
  );
}
