"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

export type RoutineResult = { error?: string; ok?: boolean };

const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Enter a name." })
  .max(60, { message: "Keep the name under 60 characters." });

/** Create a routine and go straight to its editor. */
export async function createRoutine(name: string): Promise<RoutineResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { data, error } = await supabase
    .from("routines")
    .insert({ user_id: user.id, name: parsed.data })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the routine." };

  revalidatePath("/app/routines");
  redirect(`/app/routines/${data.id}`);
}

/** Make this the user's single active routine (deactivates the rest). */
export async function setActiveRoutine(id: string): Promise<RoutineResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  // Clear the others first — the partial unique index forbids two active at once.
  const { error: e1 } = await supabase
    .from("routines")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .neq("id", id);
  if (e1) return { error: "Couldn't update your routines." };

  const { error: e2 } = await supabase
    .from("routines")
    .update({ is_active: true })
    .eq("id", id);
  if (e2) return { error: "Couldn't set the active routine." };

  revalidatePath("/app/routines");
  revalidatePath("/app/workout");
  return { ok: true };
}

export async function renameRoutine(id: string, name: string): Promise<RoutineResult> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("routines")
    .update({ name: parsed.data })
    .eq("id", id);
  if (error) return { error: "Couldn't rename the routine." };

  revalidatePath(`/app/routines/${id}`);
  revalidatePath("/app/routines");
  return { ok: true };
}

export async function deleteRoutine(id: string): Promise<RoutineResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the routine." };

  revalidatePath("/app/routines");
  redirect("/app/routines");
}

/** Create the routine_day for a weekday if it doesn't exist, or update its label. */
export async function setRoutineDay(
  routineId: string,
  dayOfWeek: number,
  label: string,
): Promise<RoutineResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("routine_days")
    .upsert(
      { routine_id: routineId, day_of_week: dayOfWeek, label: label.trim() || null },
      { onConflict: "routine_id,day_of_week" },
    );
  if (error) return { error: "Couldn't save that day." };

  revalidatePath(`/app/routines/${routineId}`);
  return { ok: true };
}

export async function removeRoutineDay(
  routineId: string,
  dayId: string,
): Promise<RoutineResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("routine_days").delete().eq("id", dayId);
  if (error) return { error: "Couldn't remove that day." };

  revalidatePath(`/app/routines/${routineId}`);
  return { ok: true };
}

const assignSchema = z.object({
  dayId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  targetSets: z.number().int().min(1).max(20).nullable(),
  targetReps: z.number().int().min(1).max(100).nullable(),
});

export async function addExerciseToDay(
  routineId: string,
  input: {
    dayId: string;
    exerciseId: string;
    targetSets: number | null;
    targetReps: number | null;
  },
): Promise<RoutineResult> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the sets and reps." };

  const supabase = await createClient();

  // Append after the day's existing exercises.
  const { count } = await supabase
    .from("routine_day_exercises")
    .select("id", { count: "exact", head: true })
    .eq("routine_day_id", parsed.data.dayId);

  const { error } = await supabase.from("routine_day_exercises").insert({
    routine_day_id: parsed.data.dayId,
    exercise_id: parsed.data.exerciseId,
    target_sets: parsed.data.targetSets,
    target_reps: parsed.data.targetReps,
    sort_order: count ?? 0,
  });
  if (error) return { error: "Couldn't add that exercise." };

  revalidatePath(`/app/routines/${routineId}`);
  return { ok: true };
}

export async function removeExerciseFromDay(
  routineId: string,
  rdeId: string,
): Promise<RoutineResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("routine_day_exercises")
    .delete()
    .eq("id", rdeId);
  if (error) return { error: "Couldn't remove that exercise." };

  revalidatePath(`/app/routines/${routineId}`);
  return { ok: true };
}
