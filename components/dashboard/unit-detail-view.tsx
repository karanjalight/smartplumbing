"use client";

import {
  ArrowLeft, Building2, Droplets, ImagePlus, Loader2, Pencil, Trash2, UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { HouseDialog } from "@/components/dashboard/house-dialog";
import { UnitPricingConfig } from "@/components/dashboard/unit-pricing-config";
import { Button } from "@/components/ui/button";
import type { HouseUnitRow } from "@/lib/buildings-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UnitDetail } from "@/lib/units/queries";
import { unitPhotoUrl, unitTypeLabel } from "@/lib/units/labels";
import { cn } from "@/lib/utils";

function kes(value: number | null): string {
  return value != null && value > 0 ? `KES ${value.toLocaleString("en-KE")}` : "—";
}

export function UnitDetailView({
  detail, portal = "admin",
}: {
  detail: UnitDetail;
  portal?: "admin" | "landlord";
}) {
  const router = useRouter();
  const { unit, building, landlordName, tenant, meterNo, images } = detail;
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const base = portal === "landlord" ? "/landlords/dashboard" : "/dashboard";
  const rentValue = unit.rent_kes ?? building?.rent_kes ?? null;

  const houseForDialog: HouseUnitRow = {
    id: unit.id,
    buildingId: unit.building_id,
    label: unit.label,
    description: unit.description,
    rentKes: unit.rent_kes,
    unitType: unit.unit_type,
    meterId: meterNo,
    tenantId: tenant?.id ?? null,
    tenantName: tenant?.full_name ?? null,
  };

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const supabase = getSupabaseBrowserClient();
    setUploading(true);
    let sort = images.length;
    for (const file of Array.from(files)) {
      const safe = file.name.replace(/[^\w.-]/g, "_");
      const path = `${unit.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("unit-photos").upload(path, file, { upsert: false });
      if (upErr) { toast.error(upErr.message); continue; }
      const { error: insErr } = await supabase
        .from("unit_images").insert({ unit_id: unit.id, path, sort_order: sort++ });
      if (insErr) toast.error(insErr.message);
    }
    setUploading(false);
    toast.success("Photos uploaded");
    router.refresh();
  }

  async function removeImage(id: string, path: string) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("unit_images").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from("unit-photos").remove([path]);
    toast.success("Photo removed");
    router.refresh();
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={building ? `${base}/buildings/${building.id}` : `${base}/buildings`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {building ? building.name : "Buildings"}
        </Link>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => setEditOpen(true)}>
          <Pencil className="size-3.5" aria-hidden /> Edit house
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{unit.label}</h1>
        {unit.unit_type && (
          <span className="rounded-full bg-[#0A4266]/10 px-3 py-1 text-xs font-semibold text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
            {unitTypeLabel(unit.unit_type)}
          </span>
        )}
        <span className={cn(
          "rounded-full px-3 py-1 text-xs font-medium",
          unit.is_vacant
            ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
        )}>
          {unit.is_vacant ? "Vacant" : "Occupied"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Details */}
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <dl className="divide-y divide-border/60 text-sm">
              {[
                ["Type", unitTypeLabel(unit.unit_type)],
                ["Rent / month", kes(rentValue)],
                ["Status", unit.is_vacant ? "Vacant" : "Occupied"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Building</dt>
                <dd className="text-right font-medium">
                  {building ? (
                    <Link href={`${base}/buildings/${building.id}`} className="text-[#0A4266] hover:underline dark:text-[#6BB4E8]">
                      {building.name}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground">Landlord</dt>
                <dd className="font-medium text-foreground">{landlordName ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <UserRound className="size-3.5" aria-hidden /> Tenant
                </dt>
                <dd className="text-right font-medium">
                  {tenant ? (
                    <Link href={`${base}/tenants/${tenant.id}`} className="text-[#0A4266] hover:underline dark:text-[#6BB4E8]">
                      {tenant.full_name}
                    </Link>
                  ) : <span className="text-muted-foreground">Vacant</span>}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Droplets className="size-3.5" aria-hidden /> Meter
                </dt>
                <dd className="font-mono text-xs font-medium text-foreground">{meterNo ?? "—"}</dd>
              </div>
            </dl>
            {unit.description && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {unit.description}
              </p>
            )}
          </div>

          <UnitPricingConfig
            unitId={unit.id}
            initial={{
              rentKes: unit.rent_kes,
              rentDepositKes: unit.rent_deposit_kes,
              waterMeterDepositKes: unit.water_meter_deposit_kes,
              electricityMeterDepositKes: unit.electricity_meter_deposit_kes,
            }}
          />
        </div>

        {/* Photos */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">Photos</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-4/3 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={unitPhotoUrl(img.path)} alt={unit.label} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id, img.path)}
                    aria-label="Remove photo"
                    className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              <label className="flex aspect-4/3 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-[#0A4266] hover:text-[#0A4266] dark:hover:border-[#6BB4E8] dark:hover:text-[#6BB4E8]">
                {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
                <span className="text-xs font-medium">{uploading ? "Uploading…" : "Add photos"}</span>
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
                  onChange={(e) => onUpload(e.target.files)} />
              </label>
            </div>
            {images.length === 0 && !uploading && (
              <p className="mt-3 text-xs text-muted-foreground">
                No photos yet — add interior/exterior shots to help list this house.
              </p>
            )}
          </div>
        </div>
      </div>

      <HouseDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        buildingId={unit.building_id}
        house={houseForDialog}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
