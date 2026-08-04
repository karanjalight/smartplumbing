"use client";

import { Droplets, HandCoins, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateTenantDeposits } from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button } from "@/components/ui/button";

type Props = {
  tenantId: string;
  landlordId: string;
  hasWaterMeter: boolean;
  hasElectricityMeter: boolean;
  prices: {
    waterMeterDepositKes: number | null;
    electricityMeterDepositKes: number | null;
    rentDepositKes: number | null;
  };
  initial: {
    paysWaterDeposit: boolean;
    paysElectricityDeposit: boolean;
    paysRentDeposit: boolean;
  };
  onSaved?: () => void;
};

function priceLabel(v: number | null): string {
  return v != null ? `KES ${v.toLocaleString("en-KE")}` : "price not set";
}

function ToggleRow({
  icon,
  label,
  price,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  price: number | null;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 p-3.5 dark:border-border/40">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {label}
        <span className="text-xs font-normal text-muted-foreground">· {priceLabel(price)}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border accent-[#0A4266]"
        aria-label={`Tenant pays ${label}`}
      />
    </label>
  );
}

export function TenantDepositConfig({
  tenantId,
  landlordId,
  hasWaterMeter,
  hasElectricityMeter,
  prices,
  initial,
  onSaved,
}: Props) {
  const router = useRouter();
  const [paysWater, setPaysWater] = useState(initial.paysWaterDeposit);
  const [paysElec, setPaysElec] = useState(initial.paysElectricityDeposit);
  const [paysRent, setPaysRent] = useState(initial.paysRentDeposit);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateTenantDeposits({
      tenantId,
      landlordId,
      paysWaterDeposit: hasWaterMeter && paysWater,
      paysElectricityDeposit: hasElectricityMeter && paysElec,
      paysRentDeposit: paysRent,
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
        Choose which deposits this tenant pays. Amounts are set on the unit.
      </p>
      <div className="mt-4 space-y-3">
        {hasWaterMeter ? (
          <ToggleRow
            icon={<Droplets className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
            label="Water meter deposit"
            price={prices.waterMeterDepositKes}
            checked={paysWater}
            onChange={setPaysWater}
          />
        ) : null}
        {hasElectricityMeter ? (
          <ToggleRow
            icon={<Zap className="size-4 text-amber-500" />}
            label="Electricity meter deposit"
            price={prices.electricityMeterDepositKes}
            checked={paysElec}
            onChange={setPaysElec}
          />
        ) : null}
        <ToggleRow
          icon={<HandCoins className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
          label="Rent deposit"
          price={prices.rentDepositKes}
          checked={paysRent}
          onChange={setPaysRent}
        />
        <Button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
        >
          Save deposits
        </Button>
      </div>
    </section>
  );
}
