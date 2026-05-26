import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computePRFlags } from "@/lib/pr-core";

type DB = SupabaseClient<Database>;

/**
 * Recompute the heaviest-weight PR flags for the given exercises, for the
 * current user (the passed client is RLS-scoped). For each exercise we walk its
 * sets in chronological order (session start, then set number) tracking a
 * running max; a set is a PR when its weight beats every prior set's weight.
 *
 * Idempotent and edit-safe: re-running after backdating or editing a session
 * yields the correct flags. Bodyweight (0 kg) sets never count as weight PRs.
 */
export async function recomputePRsForExercises(
  supabase: DB,
  exerciseIds: string[],
): Promise<void> {
  for (const exerciseId of [...new Set(exerciseIds)]) {
    const { data: ses } = await supabase
      .from("session_exercises")
      .select("id, workout_sessions ( started_at )")
      .eq("exercise_id", exerciseId);
    if (!ses || ses.length === 0) continue;

    const startedAt = new Map(
      ses.map((s) => [s.id, s.workout_sessions?.started_at ?? ""]),
    );

    const { data: sets } = await supabase
      .from("sets")
      .select("id, weight_kg, set_number, session_exercise_id, is_pr")
      .in(
        "session_exercise_id",
        ses.map((s) => s.id),
      );
    if (!sets) continue;

    const ordered = [...sets].sort((a, b) => {
      const ta = startedAt.get(a.session_exercise_id) ?? "";
      const tb = startedAt.get(b.session_exercise_id) ?? "";
      if (ta !== tb) return ta < tb ? -1 : 1;
      return a.set_number - b.set_number;
    });

    const flags = computePRFlags(
      ordered.map((s) => ({ id: s.id, weightKg: s.weight_kg })),
    );
    const toTrue: string[] = [];
    const toFalse: string[] = [];
    for (const s of ordered) {
      const isPr = flags.get(s.id) ?? false;
      if (isPr && !s.is_pr) toTrue.push(s.id);
      else if (!isPr && s.is_pr) toFalse.push(s.id);
    }

    if (toTrue.length) await supabase.from("sets").update({ is_pr: true }).in("id", toTrue);
    if (toFalse.length) await supabase.from("sets").update({ is_pr: false }).in("id", toFalse);
  }
}
