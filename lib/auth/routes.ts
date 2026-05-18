import type { UserRole } from "@/lib/supabase/types";

/** Default landing path after sign-in for each platform role. */
export function dashboardPathForRole(role: UserRole | null | undefined): string {
  switch (role) {
    case "admin":
      return "/dashboard";
    case "landlord":
      return "/landlords/dashboard";
    case "tenant":
      return "/clients/dashboard";
    case "staff":
      return "/dashboard";
    default:
      return "/";
  }
}
