import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { weekdayLabel, todayWeekday } from "@/lib/days";
import { activeSeconds, formatDuration } from "@/lib/duration";
import StartWorkout, { type RoutineOption } from "./StartWorkout";

export default async function WorkoutPage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();

  // Phase 5 added a "viewers can read public users' rows" SELECT policy on
  // every owner-scoped table, so RLS alone no longer scopes these reads to
  // the current user — we have to filter by user_id explicitly on every page
  // that shows "my" data.
  const { data: routinesRaw } = await supabase
    .from("routines")
    .select("id, name, is_active, routine_days ( id, day_of_week, label )")
    .eq("user_id", profile.id)
    .order("name");

  const routines: RoutineOption[] = (routinesRaw ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    days: (r.routine_days ?? [])
      .map((d) => ({ id: d.id, dayOfWeek: d.day_of_week, label: d.label ?? "" }))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  }));

  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select(
      `id, started_at, ended_at, paused_at, total_paused_seconds,
       routine_days ( label ),
       session_exercises ( id, sets ( is_pr ) )`,
    )
    .eq("user_id", profile.id)
    .order("started_at", { ascending: false })
    .limit(30);

  const today = todayWeekday(profile.timezone);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Train</h1>

      <nav className="mt-4 flex flex-wrap gap-2">
        {[
          { href: "/app/progress", label: "Progress" },
          { href: "/app/routines", label: "Routines" },
          { href: "/app/exercises", label: "Exercises" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:border-black"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        <StartWorkout routines={routines} today={today} />
      </div>

      <h2 className="mb-3 mt-10 text-sm font-medium text-zinc-500">History</h2>
      {(sessions ?? []).length === 0 ? (
        <p className="text-sm text-zinc-400">No workouts logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions!.map((s) => {
            const exerciseCount = s.session_exercises?.length ?? 0;
            const prCount =
              s.session_exercises?.reduce(
                (acc, se) => acc + (se.sets?.filter((x) => x.is_pr).length ?? 0),
                0,
              ) ?? 0;
            const inProgress = !s.ended_at;
            const duration = inProgress
              ? null
              : formatDuration(
                  activeSeconds(
                    {
                      startedAt: s.started_at,
                      endedAt: s.ended_at,
                      pausedAt: s.paused_at,
                      totalPausedSeconds: s.total_paused_seconds,
                    },
                    Date.now(),
                  ),
                );
            return (
              <li key={s.id}>
                <Link
                  href={`/app/workout/${s.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:border-black"
                >
                  <div>
                    <div className="font-medium">
                      {s.routine_days?.label || "Freestyle"}
                      {inProgress && (
                        <span className="ml-2 rounded-full bg-black px-2 py-0.5 text-xs text-white">
                          In progress
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-500">
                      {formatDate(s.started_at)} · {exerciseCount} exercise
                      {exerciseCount === 1 ? "" : "s"}
                      {duration ? ` · ${duration}` : ""}
                    </div>
                  </div>
                  {prCount > 0 && (
                    <span className="rounded-full bg-zinc-900 px-2 py-1 text-xs font-medium text-white">
                      {prCount} PR{prCount === 1 ? "" : "s"}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {routines
        .find((r) => r.isActive)
        ?.days.some((d) => d.dayOfWeek === today) && (
        <p className="mt-6 text-xs text-zinc-400">
          Today is {weekdayLabel(today)}.
        </p>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
