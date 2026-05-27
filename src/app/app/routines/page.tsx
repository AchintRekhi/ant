import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { weekdayLabel } from "@/lib/days";
import NewRoutine from "./NewRoutine";
import SetActiveButton from "./SetActiveButton";

export default async function RoutinesPage() {
  const supabase = await createClient();
  const { data: routines } = await supabase
    .from("routines")
    .select("id, name, is_active, routine_days(day_of_week)")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Routines</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Plan which exercises you train on each day.
      </p>

      <div className="mt-6">
        <NewRoutine />
      </div>

      <div className="mt-8 flex flex-col gap-3">
        {(routines ?? []).length === 0 ? (
          <p className="text-sm text-zinc-400">No routines yet. Create your first above.</p>
        ) : (
          routines!.map((r) => {
            const days = (r.routine_days ?? [])
              .map((d) => d.day_of_week)
              .sort((a, b) => a - b);
            return (
              <div key={r.id} className="flex items-center gap-3">
                <Link
                  href={`/app/routines/${r.id}`}
                  className="flex-1 rounded-lg border border-zinc-200 px-4 py-3 hover:border-black"
                >
                  <div className="font-medium">{r.name}</div>
                  <div className="mt-0.5 text-sm text-zinc-500">
                    {days.length === 0
                      ? "No days planned"
                      : days.map((d) => weekdayLabel(d).slice(0, 3)).join(" · ")}
                  </div>
                </Link>
                <SetActiveButton routineId={r.id} isActive={r.is_active} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
