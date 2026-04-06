"use client";

import {
  Check,
  ChevronDown,
  Hammer,
  ListFilter,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCog,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALL_SERVICE_SKILLS,
  generateNextStaffId,
  getSeedStaffRows,
  readStaffRowsFromStorage,
  skillLabel,
  STAFF_REGIONS,
  STAFF_TABLE_PAGE_SIZE_OPTIONS,
  staffSummary,
  writeStaffRowsToStorage,
  type ServiceSkill,
  type StaffRow,
  type StaffStatus,
} from "@/lib/staff-data";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const STATUS_FILTER_OPTIONS: {
  key: "all" | StaffStatus;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All statuses", hint: "No status filter" },
  { key: "active", label: "Active", hint: "Available for dispatch" },
  { key: "on_leave", label: "On leave", hint: "Temporarily unavailable" },
  { key: "inactive", label: "Inactive", hint: "Off roster" },
];

const SKILL_FILTER_OPTIONS: {
  key: "all" | ServiceSkill;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All skills", hint: "Every trade" },
  { key: "plumbing", label: "Plumbing", hint: "Pipes, leaks, fixtures" },
  { key: "electrical", label: "Electrical", hint: "Power, DB, lighting" },
  { key: "hvac", label: "HVAC", hint: "Ventilation & cooling" },
  { key: "general_maintenance", label: "General maintenance", hint: "Mixed building work" },
  { key: "meter_support", label: "Meter support", hint: "STS / field devices" },
];

const SERVES_LABEL: Record<StaffRow["serves"], string> = {
  tenants: "Tenants",
  landlords: "Landlords",
  both: "Tenants & landlords",
};

function statusBadge(status: StaffStatus) {
  const cls: Record<StaffStatus, string> = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    on_leave:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    inactive: "bg-muted text-muted-foreground dark:bg-muted/80",
  };
  const text: Record<StaffStatus, string> = {
    active: "Active",
    on_leave: "On leave",
    inactive: "Inactive",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", cls[status])}>
      {text[status]}
    </span>
  );
}

type FormState = {
  name: string;
  phone: string;
  email: string;
  region: string;
  status: StaffStatus;
  serves: StaffRow["serves"];
  skills: ServiceSkill[];
  completedJobs90d: string;
  notes: string;
};

function emptyForm(): FormState {
  return {
    name: "",
    phone: "",
    email: "",
    region: STAFF_REGIONS[0] ?? "Nairobi County",
    status: "active",
    serves: "both",
    skills: [],
    completedJobs90d: "0",
    notes: "",
  };
}

function rowToForm(row: StaffRow): FormState {
  return {
    name: row.name,
    phone: row.phone,
    email: row.email,
    region: row.region,
    status: row.status,
    serves: row.serves,
    skills: [...row.skills],
    completedJobs90d: String(row.completedJobs90d),
    notes: row.notes ?? "",
  };
}

