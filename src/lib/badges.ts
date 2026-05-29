import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * Data-driven badge engine: read the catalogue, check each unearned badge's
 * rule against the user's current stats, and award any that now qualify.
 * Idempotent — already-earned badges are skipped, so it's safe to call after
 * any activity. Returns the codes newly awarded.
 *
 *   kind 'streak'         → longest_streak >= threshold (so it sticks once earned)
 *   kind 'workouts'       → total activity count >= threshold
 *   kind 'first_pr'       → the user has at least one PR set
 *   kind 'challenge_join' → count of challenges joined >= threshold
 *   kind 'challenge_win'  → count of challenges where final_rank = 1 >= threshold
 */
export async function evaluateBadges(supabase: Client, userId: string): Promise<string[]> {
  const [{ data: defs }, { data: earned }] = await Promise.all([
    supabase.from("badges").select("code, kind, threshold"),
    supabase.from("user_badges").select("badge_code").eq("user_id", userId),
  ]);
  if (!defs || defs.length === 0) return [];

  const have = new Set((earned ?? []).map((e) => e.badge_code));
  const pending = defs.filter((d) => !have.has(d.code));
  if (pending.length === 0) return [];

  const needsPr   = pending.some((d) => d.kind === "first_pr");
  const needsJoin = pending.some((d) => d.kind === "challenge_join");
  const needsWin  = pending.some((d) => d.kind === "challenge_win");

  const [
    { data: profile },
    { count: activityCount },
    prRes,
    joinRes,
    winRes,
  ] = await Promise.all([
    supabase.from("profiles").select("longest_streak").eq("id", userId).single(),
    supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    // sets has no user_id of its own — without filtering through the parent
    // session, the Phase 5 SELECT policies would let any public user's PRs
    // satisfy "first_pr" for everyone.
    needsPr
      ? supabase
          .from("sets")
          .select("id, session_exercises!inner(workout_sessions!inner(user_id))", {
            count: "exact",
            head: true,
          })
          .eq("is_pr", true)
          .eq("session_exercises.workout_sessions.user_id", userId)
      : Promise.resolve({ count: 0 }),
    needsJoin
      ? supabase
          .from("challenge_participants")
          .select("challenge_id", { count: "exact", head: true })
          .eq("user_id", userId)
      : Promise.resolve({ count: 0 }),
    needsWin
      ? supabase
          .from("challenge_participants")
          .select("challenge_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("final_rank", 1)
      : Promise.resolve({ count: 0 }),
  ]);

  const longest      = profile?.longest_streak ?? 0;
  const activities   = activityCount ?? 0;
  const hasPr        = (prRes.count ?? 0) > 0;
  const joinCount    = joinRes.count ?? 0;
  const winCount     = winRes.count ?? 0;

  const toAward = pending.filter((d) => {
    if (d.kind === "streak")         return d.threshold != null && longest    >= d.threshold;
    if (d.kind === "workouts")       return d.threshold != null && activities >= d.threshold;
    if (d.kind === "first_pr")       return hasPr;
    if (d.kind === "challenge_join") return d.threshold != null && joinCount  >= d.threshold;
    if (d.kind === "challenge_win")  return d.threshold != null && winCount   >= d.threshold;
    return false;
  });
  if (toAward.length === 0) return [];

  const { error } = await supabase
    .from("user_badges")
    .insert(toAward.map((d) => ({ user_id: userId, badge_code: d.code })));
  if (error) return [];

  return toAward.map((d) => d.code);
}
