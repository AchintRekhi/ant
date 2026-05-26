// Throwaway integration test for the Phase 1 DB path:
// trigger-created profile, RLS-scoped onboarding write, goals + bodyweight,
// and the username-availability RPC. Run: node scripts/phase1-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `phase1-test-${Date.now()}@example.com`;
const password = "Test1234!";
let userId;
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FAIL"} ${label}`);

try {
  // 1. Create a confirmed user.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createErr) throw createErr;
  userId = created.user.id;
  ok("admin.createUser", !!userId);

  // 2. Trigger created a profile row (onboarding incomplete).
  const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).single();
  ok("trigger created profile row", !!prof);
  ok("profile starts onboarding_complete=false", prof?.onboarding_complete === false);
  ok("profile default privacy=private", prof?.privacy === "private");

  // 3. Sign in as the user (anon client → RLS as 'authenticated').
  const user = createClient(url, anon, { auth: { persistSession: false } });
  const { error: signErr } = await user.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  ok("user signInWithPassword", true);

  // 4. Username availability RPC.
  const { data: avail1 } = await user.rpc("is_username_available", { candidate: "phase1user" });
  ok("username available before claim", avail1 === true);

  // 5. Onboarding write under RLS (own row).
  const { error: updErr } = await user.from("profiles").update({
    username: "phase1user", display_name: "phase1user", dob: "1995-06-15",
    gender: "male", height_cm: 178.5, units: "metric", timezone: "Asia/Kolkata",
    experience_level: "intermediate", onboarding_complete: true,
  }).eq("id", userId);
  ok("RLS-scoped profile update", !updErr);
  if (updErr) console.log("   update error:", updErr.message);

  // 6. Goals + bodyweight inserts.
  const { error: goalsErr } = await user.from("goals").upsert(
    [{ user_id: userId, type: "build_muscle" }, { user_id: userId, type: "get_stronger" }],
    { onConflict: "user_id,type" },
  );
  ok("goals insert", !goalsErr);
  const { error: bwErr } = await user.from("body_weights").insert({ user_id: userId, weight_kg: 80.2 });
  ok("body_weight insert", !bwErr);

  // 7. Username now taken.
  const { data: avail2 } = await user.rpc("is_username_available", { candidate: "phase1user" });
  ok("username unavailable after claim", avail2 === false);

  // 8. RLS isolation: cannot see other users' rows / cannot fake user_id.
  const { error: spoofErr } = await user.from("body_weights").insert({
    user_id: "00000000-0000-0000-0000-000000000000", weight_kg: 50,
  });
  ok("RLS blocks inserting another user's row", !!spoofErr);

  // 9. Constraint: completed profile requires username (try clearing it).
  const { error: clearErr } = await user.from("profiles")
    .update({ username: null }).eq("id", userId);
  ok("CHECK blocks clearing username on complete profile", !!clearErr);
} catch (e) {
  console.error("✗ THREW:", e.message);
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
    const { data: gone } = await admin.from("profiles").select("id").eq("id", userId);
    ok("cascade delete removed profile", Array.isArray(gone) && gone.length === 0);
  }
}
