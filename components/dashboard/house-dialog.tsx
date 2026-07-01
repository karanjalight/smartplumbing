"use client";

import { Home, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  addHouseToBuilding, deleteUnit, updateUnit,
} from "@/app/(dashboard)/dashboard/buildings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HouseUnitRow } from "@/lib/buildings-data";
import { UNIT_TYPE_LABEL, UNIT_TYPE_ORDER } from "@/lib/units/labels";
import type { UnitType } from "@/lib/supabase/types";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  /** Provided → edit/delete that house. Absent → add a new house. */
  house?: HouseUnitRow | null;
  defaultRent?: number;
  onSaved: () => void;
};

export function HouseDialog({
  open, onClose, buildingId, house, defaultRent, onSaved,
}: Props) {
  const editing = Boolean(house);
  const [label, setLabel] = useState("");
  const [rent, setRent] = useState("");
  const [description, setDescription] = useState("");
  const [unitType, setUnitType] = useState<UnitType | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset the form to the target house each time the dialog opens.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLabel(house?.label ?? "");
    setRent(
      house?.rentKes != null ? String(house.rentKes)
        : defaultRent ? String(defaultRent) : ""
    );
    setDescription(house?.description ?? "");
    setUnitType(house?.unitType ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, house, defaultRent]);

  if (!open) return null;

  async function save() {
    const trimmed = label.trim();
    if (!trimmed) { toast.error("Enter a house label (e.g. Block A · Unit 4)."); return; }
    const rentValue = rent.trim() === "" ? null : Number(rent);
    setBusy(true);
    const res = editing
      ? await updateUnit({ unitId: house!.id, label: trimmed, rentKes: rentValue, description: description || null, unitType: unitType || null })
      : await addHouseToBuilding({ buildingId, label: trimmed, rentKes: rentValue, description: description || null, unitType: unitType || null });
    setBusy(false);
    if (res.ok) { toast.success(editing ? "House updated" : "House added"); onSaved(); onClose(); }
    else toast.error(res.error);
  }

  async function remove() {
    if (!house) return;
    if (!window.confirm(`Remove "${house.label}"? This cannot be undone.`)) return;
    setBusy(true);
    const res = await deleteUnit(house.id);
    setBusy(false);
    if (res.ok) { toast.success("House removed"); onSaved(); onClose(); }
    else toast.error(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal
        className="relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80">
        <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
          <Home className="size-6" />
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? "Edit house" : "Add house / unit"}
          </h2>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="h-label">House label *</Label>
            <Input id="h-label" value={label} onChange={(e) => setLabel(e.target.value)}
              className="rounded-lg" placeholder="e.g. Block A · Unit 4" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-type">House type</Label>
            <select id="h-type" value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitType | "")}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
              <option value="">Unspecified</option>
              {UNIT_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>{UNIT_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-rent">Monthly rent (KES)</Label>
            <Input id="h-rent" type="number" min={0} value={rent} onChange={(e) => setRent(e.target.value)}
              className="rounded-lg tabular-nums" placeholder="Defaults to building rent if empty" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-desc">Note</Label>
            <textarea id="h-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="Access notes, meter location…" />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-2">
          {editing ? (
            <Button type="button" variant="destructive" size="sm" className="gap-1.5 rounded-full" disabled={busy} onClick={remove}>
              <Trash2 className="size-3.5" aria-hidden /> Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={save}
              className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]">
              {editing ? "Save" : "Add house"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
