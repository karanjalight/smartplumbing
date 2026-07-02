"use client";

import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Gauge,
  KeyRound,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { createTenantAccount } from "@/app/(dashboard)/dashboard/tenants/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchBuildingsByLandlordId,
  fetchHousesForBuilding,
  getBuildingsByLandlordId,
  getHousesForBuilding,
  type BuildingListRow,
  type HouseUnitRow,
} from "@/lib/buildings-data";
import type { SignedInLandlord } from "@/lib/landlord-session";
import {
  fetchAdminMetersForTenantPicker,
  formatMeterPickerLabel,
  getAdminMetersForTenantPicker,
  type MeterRow,
} from "@/lib/meters-data";
import {
  fetchLandlordsForTenantFilter,
  getLandlordsForTenantFilter,
  type Landlord,
  type TenantStatus,
} from "@/lib/tenants-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  downloadTenantCredentialsPdf,
  generateReadablePassword,
} from "@/lib/tenant-credentials-pdf";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

function mapInitialStatusToTenantStatus(
  s: "pending" | "active" | "inactive"
): TenantStatus {
  if (s === "pending") return "inactive";
  return s;
}

function resolveMeterSerial(
  selectedMeterId: string,
  house: HouseUnitRow | undefined,
  allowPlaceholder = false
): string {
  const picked = selectedMeterId.trim();
  if (picked) return picked;
  const fromUnit = house?.meterId?.trim();
  if (fromUnit && fromUnit !== "—") return fromUnit;
  return allowPlaceholder ? `pending-${Date.now()}` : "";
}

export type CreateTenantViewProps = {
  portal?: "admin" | "landlord";
  /** @deprecated Prefer `sessionLandlord` (signed-in landlord UUID). */
  landlordId?: string;
  /** Signed-in landlord from Supabase — pre-fills step 2 and scopes buildings/units. */
  sessionLandlord?: SignedInLandlord | null;
  /** Pre-select building (e.g. from building detail → Add tenant). */
  initialBuildingId?: string;
  /** Pre-select unit when `initialBuildingId` is set. */
  initialUnitId?: string;
  /** Admin only: pre-select the landlord (e.g. from the admin onboarding flow). */
  initialLandlordId?: string;
  /**
   * Optional post-create destination for guided flows (e.g. onboarding).
   * Falls back to the tenant detail page when omitted.
   */
  successHref?: string;
};

