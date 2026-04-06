"use client";

import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Droplets,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOCK_LANDLORDS, MOCK_TENANTS } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

export function CreateTenantView() {
  const router = useRouter();
  const [landlordMenuOpen, setLandlordMenuOpen] = useState(false);
  const [landlordQuery, setLandlordQuery] = useState("");
  const [landlordId, setLandlordId] = useState("");
  const landlordMenuRef = useRef<HTMLDivElement>(null);

  const [tenantType, setTenantType] = useState<"individual" | "corporate">(
    "individual"
  );
  const [billingModel, setBillingModel] = useState<"prepaid_sts" | "postpaid">(
    "prepaid_sts"
  );
  const [initialStatus, setInitialStatus] = useState<
    "active" | "pending" | "inactive"
  >("pending");

  const buildingOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of MOCK_TENANTS) set.add(t.property);
    return Array.from(set).sort();
  }, []);

  const landlordsFiltered = useMemo(() => {
    const q = landlordQuery.trim().toLowerCase();
    return MOCK_LANDLORDS.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    );
  }, [landlordQuery]);

  const selectedLandlord = MOCK_LANDLORDS.find((l) => l.id === landlordId);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        landlordMenuRef.current &&
        !landlordMenuRef.current.contains(e.target as Node)
      ) {
        setLandlordMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!landlordId) {
      setLandlordMenuOpen(true);
      return;
    }
    router.push("/dashboard/tenants");
  }

  return (
    <div className=" space-y-8 pb-10">
      <header className="space-y-4  border-b border-border pb-6 dark:border-border/80">
        <div className="flex mx-auto max-w-4xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
              Create tenant
            </h1>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                Enter tenant contact details and lease dates for the water
                account.
              </li>
              <li>
                Assign a landlord, building, and STS smart meter (prepaid/postpaid
                per your billing model).
              </li>
              <li>
                Review and submit — the tenant will appear in the directory for
                vending and M-Pesa payments.
              </li>
            </ol>
          </div>
          <div
            className=""
            aria-hidden
          >
            <div className="flex items-end gap-3">
              <img src="/img/create-user.png" alt="Tenant icon" className="w-full lg:h-40 dark:invert object-cover" />
            </div>
          </div>
        </div>
      </header>

      <div className="rounded-xl mx-auto max-w-3xl  bg-card p-6  md:p-8 dark:border-border/80">
        <Link
          href="/dashboard/tenants"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-4 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h2 className="text-center text-xl font-semibold text-foreground">
          Create tenant
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Fields marked with an asterisk are required.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          <FieldGroup className="gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground">
                  Full name
                  <RequiredMark />
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  placeholder="e.g. Mary Wanjiku"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">
                  Phone number
                  <RequiredMark />
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+254 7xx xxx xxx"
                  className="h-11 rounded-lg"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                  <RequiredMark />
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="tenant@email.com"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meterId" className="text-foreground">
                  Water meter (optional)
                </Label>
                <Input
                  id="meterId"
                  name="meterId"
                  placeholder="e.g. 0159000000640"
                  className="h-11 rounded-lg font-mono text-sm"
                />
                <FieldDescription>
                  You can assign a smart water meter now or add it later from meter management.
                </FieldDescription>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leaseStart" className="text-foreground">
                  Lease start date
                  <RequiredMark />
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="leaseStart"
                    name="leaseStart"
                    type="date"
                    required
                    className="h-11 rounded-lg pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaseEnd" className="text-foreground">
                  Lease end date
                  <RequiredMark />
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="leaseEnd"
                    name="leaseEnd"
                    type="date"
                    required
                    className="h-11 rounded-lg pl-10"
                  />
                </div>
              </div>
            </div>

            <div ref={landlordMenuRef} className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Landlord / property manager
                <RequiredMark />
              </span>
              <button
                type="button"
                onClick={() => {
                  setLandlordMenuOpen((o) => !o);
                  if (!landlordMenuOpen) setLandlordQuery("");
                }}
                className={DROPDOWN_TRIGGER}
                aria-expanded={landlordMenuOpen}
                aria-haspopup="listbox"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <UserRound className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">
                    {selectedLandlord
                      ? `${selectedLandlord.name} — ${selectedLandlord.company}`
                      : "Select a landlord"}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    landlordMenuOpen && "rotate-180"
                  )}
                />
              </button>
              <input type="hidden" name="landlordId" value={landlordId} />
              {landlordMenuOpen && (
                <div className="relative z-20 overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <div className="border-b border-border p-2 dark:border-border/80">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search landlords..."
                        value={landlordQuery}
                        onChange={(e) => setLandlordQuery(e.target.value)}
                        className="h-9 rounded-lg pl-8 text-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                  <ul className="max-h-52 overflow-y-auto p-1">
                    {landlordsFiltered.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted",
                            landlordId === l.id && "bg-muted/80"
                          )}
                          onClick={() => {
                            setLandlordId(l.id);
                            setLandlordMenuOpen(false);
                            setLandlordQuery("");
                          }}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            {landlordId === l.id && (
                              <Check className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />
                            )}
                            <span className={cn(landlordId !== l.id && "pl-6")}>
                              {l.name}
                            </span>
                          </span>
                          <span className="pl-6 text-xs text-muted-foreground">
                            {l.company}
                          </span>
                        </button>
                      </li>
                    ))}
                    {landlordsFiltered.length === 0 && (
                      <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No landlords match.
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="building" className="text-foreground">
                  Building / property
                  <RequiredMark />
                </Label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    id="building"
                    name="building"
                    required
                    defaultValue=""
                    className="h-11 w-full appearance-none rounded-lg border border-border bg-background py-2 pl-10 pr-10 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
                  >
                    <option value="" disabled>
                      Select a building
                    </option>
                    {buildingOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-foreground">
                  Unit / house
                  <RequiredMark />
                </Label>
                <Input
                  id="unit"
                  name="unit"
                  required
                  placeholder="e.g. Block A · Unit 12"
                  className="h-11 rounded-lg"
                />
              </div>
            </div>

            <fieldset className="space-y-3">
              <FieldTitle className="text-foreground">
                Tenant type
                <RequiredMark />
              </FieldTitle>
              <div className="flex flex-col gap-3">
                {(
                  [
                    { value: "individual" as const, label: "Individual" },
                    { value: "corporate" as const, label: "Corporate" },
                  ] as const
                ).map(({ value, label }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm transition-colors dark:border-border/80",
                      tenantType === value
                        ? "border-[#0A4266] bg-[#0A4266]/5 dark:border-[#6BB4E8] dark:bg-[#6BB4E8]/10"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="tenantType"
                      value={value}
                      checked={tenantType === value}
                      onChange={() => setTenantType(value)}
                      className="size-4 accent-[#0A4266] dark:accent-[#6BB4E8]"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <FieldTitle className="text-foreground">
                Billing model
                <RequiredMark />
              </FieldTitle>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    {
                      value: "prepaid_sts" as const,
                      label: "Prepaid (STS)",
                    },
                    { value: "postpaid" as const, label: "Postpaid" },
                  ] as const
                ).map(({ value, label }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                      billingModel === value
                        ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="billingModel"
                      value={value}
                      checked={billingModel === value}
                      onChange={() => setBillingModel(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <FieldDescription>
                Prepaid uses STS tokens (LONGi vending API); postpaid supports
                M-Pesa and invoicing.
              </FieldDescription>
            </fieldset>

            <fieldset className="space-y-3">
              <FieldTitle className="text-foreground">
                Initial account status
                <RequiredMark />
              </FieldTitle>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    { value: "pending" as const, label: "Pending onboarding" },
                    { value: "active" as const, label: "Active" },
                    { value: "inactive" as const, label: "Inactive" },
                  ] as const
                ).map(({ value, label }) => (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors dark:border-border/80",
                      initialStatus === value
                        ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <input
                      type="radio"
                      name="initialStatus"
                      value={value}
                      checked={initialStatus === value}
                      onChange={() => setInitialStatus(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-foreground">
                Additional notes{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Access instructions, special metering notes, or billing agreements…"
                className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
              />
              <FieldDescription>
                Optional: share requirements for leak alerts, low-balance SMS, or
                landlord payout rules.
              </FieldDescription>
            </div>
          </FieldGroup>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end dark:border-border/80">
            <Link
              href="/dashboard/tenants"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex h-11 items-center justify-center rounded-full px-6 sm:min-w-[120px]"
              )}
            >
              Cancel
            </Link>
            <Button
              type="submit"
              className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            >
              Create tenant
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
