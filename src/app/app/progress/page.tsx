import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { kgToLbs } from "@/lib/units";
import type { ProgressPoint } from "@/components/ExerciseProgressChart";
import ProgressClient, { type ExerciseSeries } from "./ProgressClient";

export default async function ProgressPage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("session_exercises")
    .select(
      `exercise_id,
       exercises ( name ),
       workout_sessions ( started_at ),
       sets ( weight_kg, is_pr )`,
    );

  const isImperial = profile.units === "imperial";
  const toDisplay = (kg: number) =>
    isImperial ? Math.round(kgToLbs(kg) * 10) / 10 : Math.round(kg * 10) / 10;

  // Group into one weight-over-time series per exercise (heaviest set per session).
  const map = new Map<string, { name: string; points: ProgressPoint[] }>();
  for (const se of data ?? []) {
    const started = se.workout_sessions?.started_at;
    const sets = se.sets ?? [];
    if (!started || sets.length === 0) continue;
    const topKg = Math.max(...sets.map((s) => s.weight_kg));
    if (topKg <= 0) continue; // weight-based progress only
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
      <h1 className="text-2xl font-bold tracking-tight">Progress</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Your heaviest set per workout, with PRs marked.
      </p>
      <ProgressClient series={series} unit={isImperial ? "lb" : "kg"} />
    </div>
  );
}
