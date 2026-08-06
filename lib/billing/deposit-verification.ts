import type { DepositKind } from "@/lib/billing/deposits";

const KINDS: DepositKind[] = ["water", "electricity", "rent"];

export type DepositVerifyFacts = {
  paymentSucceeded: boolean;
  tenantId: string | null;
  kind: string | null;
  grossKes: number;
  tenantProfileId: string | null;
  authUserId: string;
  alreadyProcessed: boolean;
};

export type DepositVerifyDecision =
  | { kind: "error"; status: number; message: string }
  | { kind: "already" }
  | { kind: "record"; tenantId: string; depositKind: DepositKind; grossKes: number };

/** Pure: decide what a verified deposit payment should do. Ownership is checked
 * BEFORE idempotency so a foreign caller can never learn/settle another tenant's
 * payment. */
export function resolveDepositVerification(f: DepositVerifyFacts): DepositVerifyDecision {
  if (!f.paymentSucceeded) {
    return { kind: "error", status: 400, message: "Payment is not successful." };
  }
  if (!f.tenantId) {
    return { kind: "error", status: 400, message: "Tenant is missing from the payment." };
  }
  if (!f.kind || !KINDS.includes(f.kind as DepositKind)) {
    return { kind: "error", status: 400, message: "Invalid deposit kind." };
  }
  if (!Number.isFinite(f.grossKes) || f.grossKes <= 0) {
    return { kind: "error", status: 400, message: "Paid amount is invalid." };
  }
  if (!f.tenantProfileId || f.tenantProfileId !== f.authUserId) {
    return { kind: "error", status: 403, message: "You can only pay deposits for your own account." };
  }
  if (f.alreadyProcessed) {
    return { kind: "already" };
  }
  return { kind: "record", tenantId: f.tenantId, depositKind: f.kind as DepositKind, grossKes: f.grossKes };
}
