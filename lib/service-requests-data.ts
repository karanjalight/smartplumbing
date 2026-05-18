import type {
  ServiceRequestRow,
  ServiceRequestStatus,
  ServiceUrgency,
} from "@/lib/supabase/types";

export type ClientServiceUrgency = "Low" | "Standard" | "Urgent";

export type ClientServiceRequest = {
  id: string;
  code: string;
  serviceType: string;
  area: string;
  issueSummary: string;
  preferredDate: string;
  urgency: ClientServiceUrgency;
  status: string;
  statusKey: ServiceRequestStatus;
  note?: string;
  propertyName?: string;
  houseLabel?: string;
};

export function urgencyToDb(urgency: ClientServiceUrgency): ServiceUrgency {
  switch (urgency) {
    case "Low":
      return "low";
    case "Urgent":
      return "urgent";
    default:
      return "standard";
  }
}

export function urgencyFromDb(urgency: ServiceUrgency): ClientServiceUrgency {
  switch (urgency) {
    case "low":
      return "Low";
    case "urgent":
      return "Urgent";
    default:
      return "Standard";
  }
}

export function serviceRequestStatusLabel(status: ServiceRequestStatus): string {
  switch (status) {
    case "submitted":
      return "Pending";
    case "acknowledged":
      return "In review";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function formatServiceRequestCode(
  code: string | null | undefined,
  id: string,
): string {
  const trimmed = code?.trim();
  if (trimmed) return trimmed;
  return `SR-${id.slice(0, 8).toUpperCase()}`;
}

export function formatPreferredDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "Date TBC";
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function generateServiceRequestCode(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SR-${year}-${suffix}`;
}

export function mapServiceRequestRow(
  row: ServiceRequestRow,
  opts?: { propertyName?: string; houseLabel?: string },
): ClientServiceRequest {
  return {
    id: row.id,
    code: formatServiceRequestCode(row.code, row.id),
    serviceType: row.service_type,
    area: row.area?.trim() || "—",
    issueSummary: row.fault_summary,
    preferredDate: formatPreferredDate(row.preferred_date),
    urgency: urgencyFromDb(row.urgency),
    status: serviceRequestStatusLabel(row.status),
    statusKey: row.status,
    note: row.note?.trim() || undefined,
    propertyName: opts?.propertyName,
    houseLabel: opts?.houseLabel,
  };
}

export function serviceRequestHistoryStatus(
  status: ServiceRequestStatus,
): "success" | "pending" {
  return status === "completed" ? "success" : "pending";
}
