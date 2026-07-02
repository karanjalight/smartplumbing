"use client";

import Link from "next/link";

import { useLandlordSession } from "@/components/landlord/use-landlord-session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandlordSessionGate({
  children,
}: {
  children: (landlord: import("@/lib/landlord-session").SignedInLandlord) => React.ReactNode;
}) {
  const session = useLandlordSession();

  if (session.status === "loading") {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">Loading your account…</p>
    );
  }

  if (session.status === "unconfigured") {
    return (
      <p className="mx-auto max-w-md py-12 text-center text-sm text-muted-foreground">
        Supabase is not configured. Add your project URL and anon key to{" "}
        <code className="text-xs">.env.local</code> to manage real tenants and buildings.
      </p>
    );
  }

  if (session.status === "unsigned") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in with your landlord account to manage tenants and properties.
        </p>
        <Link
          href="/auth/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "inline-flex rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground",
          )}
        >
          Landlord sign in
        </Link>
      </div>
    );
  }

  if (session.status === "error") {
    return (
      <p className="py-12 text-center text-sm text-destructive">{session.message}</p>
    );
  }

  return <>{children(session.landlord)}</>;
}
