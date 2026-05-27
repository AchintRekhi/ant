import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeCurrentStreak } from "@/lib/streak-core";
import { localDateInTz } from "@/lib/days";

type Client = SupabaseClient<Database>;

/**
 * Recompute the user's streak from their activity_log and persist it onto the
 * profile. longest_streak is monotonic (max of stored vs. the new current), so
 * a once-earned milestone never regresses. Returns the fresh current streak.
 */
export async function recomputeStreak(
  supabase: Client,
  userId: string,
  timezone: string,
): Promise<number> {
  const { data: rows } = await supabase
    .from("activity_log")
    .select("local_date")
    .eq("user_id", userId);

  const dates = (rows ?? []).map((r) => r.local_date);
  const today = localDateInTz(new Date(), timezone);
  const current = computeCurrentStreak(dates, today);

  const { data: profile } = await supabase
    .from("profiles")
    .select("longest_streak")
    .eq("id", userId)
    .single();
  const longest = Math.max(profile?.longest_streak ?? 0, current);

  const lastActive = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  await supabase
    .from("profiles")
    .update({
      current_streak: current,
      longest_streak: longest,
      last_active_date: lastActive,
    })
    .eq("id", userId);

  return current;
}
