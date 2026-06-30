"use client";

import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateBuilding } from "@/app/(dashboard)/dashboard/buildings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  buildingId: string;
  onSaved: () => void;
};

const FIELD = "rounded-lg";

export function BuildingEditDialog({ open, onClose, buildingId, onSaved }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [caretakerName, setCaretakerName] = useState("");
  const [caretakerPhone, setCaretakerPhone] = useState("");
  const [rentKes, setRentKes] = useState("");
  const [feePct, setFeePct] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    // Load the building's current values each time the dialog opens.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoaded(false);
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) { setLoaded(true); return; }
    supabase
      .from("buildings")
      .select("name, address_line, city, region, caretaker_name, caretaker_phone, rent_kes, management_fee_pct, notes")
      .eq("id", buildingId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.name ?? "");
          setAddressLine(data.address_line ?? "");
          setCity(data.city ?? "");
          setRegion(data.region ?? "");
          setCaretakerName(data.caretaker_name ?? "");
          setCaretakerPhone(data.caretaker_phone ?? "");
          setRentKes(data.rent_kes != null ? String(data.rent_kes) : "");
          setFeePct(data.management_fee_pct != null ? String(data.management_fee_pct) : "");
          setNotes(data.notes ?? "");
        }
        setLoaded(true);
      });
  }, [open, buildingId]);

  if (!open) return null;

  async function save() {
    if (!name.trim()) { toast.error("Building name is required."); return; }
    setBusy(true);
    const res = await updateBuilding({
      buildingId,
      name,
      addressLine: addressLine || null,
      city: city || null,
      region: region || null,
      caretakerName: caretakerName || null,
      caretakerPhone: caretakerPhone || null,
      notes: notes || null,
      rentKes: rentKes.trim() === "" ? undefined : Number(rentKes),
      managementFeePct: feePct.trim() === "" ? null : Number(feePct),
    });
    setBusy(false);
    if (res.ok) { toast.success("Building updated"); onSaved(); onClose(); }
    else toast.error(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div role="dialog" aria-modal
        className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80">
        <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
          <Building2 className="size-6" />
          <h2 className="text-lg font-semibold text-foreground">Edit building</h2>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Building name *</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} disabled={!loaded} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-addr">Address</Label>
            <Input id="b-addr" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={FIELD} disabled={!loaded} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-city">City / town</Label>
              <Input id="b-city" value={city} onChange={(e) => setCity(e.target.value)} className={FIELD} disabled={!loaded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-region">Region / county</Label>
              <Input id="b-region" value={region} onChange={(e) => setRegion(e.target.value)} className={FIELD} disabled={!loaded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-ctn">Caretaker name</Label>
              <Input id="b-ctn" value={caretakerName} onChange={(e) => setCaretakerName(e.target.value)} className={FIELD} disabled={!loaded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-ctp">Caretaker phone</Label>
              <Input id="b-ctp" value={caretakerPhone} onChange={(e) => setCaretakerPhone(e.target.value)} className={FIELD} disabled={!loaded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-rent">Building rent (KES)</Label>
              <Input id="b-rent" type="number" min={0} value={rentKes} onChange={(e) => setRentKes(e.target.value)} className={FIELD} disabled={!loaded} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-fee">Management fee (%)</Label>
              <Input id="b-fee" type="number" min={0} max={100} value={feePct} onChange={(e) => setFeePct(e.target.value)} className={FIELD} disabled={!loaded} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-notes">Notes</Label>
            <textarea id="b-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={!loaded}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={busy || !loaded} onClick={save}
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
