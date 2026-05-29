import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutPhotoUrl } from "@/lib/storage";
import { canViewUser } from "@/lib/social";
import { activeSeconds, formatDuration } from "@/lib/duration";
import { formatWeight } from "@/lib/units";

type Params = Promise<{ username: string; id: string }>;

/**
 * Read-only view of someone else's finished workout: exercises, sets, total
 * active duration, notes and the session photo (when present). Owner-side
 * /app/workout/[id] is the edit surface — this page never mutates anything,
 * and falls back to not-found whenever the session is hidden by RLS.
 */
export default async function PublicWorkoutPage({ params }: { params: Params }) {
  const viewer = await requireOnboardedProfile();
  const { username, id } = await params;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!target) notFound();
  if (!(await canViewUser(target.id))) notFound();

  const { data: session } = await supabase
    .from("workout_sessions")
    .select(
      `id, user_id, started_at, ended_at, paused_at, total_paused_seconds, notes, photo_url,
       routine_days ( label ),
       session_exercises (
         id, sort_order,
         exercises ( name, muscle_group ),
         sets ( id, set_number, reps, weight_kg, is_pr )
       )`,
    )
    .eq("id", id)
    .eq("user_id", target.id)
    .maybeSingle();
  if (!session) notFound();

  const me = await getProfile();
  const units = (me ?? viewer).units;
  const photoUrl = await getWorkoutPhotoUrl(session.photo_url);

  // Display the active (non-paused) duration. If the session was never
  // finished we fall back to elapsed-up-to-now, but those shouldn't appear
  // here because the recent-workouts list filters to `ended_at IS NOT NULL`.
  const duration = activeSeconds(
    {
      startedAt: session.started_at,
      endedAt: session.ended_at,
      pausedAt: session.paused_at,
      totalPausedSeconds: session.total_paused_seconds,
    },
    Date.now(),
  );

  const exercises = (session.session_exercises ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  const date = new Date(session.started_at).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="text-sm">
        <Link href={`/app/u/${target.username}`} className="text-zinc-500 underline">
          ← @{target.username}
        </Link>
      </div>

      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {session.routine_days?.label || "Freestyle"}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {date} · {formatDuration(duration)} · {exercises.length} exercise
        {exercises.length === 1 ? "" : "s"}
      </p>

      {photoUrl && (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" className="w-full" />
        </div>
      )}

      {session.notes && (
        <p className="mt-6 whitespace-pre-line rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          {session.notes}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {exercises.length === 0 ? (
          <p className="text-sm text-zinc-400">No exercises were logged.</p>
        ) : (
          exercises.map((se) => {
            const sets = (se.sets ?? []).slice().sort((a, b) => a.set_number - b.set_number);
            return (
              <section key={se.id}>
                <h2 className="text-base font-semibold">{se.exercises?.name ?? "Unknown"}</h2>
                {se.exercises?.muscle_group && (
                  <p className="text-xs uppercase tracking-wider text-zinc-400">
                    {se.exercises.muscle_group.replace("_", " ")}
                  </p>
                )}
                {sets.length === 0 ? (
                  <p className="mt-2 text-sm text-zinc-400">No sets recorded.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
                    {sets.map((s) => (
                      <li key={s.id} className="flex items-center justify-between py-2">
                        <span className="text-zinc-500">Set {s.set_number}</span>
                        <span className="font-medium tabular-nums">
                          {s.reps} × {formatWeight(s.weight_kg, units)}
                          {s.is_pr && (
                            <span className="ml-2 rounded-full border border-black px-2 py-0.5 text-[10px] uppercase tracking-wider">
                              PR
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
