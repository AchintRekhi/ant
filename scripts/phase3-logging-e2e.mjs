// Integration test for the Phase 3 logging queries + PR write path.
// Verifies the nested-select SHAPES the workout/progress pages rely on
// (PostgREST embed cardinality) and that flagging is_pr round-trips.
// Run: node scripts/phase3-logging-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const ok = (label, cond) => console.log(`${cond ? "✓" : "✗ FAIL"} ${label}`);

// Mirror of computePRFlags (canonical version unit-tested in pr-core.test.ts).
function computePRFlags(ordered) {
  const out = new Map();
  let max = 0;
  for (const s of ordered) {
    const isPr = s.weightKg > 0 && s.weightKg > max;
    if (s.weightKg > max) max = s.weightKg;
    out.set(s.id, isPr);
  }
  return out;
}

let userId;
try {
  const email = `phase3log-${Date.now()}@example.com`;
  const { data: u } = await admin.auth.admin.createUser({ email, password: "Test1234!", email_confirm: true });
  userId = u.user.id;
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: "Test1234!" });

  const { data: bench } = await c.from("exercises").select("id").eq("name", "Barbell Bench Press").single();

  // Session 1 (older): 60x8, 65x8.
  const { data: s1 } = await c.from("workout_sessions")
    .insert({ user_id: userId, started_at: "2026-05-01T10:00:00Z", ended_at: "2026-05-01T11:00:00Z" }).select("id").single();
  const { data: se1 } = await c.from("session_exercises").insert({ session_id: s1.id, exercise_id: bench.id, sort_order: 0 }).select("id").single();
  await c.from("sets").insert([
    { session_exercise_id: se1.id, set_number: 1, reps: 8, weight_kg: 60, is_pr: false },
    { session_exercise_id: se1.id, set_number: 2, reps: 8, weight_kg: 65, is_pr: false },
  ]);

  // Session 2 (newer): 70x5 — a new best.
  const { data: s2 } = await c.from("workout_sessions")
    .insert({ user_id: userId, started_at: "2026-05-10T10:00:00Z", ended_at: "2026-05-10T11:00:00Z" }).select("id").single();
  const { data: se2 } = await c.from("session_exercises").insert({ session_id: s2.id, exercise_id: bench.id, sort_order: 0 }).select("id").single();
  await c.from("sets").insert([{ session_exercise_id: se2.id, set_number: 1, reps: 5, weight_kg: 70, is_pr: false }]);

  // ── Shape check: the workout/[id] page select ──
  const { data: page } = await c.from("workout_sessions")
    .select(`id, routine_days ( label ), session_exercises ( id, exercises ( name ), sets ( id, set_number, reps, weight_kg, is_pr ) )`)
    .eq("id", s1.id).single();
  ok("routine_days embeds as object|null (not array)", !Array.isArray(page.routine_days));
  ok("session_exercises embeds as array", Array.isArray(page.session_exercises));
  ok("exercises embeds as object with name", page.session_exercises[0].exercises?.name === "Barbell Bench Press");
  ok("sets embeds as array", Array.isArray(page.session_exercises[0].sets));

  // ── PR write path: order all sets chronologically, flag, write back ──
  const { data: ses } = await c.from("session_exercises").select("id, workout_sessions ( started_at )").eq("exercise_id", bench.id);
  const startedAt = new Map(ses.map((s) => [s.id, s.workout_sessions?.started_at ?? ""]));
  const { data: sets } = await c.from("sets").select("id, weight_kg, set_number, session_exercise_id").in("session_exercise_id", ses.map((s) => s.id));
  const ordered = [...sets].sort((a, b) => {
    const ta = startedAt.get(a.session_exercise_id), tb = startedAt.get(b.session_exercise_id);
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.set_number - b.set_number;
  }).map((s) => ({ id: s.id, weightKg: s.weight_kg }));
  const flags = computePRFlags(ordered);
  const toTrue = [...flags].filter(([, v]) => v).map(([id]) => id);
  await c.from("sets").update({ is_pr: true }).in("id", toTrue);

  const { data: prs } = await c.from("sets").select("weight_kg").eq("is_pr", true).order("weight_kg");
  const prWeights = prs.map((p) => Number(p.weight_kg));
  // Expected PRs: 60 (first), 65 (beat 60), 70 (beat 65). 65-was-not-equalled etc.
  ok("PR flags persisted as expected (60, 65, 70)", JSON.stringify(prWeights) === JSON.stringify([60, 65, 70]));

  // ── Shape check: the progress page select ──
  const { data: prog } = await c.from("session_exercises")
    .select(`exercise_id, exercises ( name ), workout_sessions ( started_at ), sets ( weight_kg, is_pr )`);
  ok("progress: workout_sessions embeds as object", prog.length > 0 && !Array.isArray(prog[0].workout_sessions));
  ok("progress: sets embeds as array", Array.isArray(prog[0].sets));
} catch (e) {
  console.error("✗ THREW:", e.message);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
