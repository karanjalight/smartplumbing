/** Round to 2 decimal places (KES cents), avoiding float drift. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Format a KES amount for display, e.g. 15000 → "KES 15,000.00". */
export function formatKes(n: number): string {
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