export function CreateTenantView({
  portal = "admin",
  landlordId: portalLandlordId,
  sessionLandlord = null,
  initialBuildingId,
  initialUnitId,
  initialLandlordId,
  successHref,
}: CreateTenantViewProps = {}) {
  const router = useRouter();
  const isLandlordPortal = portal === "landlord";
  const fixedLandlordId = isLandlordPortal
    ? (sessionLandlord?.id ?? portalLandlordId ?? "")
    : "";
  const tenantsListHref = isLandlordPortal
    ? "/landlords/dashboard/tenants"
    : "/dashboard/tenants";

  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [secondaryPhones, setSecondaryPhones] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [kraPin, setKraPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");
  const [depositAmountPaid, setDepositAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMeterId, setSelectedMeterId] = useState("");
  const [meterOverride, setMeterOverride] = useState(false);

  const [landlordMenuOpen, setLandlordMenuOpen] = useState(false);
  const [landlordQuery, setLandlordQuery] = useState("");
  const [adminLandlordId, setAdminLandlordId] = useState("");
  const landlordMenuRef = useRef<HTMLDivElement>(null);

  const [userBuildingId, setUserBuildingId] = useState("");
  const [houseUnitId, setHouseUnitId] = useState("");
  const [landlordUnitFree, setLandlordUnitFree] = useState("");

  const [adminUserBuildingId, setAdminUserBuildingId] = useState("");
  const [adminHouseUnitId, setAdminHouseUnitId] = useState("");

  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [landlordsLoading, setLandlordsLoading] = useState(true);
  const [adminBuildings, setAdminBuildings] = useState<BuildingListRow[]>([]);
  const [adminBuildingsLoading, setAdminBuildingsLoading] = useState(false);
  const [adminHouses, setAdminHouses] = useState<HouseUnitRow[]>([]);
  const [adminHousesLoading, setAdminHousesLoading] = useState(false);
  const [adminMeterRows, setAdminMeterRows] = useState<MeterRow[]>([]);
  const [metersLoading, setMetersLoading] = useState(false);
  const [landlordLiveBuildings, setLandlordLiveBuildings] = useState<
    BuildingListRow[]
  >([]);
  const [landlordLiveHouses, setLandlordLiveHouses] = useState<HouseUnitRow[]>(
    []
  );
  const [landlordLiveMeters, setLandlordLiveMeters] = useState<MeterRow[]>([]);
  const [landlordPortfolioLoading, setLandlordPortfolioLoading] = useState(
    isLandlordPortal
  );

  const [tenantType, setTenantType] = useState<"individual" | "corporate">(
    "individual"
  );
  const [billingModel, setBillingModel] = useState<"prepaid_sts" | "postpaid">(
    "prepaid_sts"
  );
  const [initialStatus, setInitialStatus] = useState<
    "active" | "pending" | "inactive"
  >("pending");

  const landlordId = isLandlordPortal ? fixedLandlordId : adminLandlordId;

  const supabaseConfigured = Boolean(tryGetSupabaseBrowserClient());

  const buildings = useMemo(() => {
    if (!isLandlordPortal || !fixedLandlordId) return [];
    return landlordLiveBuildings;
  }, [isLandlordPortal, fixedLandlordId, landlordLiveBuildings]);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === userBuildingId),
    [buildings, userBuildingId]
  );

  const housesForBuilding = useMemo(() => {
    if (!selectedBuilding || !isLandlordPortal) return [];
    return landlordLiveHouses;
  }, [selectedBuilding, isLandlordPortal, landlordLiveHouses]);

  const vacantHousesForBuilding = useMemo(
    () => housesForBuilding.filter((h) => !h.tenantId),
    [housesForBuilding]
  );

  const selectedAdminBuilding = useMemo(
    () => adminBuildings.find((b) => b.id === adminUserBuildingId),
    [adminBuildings, adminUserBuildingId]
  );

  const selectedUnit = useMemo(() => {
    if (isLandlordPortal) {
      return housesForBuilding.find((h) => h.id === houseUnitId);
    }
    return adminHouses.find((h) => h.id === adminHouseUnitId);
  }, [
    isLandlordPortal,
    housesForBuilding,
    houseUnitId,
    adminHouses,
    adminHouseUnitId,
  ]);

  const unitMeterSerial = useMemo(() => {
    const raw = selectedUnit?.meterId?.trim();
    if (!raw || raw === "—") return null;
    return raw;
  }, [selectedUnit]);

  const meterPickerRows = useMemo((): MeterRow[] => {
    if (isLandlordPortal) return landlordLiveMeters;
    return adminMeterRows;
  }, [isLandlordPortal, adminMeterRows, landlordLiveMeters]);

  const landlordsFiltered = useMemo(() => {
    const q = landlordQuery.trim().toLowerCase();
    return landlords.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    );
  }, [landlords, landlordQuery]);

  const selectedLandlord = isLandlordPortal
    ? sessionLandlord
    : landlords.find((l) => l.id === landlordId);

  useEffect(() => {
    if (isLandlordPortal) {
      if (sessionLandlord) {
        setLandlords([sessionLandlord]);
      }
      setLandlordsLoading(false);
      return;
    }
    let cancelled = false;
    async function loadLandlords() {
      setLandlordsLoading(true);
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setLandlords(getLandlordsForTenantFilter());
          setLandlordsLoading(false);
        }
        return;
      }
      try {
        const rows = await fetchLandlordsForTenantFilter(supabase);
        if (!cancelled) setLandlords(rows);
      } catch {
        if (!cancelled) setLandlords(getLandlordsForTenantFilter());
      } finally {
        if (!cancelled) setLandlordsLoading(false);
      }
    }
    void loadLandlords();
    return () => {
      cancelled = true;
    };
  }, [isLandlordPortal, sessionLandlord]);

  useEffect(() => {
    if (isLandlordPortal || !adminLandlordId) {
      setAdminBuildings([]);
      setAdminBuildingsLoading(false);
      return;
    }
    let cancelled = false;
    async function loadBuildings() {
      setAdminBuildingsLoading(true);
      const supabase = tryGetSupabaseBrowserClient();
      const ll = landlords.find((l) => l.id === adminLandlordId);
      if (!supabase) {
        if (!cancelled) {
          setAdminBuildings(getBuildingsByLandlordId(adminLandlordId));
          setAdminBuildingsLoading(false);
        }
        return;
      }
      try {
        const rows = await fetchBuildingsByLandlordId(
          supabase,
          adminLandlordId,
          ll ? { company: ll.company, full_name: ll.name } : null
        );
        if (!cancelled) setAdminBuildings(rows);
      } catch {
        if (!cancelled) {
          setAdminBuildings(getBuildingsByLandlordId(adminLandlordId));
        }
      } finally {
        if (!cancelled) setAdminBuildingsLoading(false);
      }
    }
    void loadBuildings();
    return () => {
      cancelled = true;
    };
  }, [adminLandlordId, isLandlordPortal, landlords]);

  useEffect(() => {
    if (isLandlordPortal || !adminUserBuildingId) {
      setAdminHouses([]);
      setAdminHousesLoading(false);
      return;
    }
    let cancelled = false;
    async function loadHouses() {
      setAdminHousesLoading(true);
      const supabase = tryGetSupabaseBrowserClient();
      const building = adminBuildings.find((b) => b.id === adminUserBuildingId);
      if (!supabase || !building) {
        if (!cancelled) {
          setAdminHouses(
            building ? getHousesForBuilding(building) : []
          );
          setAdminHousesLoading(false);
        }
        return;
      }
      try {
        const rows = await fetchHousesForBuilding(supabase, adminUserBuildingId);
        if (!cancelled) setAdminHouses(rows);
      } catch {
        if (!cancelled) {
          setAdminHouses(getHousesForBuilding(building));
        }
      } finally {
        if (!cancelled) setAdminHousesLoading(false);
      }
    }
    void loadHouses();
    return () => {
      cancelled = true;
    };
  }, [adminUserBuildingId, adminBuildings, isLandlordPortal]);

  // Admin (onboarding) pre-selection: landlord → building → unit, each applied
  // once as its options load. Mirrors the landlord-portal pre-select effects.
  useEffect(() => {
    if (isLandlordPortal || adminLandlordId) return;
    const preferred = initialLandlordId?.trim();
    if (!preferred || landlords.length === 0) return;
    if (landlords.some((l) => l.id === preferred)) {
      setAdminLandlordId(preferred);
    }
  }, [isLandlordPortal, initialLandlordId, landlords, adminLandlordId]);

  useEffect(() => {
    if (isLandlordPortal || adminUserBuildingId) return;
    const preferred = initialBuildingId?.trim();
    if (!preferred || adminBuildings.length === 0) return;
    if (adminBuildings.some((b) => b.id === preferred)) {
      setAdminUserBuildingId(preferred);
    }
  }, [isLandlordPortal, initialBuildingId, adminBuildings, adminUserBuildingId]);

  useEffect(() => {
    if (isLandlordPortal || adminHouseUnitId) return;
    const preferred = initialUnitId?.trim();
    if (!preferred || adminHouses.length === 0) return;
    if (adminHouses.some((h) => h.id === preferred)) {
      setAdminHouseUnitId(preferred);
    }
  }, [isLandlordPortal, initialUnitId, adminHouses, adminHouseUnitId]);

  useEffect(() => {
    if (!isLandlordPortal || !fixedLandlordId) {
      setLandlordLiveBuildings([]);
      setLandlordPortfolioLoading(false);
      return;
    }
    let cancelled = false;
    async function loadLandlordBuildings() {
      setLandlordPortfolioLoading(true);
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setLandlordLiveBuildings([]);
          setLandlordPortfolioLoading(false);
        }
        return;
      }
      try {
        const rows = await fetchBuildingsByLandlordId(supabase, fixedLandlordId);
        if (!cancelled) setLandlordLiveBuildings(rows);
      } catch {
        if (!cancelled) setLandlordLiveBuildings([]);
      } finally {
        if (!cancelled) setLandlordPortfolioLoading(false);
      }
    }
    void loadLandlordBuildings();
    return () => {
      cancelled = true;
    };
  }, [isLandlordPortal, fixedLandlordId]);

  useEffect(() => {
    if (!isLandlordPortal || landlordLiveBuildings.length === 0) return;
    const preferred = initialBuildingId?.trim();
    const validPreferred =
      preferred && landlordLiveBuildings.some((b) => b.id === preferred)
        ? preferred
        : null;
    const nextId =
      validPreferred ??
      (landlordLiveBuildings.length === 1 ? landlordLiveBuildings[0].id : "");
    if (nextId && nextId !== userBuildingId) {
      setUserBuildingId(nextId);
    }
  }, [isLandlordPortal, landlordLiveBuildings, initialBuildingId, userBuildingId]);

  useEffect(() => {
    if (!isLandlordPortal || !userBuildingId) {
      setLandlordLiveHouses([]);
      return;
    }
    let cancelled = false;
    async function loadLandlordHouses() {
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) setLandlordLiveHouses([]);
        return;
      }
      try {
        const rows = await fetchHousesForBuilding(supabase, userBuildingId);
        if (!cancelled) setLandlordLiveHouses(rows);
      } catch {
        if (!cancelled) setLandlordLiveHouses([]);
      }
    }
    void loadLandlordHouses();
    return () => {
      cancelled = true;
    };
  }, [isLandlordPortal, userBuildingId]);

  useEffect(() => {
    if (!isLandlordPortal || vacantHousesForBuilding.length === 0) return;
    const preferred = initialUnitId?.trim();
    const validPreferred =
      preferred && vacantHousesForBuilding.some((h) => h.id === preferred)
        ? preferred
        : null;
    const nextId =
      validPreferred ??
      (vacantHousesForBuilding.length === 1
        ? vacantHousesForBuilding[0].id
        : "");
    if (nextId && nextId !== houseUnitId) {
      setHouseUnitId(nextId);
    }
  }, [
    isLandlordPortal,
    vacantHousesForBuilding,
    initialUnitId,
    houseUnitId,
  ]);

  useEffect(() => {
    if (!isLandlordPortal || !fixedLandlordId) {
      setLandlordLiveMeters([]);
      return;
    }
    let cancelled = false;
    async function loadLandlordMeters() {
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) setLandlordLiveMeters([]);
        return;
      }
      try {
        const rows = await fetchAdminMetersForTenantPicker(
          supabase,
          fixedLandlordId
        );
        if (!cancelled) setLandlordLiveMeters(rows);
      } catch {
        if (!cancelled) setLandlordLiveMeters([]);
      }
    }
    void loadLandlordMeters();
    return () => {
      cancelled = true;
    };
  }, [isLandlordPortal, fixedLandlordId]);

  useEffect(() => {
    if (isLandlordPortal) return;
    let cancelled = false;
    async function loadMeters() {
      setMetersLoading(true);
      const supabase = tryGetSupabaseBrowserClient();
      if (!supabase) {
        if (!cancelled) {
          setAdminMeterRows(getAdminMetersForTenantPicker());
          setMetersLoading(false);
        }
        return;
      }
      try {
        const rows = await fetchAdminMetersForTenantPicker(
          supabase,
          adminLandlordId || null,
        );
        if (!cancelled) setAdminMeterRows(rows);
      } catch {
        if (!cancelled) {
          setAdminMeterRows(getAdminMetersForTenantPicker());
        }
      } finally {
        if (!cancelled) setMetersLoading(false);
      }
    }
    void loadMeters();
    return () => {
      cancelled = true;
    };
  }, [adminLandlordId, isLandlordPortal]);

  useEffect(() => {
    if (unitMeterSerial) {
      setSelectedMeterId(unitMeterSerial);
      setMeterOverride(false);
    }
  }, [unitMeterSerial, selectedUnit?.id]);

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

  const selectClass =
    "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80";

  function issuePdf(opts: {
    tenantName: string;
    tenantEmail: string;
    tenantId?: string;
    passwordPlain: string;
    propertyLabel: string;
    unitLabel: string;
    leaseStart: string;
    waterMeterId?: string;
  }) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const signInUrl = origin ? `${origin}/` : "Your Mali Smart home / sign-in URL";
    const ll = landlords.find((l) => l.id === landlordId);
    downloadTenantCredentialsPdf({
      tenantName: opts.tenantName,
      tenantEmail: opts.tenantEmail,
      tenantId: opts.tenantId,
      signInUrl,
      password: opts.passwordPlain,
      landlordName: ll?.name ?? "—",
      landlordCompany: ll?.company ?? "—",
      propertyLabel: opts.propertyLabel,
      unitLabel: opts.unitLabel,
      leaseStart: opts.leaseStart,
      billingModel:
        billingModel === "prepaid_sts" ? "Prepaid (STS)" : "Postpaid",
      tenantType: tenantType === "individual" ? "Individual" : "Corporate",
      waterMeterId: opts.waterMeterId,
    });
  }

  function goStep1() {
    setWizardStep(1);
  }

  function continueToStep2() {
    const fn = fullName.trim();
    if (!fn) {
      toast.error("Full name is required.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone number is required.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setWizardStep(2);
  }

  async function finalizeTenant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!landlordId) {
      if (!isLandlordPortal) setLandlordMenuOpen(true);
      toast.error("Select a landlord.");
      return;
    }
    if (password.length < 8 || password !== confirmPassword) {
      toast.error("Password issue — go back to step 1.");
      goStep1();
      return;
    }
    if (!leaseStart.trim()) {
      toast.error("Lease start date is required.");
      return;
    }

    if (isLandlordPortal) {
      if (!sessionLandlord || !fixedLandlordId) {
        toast.error("Your landlord account could not be loaded. Sign in again.");
        return;
      }
      if (!supabaseConfigured) {
        toast.error("Supabase must be configured to create tenants.");
        return;
      }
      if (!userBuildingId.trim()) {
        toast.error("Select a building for this tenant.");
        return;
      }
      if (!houseUnitId.trim()) {
        toast.error("Select a unit in that building.");
        return;
      }

      const house = housesForBuilding.find((h) => h.id === houseUnitId);
      const unitLabel = house?.label.trim() || "—";
      const propertyLabel = selectedBuilding?.name ?? "—";
      const hid = houseUnitId.trim();
      const resolvedMeterNo =
        unitMeterSerial && !meterOverride
          ? unitMeterSerial
          : selectedMeterId.trim() || unitMeterSerial || "";
      const meterNoForApi = resolvedMeterNo || undefined;
      const displayMeterId =
        resolveMeterSerial(resolvedMeterNo, house) || undefined;

      if (house?.tenantId) {
        toast.error(
          `That unit is already linked to tenant ${house.tenantName ?? house.tenantId}.`
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const result = await createTenantAccount({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          landlordId: fixedLandlordId,
          buildingId: userBuildingId,
          unitId: hid,
          meterNo: meterNoForApi,
          leaseStart,
          leaseEnd: leaseEnd.trim() || undefined,
          nationalId: nationalId.trim() || undefined,
          kraPin: kraPin.trim() || undefined,
          depositAmountPaid: depositAmountPaid.trim()
            ? Number.parseFloat(depositAmountPaid)
            : undefined,
          secondaryPhones: secondaryPhones.trim() || undefined,
          billingModel,
          initialStatus,
          tenantType,
          notes: notes.trim() || undefined,
        });

        if (!result.ok) {
          setFormError(result.error);
          toast.error(result.error);
          return;
        }

        issuePdf({
          tenantName: fullName.trim(),
          tenantEmail: email.trim() || "—",
          tenantId: result.tenantCode,
          passwordPlain: password,
          propertyLabel,
          unitLabel,
          leaseStart,
          waterMeterId: meterNoForApi ?? displayMeterId,
        });
        toast.success("Tenant created. Credentials PDF downloaded.");
        router.push(
          successHref ??
            `/landlords/dashboard/tenants/${encodeURIComponent(result.tenantId)}`
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!adminLandlordId) {
      toast.error("Select a landlord.");
      return;
    }
    const adminHouse = adminHouses.find((h) => h.id === adminHouseUnitId);
    const unitLabel =
      adminHouse?.label.trim() || landlordUnitFree.trim() || "—";
    if (adminHouse?.tenantId) {
      toast.error(
        `That unit is already linked to tenant ${adminHouse.tenantName ?? adminHouse.tenantId}.`
      );
      return;
    }

    const propertyLabel = selectedAdminBuilding?.name ?? "—";
    const resolvedMeterNo =
      unitMeterSerial && !meterOverride
        ? unitMeterSerial
        : selectedMeterId.trim() || unitMeterSerial || "";
    const meterNoForApi = resolvedMeterNo || undefined;
    const adminMeterId = resolveMeterSerial(resolvedMeterNo, adminHouse);

    setIsSubmitting(true);
    try {
      const result = await createTenantAccount({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        landlordId: adminLandlordId,
        buildingId: adminUserBuildingId || undefined,
        unitId: adminHouseUnitId || undefined,
        meterNo: meterNoForApi,
        leaseStart,
        leaseEnd: leaseEnd.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        kraPin: kraPin.trim() || undefined,
        depositAmountPaid: depositAmountPaid.trim()
          ? Number.parseFloat(depositAmountPaid)
          : undefined,
        secondaryPhones: secondaryPhones.trim() || undefined,
        billingModel,
        initialStatus,
        tenantType,
        notes: notes.trim() || undefined,
      });

      if (!result.ok) {
        setFormError(result.error);
        toast.error(result.error);
        return;
      }

      issuePdf({
        tenantName: fullName.trim(),
        tenantEmail: email.trim() || "—",
        tenantId: result.tenantCode,
        passwordPlain: password,
        propertyLabel,
        unitLabel,
        leaseStart,
        waterMeterId: meterNoForApi ?? adminMeterId,
      });
      toast.success("Tenant created. Credentials PDF downloaded.");
      router.push(
        successHref ?? `/dashboard/tenants/${encodeURIComponent(result.tenantId)}`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLandlordPortal && !sessionLandlord) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading your landlord account…
      </div>
    );
  }

  if (isLandlordPortal && landlordPortfolioLoading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading your buildings and units…
      </div>
    );
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
                <strong className="text-foreground">Step 1 — Account:</strong>{" "}
                tenant identity and portal password.
              </li>
              <li>
                <strong className="text-foreground">Step 2 — Property:</strong>{" "}
                landlord, building, unit, meter from inventory, lease, and billing.
              </li>
              <li>
                Finish — a credentials PDF downloads for you to share with the tenant.
              </li>
            </ol>
          </div>
          <div className="" aria-hidden>
            <div className="flex items-end gap-3">
              <img
                src="/img/create-user.png"
                alt="Tenant icon"
                className="w-full lg:h-40 dark:invert object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="rounded-xl mx-auto max-w-3xl  bg-card p-6  md:p-8 dark:border-border/80">
        <Link
          href={tenantsListHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 mb-4 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <div className="mb-6 flex justify-center gap-2">
          <div
            className={cn(
              "flex h-9 min-w-[7rem] items-center justify-center rounded-full border px-3 text-xs font-semibold sm:text-sm",
              wizardStep === 1
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-muted-foreground dark:border-border/80"
            )}
          >
            1 · Account
          </div>
          <div className="flex items-center text-muted-foreground">→</div>
          <div
            className={cn(
              "flex h-9 min-w-[7rem] items-center justify-center rounded-full border px-3 text-xs font-semibold sm:text-sm",
              wizardStep === 2
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-muted-foreground dark:border-border/80"
            )}
          >
            2 · Property
          </div>
        </div>

        <h2 className="text-center text-xl font-semibold text-foreground">
          {wizardStep === 1 ? "Tenant account" : "Property & water account"}
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {wizardStep === 1
            ? "Collect who is moving in and how they will sign in."
            : "Link the tenant to a landlord, building, meter, and billing profile."}
        </p>

        <form onSubmit={finalizeTenant} className="mt-8 space-y-8">
          {wizardStep === 1 ? (
            <FieldGroup className="gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">
                    Full name
                    <RequiredMark />
                  </Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
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
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 7xx xxx xxx"
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nationalId" className="text-foreground">
                    National ID{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="nationalId"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="e.g. 12345678"
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kraPin" className="text-foreground">
                    KRA PIN{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="kraPin"
                    value={kraPin}
                    onChange={(e) => setKraPin(e.target.value)}
                    placeholder="e.g. A001234567B"
                    className="h-11 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryPhones" className="text-foreground">
                  Other phone numbers{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="secondaryPhones"
                  type="tel"
                  value={secondaryPhones}
                  onChange={(e) => setSecondaryPhones(e.target.value)}
                  placeholder="+254 7xx…, +254 1xx… (comma-separated)"
                  className="h-11 rounded-lg"
                />
                <FieldDescription>
                  Alternate or emergency contacts, separated by commas.
                </FieldDescription>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                  <RequiredMark />
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tenant@email.com"
                  className="h-11 rounded-lg"
                />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 dark:border-border/80">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <KeyRound className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />
                    Tenant portal password
                    <RequiredMark />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 rounded-full"
                    onClick={() => {
                      const p = generateReadablePassword(14);
                      setPassword(p);
                      setConfirmPassword(p);
                      toast.message("A strong password was filled in.");
                    }}
                  >
                    <Sparkles className="size-3.5" />
                    Generate password
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Shown in the PDF only — hand off securely to the tenant.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password (min. 8 characters)</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-lg font-mono text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-11 rounded-lg font-mono text-sm"
                      placeholder="Repeat password"
                    />
                  </div>
                </div>
              </div>
            </FieldGroup>
          ) : (
            <FieldGroup className="gap-6">
              {isLandlordPortal ? (
                <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4 dark:border-border/80">
                  <span className="text-sm font-medium text-foreground">
                    Landlord / property manager
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Pre-selected from your signed-in landlord account.
                  </p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 dark:border-border/80">
                    <UserRound className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {selectedLandlord
                        ? `${selectedLandlord.name} — ${selectedLandlord.company}${
                            sessionLandlord?.code
                              ? ` (${sessionLandlord.code})`
                              : ""
                          }`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : (
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
                  {landlordsLoading && !landlordMenuOpen ? (
                    <p className="text-xs text-muted-foreground">Loading landlords…</p>
                  ) : null}
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
                                setAdminLandlordId(l.id);
                                setAdminUserBuildingId("");
                                setAdminHouseUnitId("");
                                setSelectedMeterId("");
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
              )}

              {isLandlordPortal ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="landlord-building" className="text-foreground">
                      Building / property
                      <RequiredMark />
                    </Label>
                    {buildings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No buildings on your account yet.{" "}
                        <Link
                          href="/landlords/dashboard/buildings/new"
                          className="font-medium text-[#0A4266] underline dark:text-[#6BB4E8]"
                        >
                          Add a building
                        </Link>{" "}
                        first, then return here.
                      </p>
                    ) : (
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <select
                          id="landlord-building"
                          required
                          value={userBuildingId}
                          onChange={(e) => {
                            setUserBuildingId(e.target.value);
                            setHouseUnitId("");
                            setSelectedMeterId("");
                            setMeterOverride(false);
                          }}
                          className={cn(selectClass, "pl-10 pr-10 appearance-none")}
                        >
                          <option value="">Select building…</option>
                          {buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="landlord-house" className="text-foreground">
                      Unit / house
                      <RequiredMark />
                    </Label>
                    {!userBuildingId ? (
                      <p className="text-sm text-muted-foreground">
                        Select a building to load its units.
                      </p>
                    ) : housesForBuilding.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No units in this building. Add units from the{" "}
                        <Link
                          href={`/landlords/dashboard/buildings/${encodeURIComponent(userBuildingId)}`}
                          className="font-medium text-[#0A4266] underline dark:text-[#6BB4E8]"
                        >
                          building page
                        </Link>
                        .
                      </p>
                    ) : vacantHousesForBuilding.length === 0 ? (
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        All units in this building are occupied. Pick another building or free a unit first.
                      </p>
                    ) : (
                      <select
                        id="landlord-house"
                        required
                        value={houseUnitId}
                        onChange={(e) => {
                          setHouseUnitId(e.target.value);
                          setMeterOverride(false);
                        }}
                        className={selectClass}
                      >
                        <option value="">Select unit…</option>
                        {housesForBuilding.map((h) => (
                          <option
                            key={h.id}
                            value={h.id}
                            disabled={Boolean(h.tenantId)}
                          >
                            {h.label}
                            {h.meterId ? ` · ${h.meterId}` : ""}
                            {h.tenantId
                              ? ` (occupied — ${h.tenantName ?? "tenant"})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ) : !adminLandlordId ? (
                <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground dark:border-border/80">
                  Select a landlord to load their buildings and units.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="admin-building" className="text-foreground">
                        Building / property{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <div className="relative">
                        <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <select
                          id="admin-building"
                          value={adminUserBuildingId}
                          onChange={(e) => {
                            setAdminUserBuildingId(e.target.value);
                            setAdminHouseUnitId("");
                            setLandlordUnitFree("");
                            setSelectedMeterId("");
                            setMeterOverride(false);
                          }}
                          disabled={adminBuildingsLoading}
                          className={cn(selectClass, "pl-10 pr-10 appearance-none")}
                        >
                          <option value="">No building</option>
                          {adminBuildings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                      {adminBuildingsLoading ? (
                        <FieldDescription>Loading buildings…</FieldDescription>
                      ) : adminBuildings.length === 0 ? (
                        <FieldDescription>
                          No buildings for this landlord yet. You can still create the tenant.
                        </FieldDescription>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-unit" className="text-foreground">
                        Unit / house{" "}
                        <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      {adminUserBuildingId ? (
                        adminHousesLoading ? (
                          <p className="text-sm text-muted-foreground">Loading units…</p>
                        ) : adminHouses.length > 0 ? (
                          <select
                            id="admin-unit"
                            value={adminHouseUnitId}
                            onChange={(e) => {
                              setAdminHouseUnitId(e.target.value);
                              setMeterOverride(false);
                            }}
                            className={selectClass}
                          >
                            <option value="">No unit selected</option>
                            {adminHouses.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.label}
                                {h.tenantName ? ` · ${h.tenantName}` : " · Vacant"}
                                {h.meterId ? ` · ${h.meterId}` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id="admin-unit-free"
                            value={landlordUnitFree}
                            onChange={(e) => setLandlordUnitFree(e.target.value)}
                            placeholder="e.g. Block A · Unit 12"
                            className="h-11 rounded-lg"
                          />
                        )
                      ) : (
                        <Input
                          id="admin-unit-free"
                          value={landlordUnitFree}
                          onChange={(e) => setLandlordUnitFree(e.target.value)}
                          placeholder="e.g. Block A · Unit 12"
                          className="h-11 rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedUnit && unitMeterSerial ? (
                <div className="rounded-xl border border-[#0A4266]/25 bg-[#0A4266]/5 p-4 dark:border-[#6BB4E8]/30 dark:bg-[#6BB4E8]/10">
                  <div className="flex items-start gap-3">
                    <Gauge className="mt-0.5 size-5 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Unit water meter
                      </p>
                      <p className="font-mono text-sm text-foreground">
                        {unitMeterSerial}
                      </p>
                      <FieldDescription>
                        Assigned to {selectedUnit.label}. This meter will be linked
                        to the new tenant automatically.
                      </FieldDescription>
                    </div>
                  </div>
                  {!meterOverride ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-3 h-8 rounded-full px-2 text-xs text-muted-foreground"
                      onClick={() => setMeterOverride(true)}
                    >
                      Choose a different meter
                    </Button>
                  ) : null}
                </div>
              ) : selectedUnit && !unitMeterSerial ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground dark:border-border/80">
                  No meter is assigned to {selectedUnit.label} yet. Pick one from
                  inventory below or assign a meter to the unit first.
                </p>
              ) : (isLandlordPortal ? userBuildingId : adminUserBuildingId) ? (
                <p className="text-sm text-muted-foreground">
                  Select a unit to see its assigned water meter.
                </p>
              ) : null}

              {(!unitMeterSerial || meterOverride) && (
                <div className="space-y-2">
                  <Label htmlFor="meterPick" className="text-foreground">
                    Water meter
                    {unitMeterSerial ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        (override)
                      </span>
                    ) : null}
                  </Label>
                  {metersLoading ? (
                    <p className="text-sm text-muted-foreground">Loading meters…</p>
                  ) : meterPickerRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No meters in inventory.{" "}
                      <Link
                        href={
                          isLandlordPortal
                            ? "/landlords/dashboard/meters"
                            : "/dashboard/meters/onboard"
                        }
                        className="font-medium text-[#0A4266] underline dark:text-[#6BB4E8]"
                      >
                        Onboard a meter
                      </Link>{" "}
                      first.
                    </p>
                  ) : (
                    <>
                      <select
                        id="meterPick"
                        value={selectedMeterId}
                        onChange={(e) => {
                          setSelectedMeterId(e.target.value);
                          setMeterOverride(true);
                        }}
                        className={cn(selectClass, "font-mono text-xs sm:text-sm")}
                      >
                        <option value="">
                          {selectedUnit
                            ? "No meter — assign later"
                            : "Use unit default / assign later (demo serial)"}
                        </option>
                        {meterPickerRows.map((m) => (
                          <option key={m.meterId} value={m.meterId}>
                            {formatMeterPickerLabel(m)}
                          </option>
                        ))}
                      </select>
                      <FieldDescription>
                        Meters onboarded to this landlord. Assign meters to units when
                        onboarding so new tenants inherit them automatically.
                      </FieldDescription>
                    </>
                  )}
                </div>
              )}

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
                      type="date"
                      value={leaseStart}
                      onChange={(e) => setLeaseStart(e.target.value)}
                      className="h-11 rounded-lg pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leaseEnd" className="text-foreground">
                    Lease end date{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="leaseEnd"
                      type="date"
                      value={leaseEnd}
                      onChange={(e) => setLeaseEnd(e.target.value)}
                      className="h-11 rounded-lg pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <Label htmlFor="depositAmount" className="text-foreground">
                  Deposit amount paid (KES){" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="depositAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositAmountPaid}
                  onChange={(e) => setDepositAmountPaid(e.target.value)}
                  placeholder="e.g. 15000"
                  className="h-11 rounded-lg"
                />
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
                  Prepaid uses STS tokens; postpaid supports M-Pesa and invoicing.
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
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Access instructions, metering notes, billing agreements…"
                  className="w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
                />
              </div>
            </FieldGroup>
          )}

          {formError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/50 dark:bg-destructive/15"
            >
              {formError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end dark:border-border/80">
            <Link
              href={tenantsListHref}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex h-11 items-center justify-center rounded-full px-6 sm:min-w-[120px]"
              )}
            >
              Cancel
            </Link>
            {wizardStep === 1 ? (
              <Button
                type="button"
                onClick={continueToStep2}
                className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
              >
                Continue to property
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full px-6"
                  onClick={goStep1}
                >
                  Back to account
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 rounded-full bg-[#0A4266] px-8 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                >
                  {isSubmitting ? "Creating tenant…" : "Create tenant & download PDF"}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
