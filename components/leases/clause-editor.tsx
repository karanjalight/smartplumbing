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
  return (
    <div className="space-y-4">
      {editable.map((clause) => (
        <label key={clause.key} className="block space-y-1">
          <span className="text-sm font-medium">{clause.title}</span>
          <textarea
            className="w-full rounded-md border border-zinc-300 p-2 text-sm"
            rows={3}
            defaultValue={value[clause.key] ?? clause.body_markdown}
            onChange={(e) => onChange({ ...value, [clause.key]: e.target.value })}
          />
          <span className="text-xs text-zinc-400">
            Markdown: **bold**, *italic*, &quot;- &quot; bullets.
          </span>
        </label>
      ))}
    </div>
  );
}
