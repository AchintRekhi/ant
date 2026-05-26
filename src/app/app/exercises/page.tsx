import { createClient } from "@/lib/supabase/server";
import ExercisesClient, { type ExerciseRow } from "./ExercisesClient";

export default async function ExercisesPage() {
  const supabase = await createClient();
  // RLS returns seeded exercises plus the user's own custom ones.
  const { data } = await supabase
    .from("exercises")
    .select("id, name, muscle_group, is_custom")
    .order("name");

  const exercises: ExerciseRow[] = (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group,
    isCustom: e.is_custom,
  }));

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Exercises</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Browse the library or add your own.
      </p>
      <ExercisesClient exercises={exercises} />
    </div>
  );
}
