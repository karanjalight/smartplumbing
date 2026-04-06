"use client";

import { Copy, Layers, MapPin, Pencil, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rentSummary, type BuildingListRow } from "@/lib/buildings-data";
import {
  getLandlordBuildingsMerged,
  removeWaterPricingOverride,
  type PortfolioStore,
  upsertWaterPricingPartial,
} from "@/lib/landlord-portfolio-storage";
import { mergeWaterPricing, type WaterPricingFields } from "@/lib/landlord-water-pricing";
import { cn } from "@/lib/utils";

function PricingEditorModal({
  open,
  onClose,
  building,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  building: BuildingListRow;
  initial: WaterPricingFields;
}) {
  const [f, setF] = useState<WaterPricingFields>(initial);

  useEffect(() => {
    if (open) setF(initial);
  }, [open, initial]);

  if (!open) return null;

  function save() {
    const unitPrice = Math.max(0, Math.round(f.pricePerUnitKes));
    upsertWaterPricingPartial(building.id, {
      pricePerUnitKes: unitPrice,
      baseRatePerM3Kes: unitPrice,
      unitDefinition: f.unitDefinition.trim() || "1 unit",
      standingChargeKes: Math.max(0, Math.round(f.standingChargeKes)),
      minChargeKes: Math.max(0, Math.round(f.minChargeKes)),
      vatRatePct: Math.min(100, Math.max(0, Math.round(f.vatRatePct))),
      notes: f.notes.trim() || "—",
    });
    toast.success("Water pricing saved");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <h2 className="text-lg font-semibold text-foreground">Edit water pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">{building.name}</p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="wp-unit-price">Price per unit (KES)</Label>
            <p className="text-xs text-muted-foreground">
              Example: enter <span className="font-mono">150</span> so <strong>1 unit = KES 150</strong> for water credit /
              STS vending.
            </p>
            <Input
              id="wp-unit-price"
              inputMode="numeric"
              value={String(f.pricePerUnitKes)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setF((x) => ({ ...x, pricePerUnitKes: Number.isFinite(n) ? n : 0 }));
              }}
              className="rounded-full tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-unit-def">What is one unit?</Label>
            <Input
              id="wp-unit-def"
              value={f.unitDefinition}
              onChange={(e) => setF((x) => ({ ...x, unitDefinition: e.target.value }))}
              className="rounded-full"
              placeholder="e.g. 1 m³, 1000 L, standard STS block"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-stand">Standing charge (KES / month)</Label>
            <Input
              id="wp-stand"
              inputMode="numeric"
              value={String(f.standingChargeKes)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setF((x) => ({ ...x, standingChargeKes: Number.isFinite(n) ? n : 0 }));
              }}
              className="rounded-full tabular-nums"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wp-min">Minimum charge (KES)</Label>
              <Input
                id="wp-min"
                inputMode="numeric"
                value={String(f.minChargeKes)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setF((x) => ({ ...x, minChargeKes: Number.isFinite(n) ? n : 0 }));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wp-vat">VAT (%)</Label>
              <Input
                id="wp-vat"
                inputMode="numeric"
                value={String(f.vatRatePct)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setF((x) => ({ ...x, vatRatePct: Number.isFinite(n) ? n : 0 }));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-notes">Notes</Label>
            <Input
              id="wp-notes"
              value={f.notes}
              onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))}
              className="rounded-full"
              placeholder="Tariff notes for tenants / auditors"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LandlordWaterPricingView({ landlordId }: { landlordId: string }) {
  const store = useLandlordPortfolioStore();
  const [editor, setEditor] = useState<{ building: BuildingListRow; pricing: WaterPricingFields } | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<{
    source: BuildingListRow;
    pricing: WaterPricingFields;
  } | null>(null);

  const buildings = useMemo(
    () => (store ? getLandlordBuildingsMerged(landlordId, store) : []),
    [store, landlordId]
  );

  const rows = useMemo(() => {
    if (!store) return [];
    return buildings.map((b) => ({
      building: b,
      pricing: mergeWaterPricing(b, store.waterPricingOverrides[b.id]),
    }));
  }, [buildings, store]);

  if (store === null) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Loading pricing…</div>
    );
  }

  function hasCustomOverride(buildingId: string): boolean {
    const o = store?.waterPricingOverrides[buildingId];
    return o != null && Object.keys(o).length > 0;
  }

  function confirmReset(building: BuildingListRow) {
    if (
      !confirm(
        `Reset pricing for “${building.name}” to demo defaults? Your custom values will be removed.`
      )
    ) {
      return;
    }
    removeWaterPricingOverride(building.id);
    toast.success("Pricing reset to defaults");
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between dark:border-border/80">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
            <Layers className="size-8" />
            <h1 className="text-2xl font-bold tracking-tight">Water pricing</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Set a <strong className="font-medium text-foreground">price per unit</strong> (e.g. 1 unit = KES 150), describe
            what counts as one unit, then standing charges and VAT. Create overrides, duplicate to another property, or reset
            to defaults.
          </p>
        </div>
        <Button
          type="button"
          className="shrink-0 rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 size-4" />
          Add custom pricing
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Rent (lease)</th>
                <th className="px-4 py-3 font-semibold">KES / unit</th>
                <th className="px-4 py-3 font-semibold">Standing / mo</th>
                <th className="px-4 py-3 font-semibold">Min charge</th>
                <th className="px-4 py-3 font-semibold">VAT</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    Add a building first to set water pricing.
                  </td>
                </tr>
              ) : (
                rows.map(({ building, pricing }) => (
                  <tr key={building.id} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium text-foreground">{building.name}</td>
                    <td className="max-w-[200px] px-4 py-3">
                      <span className="flex items-start gap-1 text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {building.addressLine}, {building.city}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#0A4266] dark:text-[#6BB4E8]">
                      {rentSummary(building)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="tabular-nums font-medium text-foreground">
                        {pricing.pricePerUnitKes.toLocaleString("en-KE")}{" "}
                        <span className="text-xs font-normal text-muted-foreground">KES</span>
                      </div>
                      <div className="mt-0.5 max-w-[200px] text-xs text-muted-foreground">
                        {pricing.unitDefinition}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {pricing.standingChargeKes.toLocaleString("en-KE")}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {pricing.minChargeKes.toLocaleString("en-KE")}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{pricing.vatRatePct}%</td>
                    <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">
                      {pricing.notes}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          hasCustomOverride(building.id)
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {hasCustomOverride(building.id) ? "Custom" : "Default"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={`Edit pricing ${building.name}`}
                          onClick={() => setEditor({ building, pricing })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          title="Copy to another property"
                          aria-label={`Copy pricing from ${building.name}`}
                          onClick={() => setDuplicateFrom({ source: building, pricing })}
                        >
                          <Copy className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                          disabled={!hasCustomOverride(building.id)}
                          title="Reset to defaults"
                          aria-label={`Reset pricing ${building.name}`}
                          onClick={() => confirmReset(building)}
                        >
                          <RotateCcw className="size-4" />
                        </Button>
                        <Link
                          href={`/landlords/dashboard/buildings/${encodeURIComponent(building.id)}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-8 rounded-full px-3 text-xs"
                          )}
                        >
                          Building
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <PricingEditorModal
          open
          onClose={() => setEditor(null)}
          building={editor.building}
          initial={editor.pricing}
        />
      )}

      {createOpen && store && (
        <CreatePricingModal
          buildings={buildings}
          store={store}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {duplicateFrom && store && (
        <DuplicatePricingModal
          source={duplicateFrom.source}
          sourcePricing={duplicateFrom.pricing}
          buildings={buildings.filter((b) => b.id !== duplicateFrom.source.id)}
          onClose={() => setDuplicateFrom(null)}
        />
      )}
    </div>
  );
}

function CreatePricingModal({
  buildings,
  store,
  onClose,
}: {
  buildings: BuildingListRow[];
  store: PortfolioStore;
  onClose: () => void;
}) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const building = buildings.find((b) => b.id === buildingId);
  const initial = building
    ? mergeWaterPricing(building, store.waterPricingOverrides[building.id])
    : null;
  const [f, setF] = useState<WaterPricingFields | null>(initial);

  useEffect(() => {
    const b = buildings.find((x) => x.id === buildingId);
    if (b) setF(mergeWaterPricing(b, store.waterPricingOverrides[b.id]));
  }, [buildingId, buildings, store.waterPricingOverrides]);

  if (!building || !f) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
        <div className="relative z-10 rounded-xl border border-border bg-card p-6 shadow-lg">
          <p className="text-sm text-muted-foreground">Add a property first, then set pricing.</p>
          <Button type="button" className="mt-4 rounded-full" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  function save() {
    const b = buildings.find((x) => x.id === buildingId);
    if (!b || !f) return;
    const unitPrice = Math.max(0, Math.round(f.pricePerUnitKes));
    upsertWaterPricingPartial(b.id, {
      pricePerUnitKes: unitPrice,
      baseRatePerM3Kes: unitPrice,
      unitDefinition: f.unitDefinition.trim() || "1 unit",
      standingChargeKes: Math.max(0, Math.round(f.standingChargeKes)),
      minChargeKes: Math.max(0, Math.round(f.minChargeKes)),
      vatRatePct: Math.min(100, Math.max(0, Math.round(f.vatRatePct))),
      notes: f.notes.trim() || "—",
    });
    toast.success("Custom pricing saved");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80">
        <h2 className="text-lg font-semibold text-foreground">Add custom pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a property, set KES per unit (e.g. 150 → 1 unit = KES 150), then other charges.
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="wp-create-building">Property</Label>
          <select
            id="wp-create-building"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="wp-c-unit-price">Price per unit (KES)</Label>
            <Input
              id="wp-c-unit-price"
              inputMode="numeric"
              value={String(f.pricePerUnitKes)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setF((x) => (x ? { ...x, pricePerUnitKes: Number.isFinite(n) ? n : 0 } : x));
              }}
              className="rounded-full tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-c-unit-def">What is one unit?</Label>
            <Input
              id="wp-c-unit-def"
              value={f.unitDefinition}
              onChange={(e) => setF((x) => (x ? { ...x, unitDefinition: e.target.value } : x))}
              className="rounded-full"
              placeholder="e.g. 1 m³ prepaid block"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-c-stand">Standing charge (KES / month)</Label>
            <Input
              id="wp-c-stand"
              inputMode="numeric"
              value={String(f.standingChargeKes)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setF((x) => (x ? { ...x, standingChargeKes: Number.isFinite(n) ? n : 0 } : x));
              }}
              className="rounded-full tabular-nums"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wp-c-min">Minimum charge (KES)</Label>
              <Input
                id="wp-c-min"
                inputMode="numeric"
                value={String(f.minChargeKes)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setF((x) => (x ? { ...x, minChargeKes: Number.isFinite(n) ? n : 0 } : x));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wp-c-vat">VAT (%)</Label>
              <Input
                id="wp-c-vat"
                inputMode="numeric"
                value={String(f.vatRatePct)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setF((x) => (x ? { ...x, vatRatePct: Number.isFinite(n) ? n : 0 } : x));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wp-c-notes">Notes</Label>
            <Input
              id="wp-c-notes"
              value={f.notes}
              onChange={(e) => setF((x) => (x ? { ...x, notes: e.target.value } : x))}
              className="rounded-full"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function DuplicatePricingModal({
  source,
  sourcePricing,
  buildings,
  onClose,
}: {
  source: BuildingListRow;
  sourcePricing: WaterPricingFields;
  buildings: BuildingListRow[];
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState(buildings[0]?.id ?? "");

  if (buildings.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
        <div className="relative z-10 rounded-xl border border-border bg-card p-6 shadow-lg">
          <p className="text-sm text-muted-foreground">Add another property to copy pricing into.</p>
          <Button type="button" className="mt-4 rounded-full" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  function apply() {
    const t = buildings.find((b) => b.id === targetId);
    if (!t) return;
    upsertWaterPricingPartial(t.id, {
      pricePerUnitKes: sourcePricing.pricePerUnitKes,
      baseRatePerM3Kes: sourcePricing.baseRatePerM3Kes ?? sourcePricing.pricePerUnitKes,
      unitDefinition: sourcePricing.unitDefinition,
      standingChargeKes: sourcePricing.standingChargeKes,
      minChargeKes: sourcePricing.minChargeKes,
      vatRatePct: sourcePricing.vatRatePct,
      notes: `Copied from ${source.name}: ${sourcePricing.notes}`,
    });
    toast.success(`Pricing copied to ${t.name}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80">
        <h2 className="text-lg font-semibold text-foreground">Copy pricing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Copy values from <span className="font-medium text-foreground">{source.name}</span> to:
        </p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="wp-dup-target">Target property</Label>
          <select
            id="wp-dup-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
          >
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={apply}
          >
            Copy & save
          </Button>
        </div>
      </div>
    </div>
  );
}
