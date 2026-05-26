import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutPhotoUrl } from "@/lib/storage";
import type { MuscleGroup } from "@/lib/exercises";
import WorkoutSession, {
  type SessionExerciseData,
  type LibraryExercise,
} from "./WorkoutSession";

export default async function WorkoutSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select(
      `id, started_at, ended_at, notes, photo_url,
       routine_days ( label ),
       session_exercises (
         id, exercise_id, sort_order,
         exercises ( name ),
         sets ( id, set_number, reps, weight_kg, is_pr )
       )`,
    )
    .eq("id", id)
    .single();

  if (!session) notFound();

  const exercises: SessionExerciseData[] = (session.session_exercises ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((se) => ({
      id: se.id,
      exerciseId: se.exercise_id,
      name: se.exercises?.name ?? "Unknown",
      sets: (se.sets ?? [])
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          id: s.id,
          setNumber: s.set_number,
          reps: s.reps,
          weightKg: s.weight_kg,
          isPr: s.is_pr,
        })),
    }));

  const { data: lib } = await supabase
    .from("exercises")
    .select("id, name, muscle_group")
    .order("name");
  const library: LibraryExercise[] = (lib ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscle_group as MuscleGroup,
  }));

  const photoUrl = await getWorkoutPhotoUrl(session.photo_url);

  return (
    <WorkoutSession
      sessionId={session.id}
      startedAt={session.started_at}
      endedAt={session.ended_at}
      title={session.routine_days?.label || "Freestyle"}
      notes={session.notes ?? ""}
      photoUrl={photoUrl}
      units={profile.units}
      exercises={exercises}
      library={library}
    />
  );
}
