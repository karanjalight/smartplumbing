import { Check, PenLine } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { LeaseRow } from "@/lib/supabase/types";

const ACCENT = "#2147f4";

export function LeaseSignPrompt({
  lease,
  tenantSigned,
}: {
  lease: LeaseRow;
  tenantSigned: boolean;
}) {
  const property = lease.property_label ?? lease.code ?? "your home";

  if (tenantSigned) {
    return (
      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        <Check className="size-5 shrink-0" aria-hidden />
        You&rsquo;ve signed your lease. Awaiting the landlord&rsquo;s signature.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
      <div className="flex items-start gap-2.5">
        <PenLine className="mt-0.5 size-5 shrink-0" style={{ color: ACCENT }} aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Your tenancy agreement is waiting
          </p>
          <p className="text-xs text-muted-foreground">
            {property} · sign it to activate your tenancy.
          </p>
        </div>
      </div>
      <Link
        href="/clients/lease"
        className={cn(buttonVariants({ variant: "default" }), "w-full rounded-full text-white")}
        style={{ backgroundColor: ACCENT }}
      >
        Sign now
      </Link>
    </div>
  );
}
