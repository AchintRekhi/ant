// Throwaway integration test for the Phase 3 schema + RLS:
// seeded library visibility, custom-exercise ownership, routine/session/set
// writes, cross-user isolation, and cascade deletes. Run: node scripts/phase3-e2e.mjs
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

const ids = [];
async function makeUser(suffix) {
  const email = `phase3-${suffix}-${Date.now()}@example.com`;
  const { data } = await admin.auth.admin.createUser({ email, password: "Test1234!", email_confirm: true });
  ids.push(data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email, password: "Test1234!" });
  return { id: data.user.id, client };
}

try {
  const a = await makeUser("a");
  const b = await makeUser("b");

  // Seeded library readable by any signed-in user.
  const { data: seeded } = await a.client.from("exercises").select("id, name").is("created_by", null).limit(100);
  ok("seeded library readable", (seeded?.length ?? 0) >= 50);
  const benchId = seeded.find((e) => e.name === "Barbell Bench Press")?.id;
  ok("found a known seeded exercise", !!benchId);

  // Custom exercise: A creates one; cannot forge B's ownership; B can't see A's.
  const { data: custom, error: customErr } = await a.client.from("exercises")
    .insert({ name: "My Special Curl", muscle_group: "arms", is_custom: true, created_by: a.id })
    .select("id").single();
  ok("create own custom exercise", !customErr && !!custom?.id);
  const { error: forgeErr } = await a.client.from("exercises")
    .insert({ name: "Forged", muscle_group: "arms", is_custom: true, created_by: b.id });
  ok("cannot create custom exercise owned by someone else", !!forgeErr);
  const { data: bSees } = await b.client.from("exercises").select("id").eq("id", custom.id);
  ok("custom exercise hidden from other users", Array.isArray(bSees) && bSees.length === 0);

  // Routine → day → exercise.
  const { data: routine } = await a.client.from("routines").insert({ user_id: a.id, name: "PPL" }).select("id").single();
  ok("create routine", !!routine?.id);
  const { data: day } = await a.client.from("routine_days")
    .insert({ routine_id: routine.id, day_of_week: 0, label: "Push" }).select("id").single();
  ok("create routine day", !!day?.id);
  const { error: rdeErr } = await a.client.from("routine_day_exercises")
    .insert({ routine_day_id: day.id, exercise_id: benchId, target_sets: 4, target_reps: 8, sort_order: 0 });
  ok("assign exercise to routine day", !rdeErr);

  // Cross-user isolation on routines.
  const { data: bRoutine } = await b.client.from("routines").select("id").eq("id", routine.id);
  ok("routine hidden from other users", Array.isArray(bRoutine) && bRoutine.length === 0);
  const { error: bWriteErr } = await b.client.from("routine_days")
    .insert({ routine_id: routine.id, day_of_week: 1, label: "Hack" });
  ok("cannot add a day to someone else's routine", !!bWriteErr);

  // Workout session → exercise → sets, with a PR flag.
  const { data: session } = await a.client.from("workout_sessions")
    .insert({ user_id: a.id, routine_day_id: day.id, notes: "Felt strong" }).select("id").single();
  ok("create workout session", !!session?.id);
  const { data: se } = await a.client.from("session_exercises")
    .insert({ session_id: session.id, exercise_id: benchId, sort_order: 0 }).select("id").single();
  ok("add exercise to session", !!se?.id);
  // Batch inserts must carry the same keys on every row: PostgREST uses the
  // union of keys and sends NULL (not the column default) for any a row omits.
  const { error: setsErr } = await a.client.from("sets").insert([
    { session_exercise_id: se.id, set_number: 1, reps: 8, weight_kg: 60, is_pr: false },
    { session_exercise_id: se.id, set_number: 2, reps: 8, weight_kg: 65, is_pr: true },
  ]);
  ok("log sets", !setsErr);

  // Cross-user isolation on sets (walks se → session → user).
  const { data: bSets } = await b.client.from("sets").select("id").eq("session_exercise_id", se.id);
  ok("sets hidden from other users", Array.isArray(bSets) && bSets.length === 0);

  // Cascade: deleting the session removes its exercises and sets.
  await a.client.from("workout_sessions").delete().eq("id", session.id);
  const { data: orphanSets } = await admin.from("sets").select("id").eq("session_exercise_id", se.id);
  ok("deleting session cascades to sets", Array.isArray(orphanSets) && orphanSets.length === 0);

  // Cascade: deleting the routine removes its days and assignments.
  await a.client.from("routines").delete().eq("id", routine.id);
  const { data: orphanDays } = await admin.from("routine_days").select("id").eq("routine_id", routine.id);
  ok("deleting routine cascades to days", Array.isArray(orphanDays) && orphanDays.length === 0);
} catch (e) {
  console.error("✗ THREW:", e.message);
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}
