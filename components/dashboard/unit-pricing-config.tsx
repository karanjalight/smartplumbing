"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { updateUnit } from "@/app/(dashboard)/dashboard/buildings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Prices = {
  rentKes: number | null;
  rentDepositKes: number | null;
  waterMeterDepositKes: number | null;
  electricityMeterDepositKes: number | null;
};

function toNum(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}
function toStr(v: number | null): string {
  return v != null ? String(v) : "";
}

export function UnitPricingConfig({
  unitId,
  initial,
}: {
  unitId: string;
  initial: Prices;
}) {
  const router = useRouter();
  const [rent, setRent] = useState(toStr(initial.rentKes));
  const [rentDep, setRentDep] = useState(toStr(initial.rentDepositKes));
  const [waterDep, setWaterDep] = useState(toStr(initial.waterMeterDepositKes));
  const [elecDep, setElecDep] = useState(toStr(initial.electricityMeterDepositKes));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await updateUnit({
      unitId,
      rentKes: toNum(rent),
      rentDepositKes: toNum(rentDep),
      waterMeterDepositKes: toNum(waterDep),
      electricityMeterDepositKes: toNum(elecDep),
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Pricing saved");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const fields: { label: string; value: string; set: (v: string) => void }[] = [
    { label: "Rent / month", value: rent, set: setRent },
    { label: "Rent deposit", value: rentDep, set: setRentDep },
    { label: "Water meter deposit", value: waterDep, set: setWaterDep },
    { label: "Electricity meter deposit", value: elecDep, set: setElecDep },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
      <h2 className="text-sm font-semibold text-foreground">Rent &amp; deposits</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Set the monthly rent and the deposit amounts for this unit&rsquo;s meters.
      </p>
      <div className="mt-4 space-y-3">
        {fields.map((f) => (
          <label key={f.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{f.label}</span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">KES</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder="0.00"
                className="max-w-36"
                aria-label={f.label}
              />
            </span>
          </label>
        ))}
        <Button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
        >
          Save pricing
        </Button>
      </div>
    </div>
  );
}
