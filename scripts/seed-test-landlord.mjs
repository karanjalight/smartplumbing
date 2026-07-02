// Ensures a verifiable landlord login exists on the configured Supabase project.
// Idempotent. Node-20 compatible: uses the REST/GoTrue-admin HTTP APIs directly
// via fetch (the @supabase/supabase-js client needs native WebSocket, which
// Node < 22 lacks). Reads keys from .env.local.
//
// Run: node scripts/seed-test-landlord.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = "landlord.test@smartone.local";
const PASSWORD = "Landlord!2026";
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

async function body(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

async function main() {
  if (!BASE || !SR) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");

  // 1. Find or create the auth user.
  let userId;
  const list = await body(await fetch(`${BASE}/auth/v1/admin/users?per_page=200`, { headers: H }));
  const users = Array.isArray(list) ? list : list.users ?? [];
  const existing = users.find((u) => u.email === EMAIL);
  if (existing) {
    userId = existing.id;
    console.log("auth user exists:", userId);
  } else {
    const res = await fetch(`${BASE}/auth/v1/admin/users`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
    });
    const created = await body(res);
    if (!res.ok) throw new Error("create user failed: " + JSON.stringify(created));
    userId = created.id;
    console.log("created auth user:", userId);
  }

  // Ensure the password is the known value (in case the user pre-existed).
  await fetch(`${BASE}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ password: PASSWORD, email_confirm: true }),
  });

  // 2. Promote the profile to landlord (the on_auth_user_created trigger already
  //    created the profiles row with role = tenant).
  const profRes = await fetch(`${BASE}/rest/v1/profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({ role: "landlord" }),
  });
  console.log("profile role ->", profRes.status, JSON.stringify(await body(profRes)));

  // 3. Ensure a landlords row is linked to this profile.
  const found = await body(
    await fetch(`${BASE}/rest/v1/landlords?profile_id=eq.${userId}&select=id`, { headers: H }),
  );
  if (Array.isArray(found) && found.length) {
    console.log("landlord row exists:", found[0].id);
  } else {
    const res = await fetch(`${BASE}/rest/v1/landlords`, {
      method: "POST",
      headers: { ...H, Prefer: "return=representation" },
      body: JSON.stringify({ profile_id: userId, full_name: "Test Landlord", email: EMAIL }),
    });
    const ins = await body(res);
    if (!res.ok) throw new Error("landlord insert failed: " + JSON.stringify(ins));
    console.log("created landlord row:", ins[0]?.id);
  }

  console.log(`\nDONE — sign in at /landlords/login with ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
