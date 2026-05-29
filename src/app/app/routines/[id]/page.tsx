import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { MuscleGroup } from "@/lib/exercises";
import RoutineEditor, {
  type RoutineDayData,
  type LibraryExercise,
} from "./RoutineEditor";

export default async function RoutineEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireOnboardedProfile();
  const supabase = await createClient();

  // Scope to the signed-in user — without this, the URL of a public user's
  // routine would open the editor as if it were our own.
  const { data: routine } = await supabase
    .from("routines")
    .select(
      `id, name,
       routine_days (
         id, day_of_week, label,
         routine_day_exercises (
           id, exercise_id, target_sets, target_reps, sort_order,
           exercises ( name, muscle_group )
         )
       )`,
    )
    .eq("id", id)
    .eq("user_id", me.id)
    .maybeSingle();

  if (!routine) notFound();

  const { data: lib } = await supabase
    .from("exercises")
    .select("id, name, muscle_group")
    .order("name");
  const library: LibraryExercise[] = (lib ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group as MuscleGroup,
  }));

  const days: RoutineDayData[] = (routine.routine_days ?? []).map((d) => ({
    id: d.id,
    dayOfWeek: d.day_of_week,
    label: d.label ?? "",
    exercises: (d.routine_day_exercises ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((rde) => ({
        id: rde.id,
        exerciseId: rde.exercise_id,
        name: rde.exercises?.name ?? "Unknown",
        targetSets: rde.target_sets,
        targetReps: rde.target_reps,
      })),
  }));

  return (
    <RoutineEditor
      routineId={routine.id}
      routineName={routine.name}
      days={days}
      library={library}
    />
  );
}
