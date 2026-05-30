import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { ageFromDob } from "@/lib/validation";

/**
 * Download-your-data: returns everything the account owns as a single JSON file.
 * Runs on the user's own session client, so RLS already scopes reads to their
 * rows — we additionally filter by user id for clarity and to avoid pulling in
 * others' rows that the social policies would otherwise make visible.
 *
 * Privacy invariant: the profile is projected to `age`, never `dob` — the date
 * of birth is never serialised to a client, including the owner's own export.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const uid = user.id;

  const [
    profileRes,
    goalsRes,
    bodyWeightsRes,
    customExercisesRes,
    routinesRes,
    sessionsRes,
    activityRes,
    badgesRes,
    followsRes,
    blocksRes,
    challengesRes,
    participationsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    supabase.from("goals").select("*").eq("user_id", uid),
    supabase.from("body_weights").select("*").eq("user_id", uid).order("recorded_at"),
    supabase.from("exercises").select("*").eq("created_by", uid),
    supabase
      .from("routines")
      .select("*, routine_days(*, routine_day_exercises(*))")
      .eq("user_id", uid),
    supabase
      .from("workout_sessions")
      .select("*, session_exercises(*, sets(*))")
      .eq("user_id", uid)
      .order("started_at"),
    supabase.from("activity_log").select("*").eq("user_id", uid).order("local_date"),
    supabase.from("user_badges").select("*").eq("user_id", uid),
    supabase.from("follows").select("*").or(`follower_id.eq.${uid},following_id.eq.${uid}`),
    supabase.from("blocks").select("*").eq("blocker_id", uid),
    supabase.from("challenges").select("*").eq("creator_id", uid),
    supabase.from("challenge_participants").select("*").eq("user_id", uid),
  ]);

  const p = profileRes.data;
  // Strip dob; expose only the derived age (the same projection used everywhere).
  // dob: undefined is dropped by JSON.stringify, so it never reaches the file.
  const profile = p
    ? { ...p, dob: undefined, age: p.dob ? ageFromDob(p.dob) : null }
    : null;

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: user.email },
    profile,
    goals: goalsRes.data ?? [],
    body_weights: bodyWeightsRes.data ?? [],
    custom_exercises: customExercisesRes.data ?? [],
    routines: routinesRes.data ?? [],
    workout_sessions: sessionsRes.data ?? [],
    activity_log: activityRes.data ?? [],
    badges: badgesRes.data ?? [],
    follows: followsRes.data ?? [],
    blocks: blocksRes.data ?? [],
    challenges_created: challengesRes.data ?? [],
    challenge_participations: participationsRes.data ?? [],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ant-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
