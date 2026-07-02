import type { UserRole } from "@/lib/supabase/types";

export type LandlordAccess =
  | { kind: "ok"; landlordId: string }
  | { kind: "redirect"; to: string };

/** Pure auth/role gate for the landlord portal. Redirects unless a landlord id resolves. */
export function resolveLandlordAccess(input: {
  userId: string | null;
  role: UserRole | null;
  landlordId: string | null;
}): LandlordAccess {
  const login = { kind: "redirect", to: "/landlords/login" } as const;
  if (!input.userId) return login;
  if (input.role !== "landlord" && input.role !== "admin") return login;
  if (!input.landlordId) return login;
  return { kind: "ok", landlordId: input.landlordId };
}
