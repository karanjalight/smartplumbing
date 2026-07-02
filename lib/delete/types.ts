export type ImpactSeverity = "delete" | "unassign" | "info";

/** One line in a delete-confirmation impact summary. */
export type ImpactItem = {
  label: string;
  count: number;
  severity: ImpactSeverity;
};

/** Return shape shared by every `previewDelete<Entity>` server action. */
export type DeletePreviewResult =
  | { ok: true; impact: ImpactItem[] }
  | { ok: false; error: string };
