"use client";

import { Droplets, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateTenantDeposits } from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  tenantId: string;
  landlordId: string;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  initial: {
    waterDepositRequired: boolean;
    waterDepositAmount: number | null;
    electricityDepositRequired: boolean;
    electricityDepositAmount: number | null;
  };
  onSaved?: () => void;
};

function MeterDepositRow({
  icon,
  label,
  required,
  amount,
  onRequiredChange,
  onAmountChange,
}: {
  icon: React.ReactNode;
  label: string;
  required: boolean;
  amount: string;
  onRequiredChange: (v: boolean) => void;
  onAmountChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-4 dark:border-border/40">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onRequiredChange(e.target.checked)}
          className="size-4 rounded border-border accent-[#0A4266]"
        />
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label} deposit required
        </span>
      </label>
      {required ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">KES</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="max-w-40"
            aria-label={`${label} deposit amount`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function TenantDepositConfig({
  tenantId,
  landlordId,
  hasWaterMeter,
  hasElectricityMeter,
  initial,
  onSaved,
}: Props) {
  const router = useRouter();
  const [waterRequired, setWaterRequired] = useState(initial.waterDepositRequired);
  const [waterAmount, setWaterAmount] = useState(
    initial.waterDepositAmount != null ? String(initial.waterDepositAmount) : "",
  );
  const [elecRequired, setElecRequired] = useState(
    initial.electricityDepositRequired,
  );
  const [elecAmount, setElecAmount] = useState(
    initial.electricityDepositAmount != null
      ? String(initial.electricityDepositAmount)
      : "",
  );
  const [busy, setBusy] = useState(false);

  const noMeters = !hasWaterMeter && !hasElectricityMeter;

  async function save() {
    setBusy(true);
    const res = await updateTenantDeposits({
      tenantId,
      landlordId,
      waterDepositRequired: hasWaterMeter && waterRequired,
      waterDepositAmount:
        hasWaterMeter && waterRequired && waterAmount.trim() !== ""
          ? Number(waterAmount)
          : null,
      electricityDepositRequired: hasElectricityMeter && elecRequired,
      electricityDepositAmount:
        hasElectricityMeter && elecRequired && elecAmount.trim() !== ""
          ? Number(elecAmount)
          : null,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Deposits saved");
      router.refresh();
      onSaved?.();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <h2 className="text-base font-semibold text-foreground">Deposits</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure the security deposit for each assigned meter.
      </p>
      {noMeters ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Assign a meter to configure deposits.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {hasWaterMeter ? (
            <MeterDepositRow
              icon={<Droplets className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
              label="Water"
              required={waterRequired}
              amount={waterAmount}
              onRequiredChange={setWaterRequired}
              onAmountChange={setWaterAmount}
            />
          ) : null}
          {hasElectricityMeter ? (
            <MeterDepositRow
              icon={<Zap className="size-4 text-amber-500" />}
              label="Electricity"
              required={elecRequired}
              amount={elecAmount}
              onRequiredChange={setElecRequired}
              onAmountChange={setElecAmount}
            />
          ) : null}
          <Button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          >
            Save deposits
          </Button>
        </div>
      )}
    </section>
  );
}
