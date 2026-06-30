import { describe, expect, it } from "vitest";
import type { LeaseClause } from "@/lib/leases/types";
import { mergeClauses } from "@/lib/leases/templates";

const base: LeaseClause[] = [
  { key: "parties", title: "Parties", body_markdown: "fixed", editable: false },
  { key: "house_rules", title: "House Rules", body_markdown: "default", editable: true },
];

describe("mergeClauses", () => {
  it("applies an override only to editable clauses", () => {
    const out = mergeClauses(base, { house_rules: "no pets" });
    expect(out[1].body_markdown).toBe("no pets");
  });

  it("ignores overrides for non-editable clauses", () => {
    const out = mergeClauses(base, { parties: "hacked" });
    expect(out[0].body_markdown).toBe("fixed");
  });

  it("keeps the default when no override is supplied", () => {
    const out = mergeClauses(base, {});
    expect(out[1].body_markdown).toBe("default");
  });

  it("preserves order and does not mutate the input", () => {
    const snapshot = JSON.stringify(base);
    const out = mergeClauses(base, { house_rules: "x" });
    expect(out.map((c) => c.key)).toEqual(["parties", "house_rules"]);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
