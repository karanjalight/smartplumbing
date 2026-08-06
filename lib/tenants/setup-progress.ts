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
  paysWaterDeposit: boolean;
  paysElectricityDeposit: boolean;
  paysRentDeposit: boolean;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
  rentDepositKes: number | null;
  leaseStatus: "none" | "draft" | "pending_signature" | "active";
  tenantSignedLease: boolean;
};

function nonEmpty(value: string | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** A deposit the tenant pays needs a known unit price; waived deposits are fine. */
function priced(pays: boolean, price: number | null): boolean {
  return !pays || (typeof price === "number" && price >= 0);
}

function depositsDone(input: SetupProgressInput): boolean {
  if (!input.unitId) return false;
  if (input.hasWaterMeter && !priced(input.paysWaterDeposit, input.waterMeterDepositKes)) {
    return false;
  }
  if (
    input.hasElectricityMeter &&
    !priced(input.paysElectricityDeposit, input.electricityMeterDepositKes)
  ) {
    return false;
  }
  if (!priced(input.paysRentDeposit, input.rentDepositKes)) return false;
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
