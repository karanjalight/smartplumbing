"use client";

import { Home, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingListRow } from "@/lib/buildings-data";
import {
  addPortfolioHouseAndUpdateBuilding,
  defaultTenantForLandlord,
  newHouseUnitId,
  newPlaceholderMeterSerial,
  newTenantId,
  upsertLandlordTenant,
} from "@/lib/landlord-portfolio-storage";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  building: BuildingListRow;
  landlordId: string;
};

export function LandlordAddHouseModal({ open, onClose, building, landlordId }: Props) {
  const [label, setLabel] = useState("");
  const [rent, setRent] = useState("");
  const [note, setNote] = useState("");
  const [assignMeter, setAssignMeter] = useState(false);
  const [meterSerial, setMeterSerial] = useState("");
  const [createTenant, setCreateTenant] = useState(false);
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setRent(building.rentModel === "per_unit" ? String(building.rentKes) : "");
    setNote("");
    setAssignMeter(false);
    setMeterSerial("");
    setCreateTenant(false);
    setTenantName("");
    setTenantPhone("");
  }, [open, building.rentKes, building.rentModel]);

  if (!open) return null;

  function resolveMeterId(): string | null {
    if (!assignMeter && !createTenant) return null;
    const raw = meterSerial.trim();
    if (raw) return raw;
    return newPlaceholderMeterSerial();
  }

  function submit() {
    const unitLabel = label.trim();
    if (!unitLabel) {
      toast.error("Enter a unit label (e.g. Block B · Unit 4).");
      return;
    }

    const rentNum = Math.round(Number(String(rent).replace(/,/g, "")));
    let rentFinal: number | null = null;
    if (Number.isFinite(rentNum) && rentNum > 0) {
      rentFinal = rentNum;
    } else if (building.rentModel === "per_unit") {
      rentFinal = building.rentKes;
    }

    const meterId = resolveMeterId();
    const houseId = newHouseUnitId();

    let tenantId: string | null = null;
    let tenantDisplay: string | null = null;

    if (createTenant) {
      const tn = tenantName.trim();
      const tp = tenantPhone.trim();
      if (!tn || !tp) {
        toast.error("Enter tenant name and phone, or turn off “Create tenant”.");
        return;
      }
      const m = meterId ?? newPlaceholderMeterSerial();
      const tid = newTenantId();
      const t = {
        ...defaultTenantForLandlord(landlordId, building.name),
        id: tid,
        name: tn,
        phone: tp,
        unit: unitLabel,
        property: building.name,
        meterId: m,
        status: "active" as const,
        buildingId: building.id,
        houseUnitId: houseId,
      };
      upsertLandlordTenant(t);
      tenantId = tid;
      tenantDisplay = t.name;
    }

    const houseMeterId = createTenant ? (meterId ?? newPlaceholderMeterSerial()) : meterId;

    const house = {
      id: houseId,
      buildingId: building.id,
      label: unitLabel,
      description: note.trim() || null,
      rentKes: rentFinal,
      meterId: houseMeterId,
      tenantId,
      tenantName: tenantDisplay,
    };

    addPortfolioHouseAndUpdateBuilding(landlordId, building.id, house, Boolean(houseMeterId));
    toast.success("Unit added", {
      description: createTenant ? "Tenant created and linked to this unit." : "House row saved to your portfolio.",
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
          <Home className="size-6" />
          <h2 className="text-lg font-semibold text-foreground">Add house / unit</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {building.name} — add a unit with rent and notes. Optionally assign an STS meter and create a tenant in one step.
        </p>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="uh-label">Unit label *</Label>
            <Input
              id="uh-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="rounded-full"
              placeholder="e.g. Block A · Unit 24"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="uh-rent">Monthly rent (KES)</Label>
              <Input
                id="uh-rent"
                inputMode="numeric"
                value={rent}
                onChange={(e) => setRent(e.target.value.replace(/[^\d]/g, ""))}
                className="rounded-full tabular-nums"
                placeholder={building.rentModel === "per_unit" ? String(building.rentKes) : "Optional"}
              />
            </div>
            <div className="flex items-end pb-1 text-xs text-muted-foreground sm:col-span-1">
              {building.rentModel === "whole_building"
                ? "Whole-building lease — unit rent is still useful for sub-units / cost allocation."
                : "Defaults to building per-unit rate if left empty."}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="uh-note">Additional note</Label>
            <textarea
              id="uh-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
              placeholder="Access instructions, parking, meter cupboard location…"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4 dark:border-border/80">
            <button
              type="button"
              onClick={() => setAssignMeter((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="font-medium text-foreground">Assign water meter</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Link an STS prepayment meter to this unit. Leave serial blank to auto-generate a demo ID.
                </span>
              </span>
              <span
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  assignMeter ? "bg-[#0A4266] dark:bg-[#6BB4E8]" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                    assignMeter ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </span>
            </button>
            {assignMeter && (
              <div className="mt-3 space-y-2">
                <Label htmlFor="uh-meter">Meter serial (STS)</Label>
                <Input
                  id="uh-meter"
                  value={meterSerial}
                  onChange={(e) => setMeterSerial(e.target.value)}
                  className="rounded-full font-mono text-xs"
                  placeholder="Optional — demo ID generated if empty"
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-[#0A4266]/30 bg-[#0A4266]/5 p-4 dark:border-[#6BB4E8]/30 dark:bg-[#6BB4E8]/10">
            <button
              type="button"
              onClick={() => setCreateTenant((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                <span>
                  <span className="font-medium text-foreground">Create tenant for this unit</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Adds a tenant record under your portfolio and links them to this unit. Meter is required — uses the field
                    above or an auto-generated serial.
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  createTenant ? "bg-[#0A4266] dark:bg-[#6BB4E8]" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform",
                    createTenant ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </span>
            </button>
            {createTenant && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="uh-tname">Tenant name *</Label>
                  <Input
                    id="uh-tname"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="rounded-full"
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="uh-tphone">Phone *</Label>
                  <Input
                    id="uh-tphone"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    className="rounded-full font-mono text-sm"
                    placeholder="+254 7…"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={submit}
          >
            Add unit
          </Button>
        </div>
      </div>
    </div>
  );
}
