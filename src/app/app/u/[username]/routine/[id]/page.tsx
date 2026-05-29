import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { canViewUser } from "@/lib/social";
import { weekdayLabel } from "@/lib/days";

type Params = Promise<{ username: string; id: string }>;

/**
 * Read-only routine view for a follower. Same shape as the owner's editor at
 * /app/routines/[id] but without any controls — just the planned weekdays
 * and the exercises (with target sets × reps) inside each day.
 */
export default async function PublicRoutinePage({ params }: { params: Params }) {
  await requireOnboardedProfile();
  const { username, id } = await params;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (!target) notFound();
  if (!(await canViewUser(target.id))) notFound();

  const { data: routine } = await supabase
    .from("routines")
    .select(
      `id, name, user_id,
       routine_days (
         id, day_of_week, label,
         routine_day_exercises (
           id, target_sets, target_reps, sort_order,
           exercises ( name, muscle_group )
         )
       )`,
    )
    .eq("id", id)
    .eq("user_id", target.id)
    .maybeSingle();
  if (!routine) notFound();

  const days = (routine.routine_days ?? [])
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="text-sm">
        <Link href={`/app/u/${target.username}`} className="text-zinc-500 underline">
          ← @{target.username}
        </Link>
      </div>

      <h1 className="mt-2 text-2xl font-bold tracking-tight">{routine.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {days.length === 0
          ? "No days planned yet."
          : days.map((d) => weekdayLabel(d.day_of_week).slice(0, 3)).join(" · ")}
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {days.map((d) => {
          const items = (d.routine_day_exercises ?? [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order);
          return (
            <section key={d.id}>
              <h2 className="text-base font-semibold">
                {weekdayLabel(d.day_of_week)}
                {d.label && (
                  <span className="ml-2 text-sm font-normal text-zinc-500">· {d.label}</span>
                )}
              </h2>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-400">No exercises planned.</p>
              ) : (
                <ul className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
                  {items.map((rde) => (
                    <li key={rde.id} className="flex items-center justify-between py-2">
                      <span>{rde.exercises?.name ?? "Unknown"}</span>
                      <span className="text-zinc-500 tabular-nums">
                        {rde.target_sets && rde.target_reps
                          ? `${rde.target_sets} × ${rde.target_reps}`
                          : rde.target_sets
                            ? `${rde.target_sets} sets`
                            : rde.target_reps
                              ? `× ${rde.target_reps}`
                              : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
