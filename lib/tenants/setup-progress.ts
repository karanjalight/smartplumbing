export type SetupStepKey = "profile" | "property_meter" | "deposits" | "lease";

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  done: boolean;
};

export type TenantSetupProgress = {
  steps: SetupStep[];
  completed: number;
  total: number;
  percent: number;
};

export type SetupProgressInput = {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  unitId: string | null;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  waterDepositRequired: boolean;
  waterDepositAmount: number | null;
  electricityDepositRequired: boolean;
  electricityDepositAmount: number | null;
  leaseStatus: "none" | "draft" | "pending_signature" | "active";
  tenantSignedLease: boolean;
};

function nonEmpty(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** A single assigned meter is "configured" if no deposit is required, or a
 * positive amount is set when one is. */
function meterConfigured(required: boolean, amount: number | null): boolean {
  if (!required) return true;
  return typeof amount === "number" && amount > 0;
}

function depositsDone(input: SetupProgressInput): boolean {
  if (!input.hasWaterMeter && !input.hasElectricityMeter) return false;
  if (
    input.hasWaterMeter &&
    !meterConfigured(input.waterDepositRequired, input.waterDepositAmount)
  ) {
    return false;
  }
  if (
    input.hasElectricityMeter &&
    !meterConfigured(
      input.electricityDepositRequired,
      input.electricityDepositAmount,
    )
  ) {
    return false;
  }
  return true;
}

/** Pure: the ordered 4-step tenant account-setup progress. */
export function computeTenantSetupProgress(
  input: SetupProgressInput,
): TenantSetupProgress {
  const steps: SetupStep[] = [
    {
      key: "profile",
      label: "Profile & contact",
      done: nonEmpty(input.fullName) && (nonEmpty(input.phone) || nonEmpty(input.email)),
    },
    {
      key: "property_meter",
      label: "Property & meter assigned",
      done:
        nonEmpty(input.unitId) &&
        (input.hasWaterMeter || input.hasElectricityMeter),
    },
    {
      key: "deposits",
      label: "Deposits configured",
      done: depositsDone(input),
    },
    {
      key: "lease",
      label: "Lease signed",
      done: input.leaseStatus === "active" || input.tenantSignedLease,
    },
  ];
  const total = steps.length;
  const completed = steps.filter((s) => s.done).length;
  const percent = Math.round((completed / total) * 100);
  return { steps, completed, total, percent };
}
