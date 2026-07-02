"use client";

import type { LeaseClause } from "@/lib/leases/types";

export function ClauseEditor({
  clauses, value, onChange,
}: {
  clauses: LeaseClause[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const editable = clauses.filter((c) => c.editable);

  if (editable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This template has no editable clauses.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {editable.map((clause) => (
        <div key={clause.key} className="space-y-1.5">
          <label
            htmlFor={`clause-${clause.key}`}
            className="text-sm font-medium text-foreground"
          >
            {clause.title}
          </label>
          <textarea
            id={`clause-${clause.key}`}
            className="w-full rounded-lg border border-input bg-transparent p-3 text-sm leading-relaxed outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            rows={3}
            defaultValue={value[clause.key] ?? clause.body_markdown}
            onChange={(e) => onChange({ ...value, [clause.key]: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Supports markdown: <code className="rounded bg-muted px-1">**bold**</code>,{" "}
            <code className="rounded bg-muted px-1">*italic*</code>, and{" "}
            <code className="rounded bg-muted px-1">- bullets</code>.
          </p>
        </div>
      ))}
    </div>
  );
}
