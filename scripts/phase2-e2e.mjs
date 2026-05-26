// Throwaway integration test for the Phase 2 DB + Storage paths:
// profile edits, goal-set reconciliation, bodyweight add/delete, and the
// owner-scoped avatars bucket (own access works, cross-user access blocked).
// Run: node scripts/phase2-e2e.mjs
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
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FAIL"} ${label}`);

// 1x1 transparent PNG.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

const ids = [];
async function makeUser(suffix) {
  const email = `phase2-${suffix}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: "Test1234!", email_confirm: true });
  if (error) throw error;
  ids.push(data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: "Test1234!" });
  return { id: data.user.id, client };
}

try {
  const a = await makeUser("a");
  const b = await makeUser("b");
  ok("created two signed-in users", !!a.id && !!b.id);

  // Onboard user A so the profile is valid/complete.
  const { error: onbErr } = await a.client.from("profiles").update({
    username: `p2user${Date.now().toString().slice(-6)}`, display_name: "Tester",
    dob: "1994-03-02", gender: "male", height_cm: 180, units: "metric",
    timezone: "Asia/Kolkata", experience_level: "beginner", onboarding_complete: true,
  }).eq("id", a.id);
  ok("onboard profile", !onbErr);

  // Profile edit: bio, privacy, units.
  const { error: editErr } = await a.client.from("profiles")
    .update({ bio: "I lift.", privacy: "public", units: "imperial" }).eq("id", a.id);
  ok("profile edit (bio/privacy/units)", !editErr);
  const { data: edited } = await a.client.from("profiles").select("bio, privacy, units").eq("id", a.id).single();
  ok("profile edit persisted", edited?.bio === "I lift." && edited?.privacy === "public" && edited?.units === "imperial");

  // Goal-set reconcile: start {build_muscle, get_stronger} → end {build_muscle, lose_weight}.
  await a.client.from("goals").upsert(
    [{ user_id: a.id, type: "build_muscle" }, { user_id: a.id, type: "get_stronger" }],
    { onConflict: "user_id,type" });
  const next = ["build_muscle", "lose_weight"];
  await a.client.from("goals").upsert(next.map((type) => ({ user_id: a.id, type })), { onConflict: "user_id,type" });
  await a.client.from("goals").delete().eq("user_id", a.id).not("type", "in", `(${next.join(",")})`);
  const { data: goals } = await a.client.from("goals").select("type");
  const set = new Set((goals ?? []).map((g) => g.type));
  ok("goal reconcile keeps selected", set.has("build_muscle") && set.has("lose_weight"));
  ok("goal reconcile drops deselected", !set.has("get_stronger") && set.size === 2);

  // Bodyweight add + delete.
  const { data: bw, error: bwErr } = await a.client.from("body_weights")
    .insert({ user_id: a.id, weight_kg: 81.4, recorded_at: "2026-05-01T12:00:00Z" }).select("id").single();
  ok("bodyweight insert", !bwErr && !!bw?.id);
  const { error: delErr } = await a.client.from("body_weights").delete().eq("id", bw.id);
  ok("bodyweight delete (own)", !delErr);

  // Avatar storage: own upload + signed URL works.
  const aPath = `${a.id}/avatar`;
  const { error: upErr } = await a.client.storage.from("avatars")
    .upload(aPath, PNG, { upsert: true, contentType: "image/png" });
  ok("avatar upload to own folder", !upErr);
  const { data: signed } = await a.client.storage.from("avatars").createSignedUrl(aPath, 60);
  ok("signed URL for own avatar", !!signed?.signedUrl);

  // Storage RLS: user B cannot upload into user A's folder, nor list it.
  const { error: spoofErr } = await b.client.storage.from("avatars")
    .upload(`${a.id}/avatar`, PNG, { upsert: true, contentType: "image/png" });
  ok("storage blocks writing another user's folder", !!spoofErr);
  const { data: bList } = await b.client.storage.from("avatars").list(a.id);
  ok("storage hides another user's folder from listing", Array.isArray(bList) && bList.length === 0);
} catch (e) {
  console.error("✗ THREW:", e.message);
} finally {
  for (const id of ids) {
    await admin.storage.from("avatars").remove([`${id}/avatar`]);
    await admin.auth.admin.deleteUser(id);
  }
}
