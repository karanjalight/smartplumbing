"use client";

import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { deleteLease, previewDeleteLease } from "@/app/(dashboard)/dashboard/leases/actions";

export function LeaseRowActions({ leaseId, label }: { leaseId: string; label: string }) {
  return (
    <DeleteRowButton
      preview={() => previewDeleteLease(leaseId)}
      onDelete={() => deleteLease(leaseId)}
      title="Delete lease?"
      description={`Lease ${label} and its signatures will be permanently deleted.`}
      successMessage="Lease deleted"
    />
  );
}
