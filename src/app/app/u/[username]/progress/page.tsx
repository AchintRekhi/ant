import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { kgToLbs } from "@/lib/units";
import { canViewUser } from "@/lib/social";
import type { ProgressPoint } from "@/components/ExerciseProgressChart";
import ProgressClient, { type ExerciseSeries } from "../../../progress/ProgressClient";

type Params = Promise<{ username: string }>;

/**
 * Viewer-facing progress page for another user. Mirrors /app/progress but
 * scoped to a username; falls back to "not found" when the target is hidden
 * (no profile, blocked, or private + non-follower). Units come from the
 * viewer's preference because that's what they read in.
 */
export default async function PublicProgressPage({ params }: { params: Params }) {
  const viewer = await requireOnboardedProfile();
  const { username } = await params;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!target) notFound();

  const allowed = await canViewUser(target.id);
  if (!allowed) notFound();

  const { data } = await supabase
    .from("session_exercises")
    .select(
      `exercise_id,
       exercises ( name ),
       workout_sessions!inner ( user_id, started_at ),
       sets ( weight_kg, is_pr )`,
    )
    .eq("workout_sessions.user_id", target.id);

  const me = await getProfile();
  const isImperial = (me ?? viewer).units === "imperial";
  const toDisplay = (kg: number) =>
    isImperial ? Math.round(kgToLbs(kg) * 10) / 10 : Math.round(kg * 10) / 10;

  // Same shaping as the owner's progress page: one weight-over-time series
  // per exercise, plotting the heaviest set of each session.
  const map = new Map<string, { name: string; points: ProgressPoint[] }>();
  for (const se of data ?? []) {
    const started = se.workout_sessions?.started_at;
    const sets = se.sets ?? [];
    if (!started || sets.length === 0) continue;
    const topKg = Math.max(...sets.map((s) => s.weight_kg));
    if (topKg <= 0) continue;
    map.set(se.exercise_id, {
      name: se.exercises?.name ?? "Unknown",
      points: [
        ...(map.get(se.exercise_id)?.points ?? []),
        { t: new Date(started).getTime(), value: toDisplay(topKg), isPr: sets.some((s) => s.is_pr) },
      ],
    });
  }

  const series: ExerciseSeries[] = [...map.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      points: v.points.sort((a, b) => a.t - b.t),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="text-sm">
        <Link href={`/app/u/${target.username}`} className="text-zinc-500 underline">
          ← @{target.username}
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Progress</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Their heaviest set per workout, with PRs marked.
      </p>
      <ProgressClient series={series} unit={isImperial ? "lb" : "kg"} />
    </div>
  );
}
