"use client";

import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuildingListRow } from "@/lib/buildings-data";
import { updateLandlordBuildingCaretaker } from "@/lib/landlord-portfolio-storage";

export function LandlordCaretakerModal({
  open,
  onClose,
  building,
  landlordId,
}: {
  open: boolean;
  onClose: () => void;
  building: BuildingListRow;
  landlordId: string;
}) {
  const [name, setName] = useState(building.caretakerName);
  const [phone, setPhone] = useState(building.caretakerPhone);

  useEffect(() => {
    if (open) {
      setName(building.caretakerName);
      setPhone(building.caretakerPhone);
    }
  }, [open, building.caretakerName, building.caretakerPhone]);

  if (!open) return null;

  function save() {
    const n = name.trim();
    const p = phone.trim();
    if (!n) {
      toast.error("Enter a caretaker or site manager name.");
      return;
    }
    updateLandlordBuildingCaretaker(landlordId, building.id, n, p);
    toast.success("Caretaker updated");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
          <UserRound className="size-6" />
          <h2 className="text-lg font-semibold text-foreground">Caretaker / site manager</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {building.name} — shown on the building detail card and used for field contact in demo workflows.
        </p>
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ct-name">Full name</Label>
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-full"
              placeholder="e.g. John Mwangi"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-phone">Phone</Label>
            <Input
              id="ct-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-full font-mono text-sm"
              placeholder="+254 7…"
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