export function StaffView() {
  const [rows, setRows] = useState<StaffRow[]>(() => getSeedStaffRows());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStaffRowsFromStorage();
    if (stored && stored.length >= 0) setRows(stored);
    setHydrated(true);
  }, []);

  const persist = (next: StaffRow[]) => {
    setRows(next);
    writeStaffRowsToStorage(next);
  };

  const summary = useMemo(() => staffSummary(rows), [rows]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StaffStatus>("all");
  const [skillFilter, setSkillFilter] = useState<"all" | ServiceSkill>("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const statusMenuRef = useRef<HTMLDivElement>(null);
  const skillMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (statusMenuRef.current && !statusMenuRef.current.contains(t)) setStatusMenuOpen(false);
      if (skillMenuRef.current && !skillMenuRef.current.contains(t)) setSkillMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: StaffRow) => {
    setEditingId(row.id);
    setForm(rowToForm(row));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const submitForm = () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!name || !phone || !email) {
      toast.error("Name, phone, and email are required.");
      return;
    }
    if (form.skills.length === 0) {
      toast.error("Select at least one skill.");
      return;
    }
    const jobs = Math.max(0, Math.floor(Number(form.completedJobs90d) || 0));

    if (editingId) {
      const next = rows.map((r) =>
        r.id === editingId
          ? {
              ...r,
              name,
              phone,
              email,
              region: form.region,
              status: form.status,
              serves: form.serves,
              skills: [...form.skills],
              completedJobs90d: jobs,
              notes: form.notes.trim() === "" ? null : form.notes.trim(),
            }
          : r
      );
      persist(next);
      toast.success("Staff member updated");
    } else {
      const id = generateNextStaffId(rows);
      const row: StaffRow = {
        id,
        name,
        phone,
        email,
        region: form.region,
        status: form.status,
        serves: form.serves,
        skills: [...form.skills],
        completedJobs90d: jobs,
        notes: form.notes.trim() === "" ? null : form.notes.trim(),
      };
      persist([...rows, row]);
      toast.success("Staff member added");
    }
    closeModal();
  };

  const removeRow = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the directory? This cannot be undone.`)) return;
    persist(rows.filter((r) => r.id !== id));
    toast.success("Staff member removed");
  };

  const matchesSearchAndFilters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (skillFilter !== "all" && !row.skills.includes(skillFilter)) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        row.region.toLowerCase().includes(q) ||
        row.skills.some((k) => skillLabel(k).toLowerCase().includes(q))
      );
    });
  }, [rows, search, statusFilter, skillFilter]);

  const statusOptions = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    return STATUS_FILTER_OPTIONS.filter(
      (o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q)
    );
  }, [statusQuery]);

  const skillOptions = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    return SKILL_FILTER_OPTIONS.filter(
      (o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q)
    );
  }, [skillQuery]);

  const totalPages = Math.max(1, Math.ceil(matchesSearchAndFilters.length / pageSize));
  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);
  useEffect(() => setPage(1), [pageSize, statusFilter, skillFilter, search]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = matchesSearchAndFilters.slice(start, start + pageSize);
  const showingFrom = matchesSearchAndFilters.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  const statusLabel = STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "All statuses";
  const skillLabelFilter = SKILL_FILTER_OPTIONS.find((o) => o.key === skillFilter)?.label ?? "All skills";

  const toggleSkill = (sk: ServiceSkill) => {
    setForm((f) => ({
      ...f,
      skills: f.skills.includes(sk) ? f.skills.filter((s) => s !== sk) : [...f.skills, sk],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Field and technical team for tenants and landlords — plumbing, electrical, HVAC, maintenance, and meter support.
            Changes are saved in this browser.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-10 shrink-0 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          )}
        >
          <Plus className="size-4" aria-hidden />
          Add staff
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Team size</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Profiles on file</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.active}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Available for dispatch</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">On leave</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.onLeave}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Temporarily unavailable</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">Jobs (90d, demo)</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.jobs90d}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Completed visits roll-up</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search name, ID, phone, email, region…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
            aria-label="Search staff"
          />
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:max-w-xl">
          <div ref={skillMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setSkillMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                if (!skillMenuOpen) setSkillQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={skillMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{skillLabelFilter}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", skillMenuOpen && "rotate-180")} />
            </button>
            {skillMenuOpen && (
              <div
                className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80"
                role="listbox"
              >
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search skills…"
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {skillOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={skillFilter === o.key}
                        onClick={() => {
                          setSkillFilter(o.key);
                          setSkillMenuOpen(false);
                          setSkillQuery("");
                          setPage(1);
                        }}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                          skillFilter === o.key && "bg-muted/80"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {skillFilter === o.key && (
                            <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                          )}
                          <span className={cn("font-medium", skillFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div ref={statusMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen((o) => !o);
                setSkillMenuOpen(false);
                if (!statusMenuOpen) setStatusQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={statusMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ListFilter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{statusLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", statusMenuOpen && "rotate-180")} />
            </button>
            {statusMenuOpen && (
              <div
                className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80"
                role="listbox"
              >
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search statuses…"
                    value={statusQuery}
                    onChange={(e) => setStatusQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {statusOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={statusFilter === o.key}
                        onClick={() => {
                          setStatusFilter(o.key);
                          setStatusMenuOpen(false);
                          setStatusQuery("");
                          setPage(1);
                        }}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                          statusFilter === o.key && "bg-muted/80"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {statusFilter === o.key && (
                            <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                          )}
                          <span className={cn("font-medium", statusFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-4 py-3 dark:border-border/80">
          <p className="text-sm font-medium text-foreground">Service staff</p>
          <p className="text-xs text-muted-foreground">
            Technicians for tenant call-outs and landlord portfolio work. Create, edit, or remove records below.
            {!hydrated ? " Loading saved data…" : null}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Staff</th>
                <th className="px-4 py-3 font-semibold">Skills</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">Audience</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Jobs (90d)</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No staff match your search or filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A4266]/15 dark:bg-[#6BB4E8]/20">
                          <UserCog className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">{row.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{row.id}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="size-3 shrink-0" aria-hidden />
                            {row.phone}
                          </div>
                          <div className="truncate text-xs text-muted-foreground" title={row.email}>
                            {row.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.skills.map((sk) => (
                          <span
                            key={sk}
                            className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium dark:border-border/80"
                          >
                            <Hammer className="size-3 opacity-70" aria-hidden />
                            {skillLabel(sk)}
                          </span>
                        ))}
                      </div>
                      {row.notes ? (
                        <p className="mt-2 max-w-[220px] text-xs leading-snug text-muted-foreground line-clamp-2" title={row.notes}>
                          {row.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-start gap-1 text-sm text-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {row.region}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{SERVES_LABEL[row.serves]}</td>
                    <td className="px-4 py-3">{statusBadge(row.status)}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{row.completedJobs90d}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 gap-1 rounded-full px-2.5 text-xs"
                          )}
                        >
                          <Pencil className="size-3" aria-hidden />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id, row.name)}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 gap-1 rounded-full border-destructive/40 px-2.5 text-xs text-destructive hover:bg-destructive/10"
                          )}
                        >
                          <Trash2 className="size-3" aria-hidden />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 dark:border-border/80 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">
            {matchesSearchAndFilters.length === 0
              ? "Showing 0 of 0"
              : `Showing ${showingFrom}-${showingTo} of ${matchesSearchAndFilters.length}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ‹
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={p === safePage ? "default" : "outline"}
                  size="icon-sm"
                  className={cn(
                    "rounded-full",
                    p === safePage &&
                      "bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                  )}
                  onClick={() => setPage(p)}
                  aria-current={p === safePage ? "page" : undefined}
                >
                  {p}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                ›
              </Button>
            </div>
            <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-2.5 dark:border-border/80">
              <label htmlFor="staff-page-size" className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm">
                Show
              </label>
              <select
                id="staff-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 min-w-[4.5rem] cursor-pointer rounded-full border-0 bg-transparent py-0 pr-6 text-sm font-medium outline-none focus-visible:ring-0"
              >
                {STAFF_TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">per page</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground lg:text-right">
            Page {safePage} of {totalPages}
          </p>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-form-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={closeModal}
          />
          <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80">
            <div className="flex items-start justify-between gap-2">
              <h2 id="staff-form-title" className="text-lg font-semibold text-foreground">
                {editingId ? "Edit staff member" : "Add staff member"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="Close dialog"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-name">Full name</Label>
                <Input
                  id="staff-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="rounded-lg"
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="staff-phone">Phone</Label>
                  <Input
                    id="staff-phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="rounded-lg"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="rounded-lg"
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-region">Region</Label>
                <select
                  id="staff-region"
                  value={form.region}
                  onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border/80"
                >
                  {STAFF_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="staff-status">Status</Label>
                  <select
                    id="staff-status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StaffStatus }))}
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border/80"
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-serves">Primary audience</Label>
                  <select
                    id="staff-serves"
                    value={form.serves}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, serves: e.target.value as StaffRow["serves"] }))
                    }
                    className="flex h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border/80"
                  >
                    <option value="both">Tenants & landlords</option>
                    <option value="tenants">Tenants</option>
                    <option value="landlords">Landlords</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium leading-none">Skills (at least one)</span>
                <div className="flex flex-wrap gap-2">
                  {ALL_SERVICE_SKILLS.map((sk) => {
                    const on = form.skills.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => toggleSkill(sk)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          on
                            ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                            : "border-border bg-muted/40 hover:bg-muted dark:border-border/80"
                        )}
                      >
                        {skillLabel(sk)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-jobs">Completed jobs (90d, demo)</Label>
                <Input
                  id="staff-jobs"
                  type="number"
                  min={0}
                  value={form.completedJobs90d}
                  onChange={(e) => setForm((f) => ({ ...f, completedJobs90d: e.target.value }))}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-notes">Notes</Label>
                <textarea
                  id="staff-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="flex w-full resize-y rounded-lg border border-border bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:border-border/80"
                  placeholder="Optional — specialties, SLAs, equipment…"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-full" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={submitForm}
              >
                {editingId ? "Save changes" : "Create staff"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
