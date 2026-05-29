import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { GOAL_LABELS, type GoalType } from "@/lib/validation";
import { kgToLbs, type Units } from "@/lib/units";
import ActivityClient, { type ActivityItem } from "./ActivityClient";

export default async function ActivityPage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();

  // Every owner-scoped table is now also readable by followers / public
  // viewers (Phase 5 RLS), so we filter by user_id explicitly on every read
  // here. `badges` is global reference data and stays unfiltered. `sets` has
  // no user_id of its own; we filter via its session's owner with an inner
  // join so only our PRs count.
  const [{ data: activities }, { data: defs }, { data: earned }, { data: goals }, { data: weights }, prCount] =
    await Promise.all([
      supabase
        .from("activity_log")
        .select("id, local_date, source, description")
        .eq("user_id", profile.id)
        .order("local_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("badges").select("code, name, description, sort_order").order("sort_order"),
      supabase
        .from("user_badges")
        .select("badge_code, earned_at")
        .eq("user_id", profile.id),
      supabase
        .from("goals")
        .select("type")
        .eq("user_id", profile.id)
        .eq("status", "active"),
      supabase
        .from("body_weights")
        .select("weight_kg, recorded_at")
        .eq("user_id", profile.id)
        .order("recorded_at"),
      supabase
        .from("sets")
        .select("id, session_exercises!inner(workout_sessions!inner(user_id))", {
          count: "exact",
          head: true,
        })
        .eq("is_pr", true)
        .eq("session_exercises.workout_sessions.user_id", profile.id),
    ]);

  const items: ActivityItem[] = (activities ?? []).map((a) => ({
    id: a.id,
    localDate: a.local_date,
    source: a.source,
    description: a.description,
  }));

  const earnedCodes = new Set((earned ?? []).map((e) => e.badge_code));
  const weightDelta =
    weights && weights.length >= 2
      ? weights[weights.length - 1].weight_kg - weights[0].weight_kg
      : null;
  const goalCards = (goals ?? []).map((g) =>
    goalProgress(g.type as GoalType, {
      currentStreak: profile.current_streak,
      longestStreak: profile.longest_streak,
      weightDeltaKg: weightDelta,
      prCount: prCount.count ?? 0,
      units: profile.units,
    }),
  );

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Activity</h1>

      {/* Streak */}
      <div className="mt-6 flex items-center justify-between rounded-lg border border-black bg-zinc-50 px-5 py-4">
        <div>
          <div className="text-3xl font-bold tabular-nums">
            🔥 {profile.current_streak}
          </div>
          <div className="text-sm text-zinc-500">
            day{profile.current_streak === 1 ? "" : "s"} in a row
          </div>
        </div>
        <div className="text-right text-sm text-zinc-500">
          Best
          <div className="text-lg font-semibold text-black tabular-nums">
            {profile.longest_streak}
          </div>
        </div>
      </div>

      <ActivityClient items={items} />

      {/* Goal progress */}
      {goalCards.length > 0 && (
        <div className="mt-10">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-zinc-500">Goal progress</h2>
            <Link href="/app/profile" className="text-xs text-zinc-400 underline hover:text-black">
              Edit goals
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {goalCards.map((c) => (
              <li
                key={c.label}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-sm text-zinc-500">{c.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Badges */}
      <div className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">
          Badges · {earnedCodes.size}/{(defs ?? []).length}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(defs ?? []).map((b) => {
            const unlocked = earnedCodes.has(b.code);
            return (
              <div
                key={b.code}
                className={`rounded-lg border px-4 py-3 ${
                  unlocked ? "border-black bg-zinc-50" : "border-zinc-200 opacity-60"
                }`}
              >
                <div className="font-medium">
                  {unlocked ? "🏅 " : "🔒 "}
                  {b.name}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{b.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function goalProgress(
  type: GoalType,
  stats: {
    currentStreak: number;
    longestStreak: number;
    weightDeltaKg: number | null;
    prCount: number;
    units: Units;
  },
): { label: string; detail: string } {
  const label = GOAL_LABELS[type];
  switch (type) {
    case "stay_consistent":
      return {
        label,
        detail: `${stats.currentStreak}-day streak · best ${stats.longestStreak}`,
      };
    case "lose_weight":
    case "build_muscle":
      return { label, detail: weightDeltaDetail(type, stats.weightDeltaKg, stats.units) };
    case "get_stronger":
      return {
        label,
        detail: stats.prCount > 0 ? `${stats.prCount} PR${stats.prCount === 1 ? "" : "s"} set` : "No PRs yet",
      };
  }
}

function weightDeltaDetail(type: GoalType, deltaKg: number | null, units: Units): string {
  if (deltaKg === null) return "Log a few weigh-ins to track this";
  const display = units === "imperial" ? kgToLbs(Math.abs(deltaKg)) : Math.abs(deltaKg);
  const rounded = Math.round(display * 10) / 10;
  const unit = units === "imperial" ? "lb" : "kg";
  if (Math.abs(deltaKg) < 0.05) return "No change yet";
  const direction = deltaKg < 0 ? "down" : "up";
  const goodDirection = type === "lose_weight" ? deltaKg < 0 : deltaKg > 0;
  return `${goodDirection ? "✓ " : ""}${rounded} ${unit} ${direction}`;
}
