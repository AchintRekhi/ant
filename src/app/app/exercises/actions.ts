"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { MUSCLE_GROUPS } from "@/lib/exercises";

const MUSCLE_VALUES = MUSCLE_GROUPS.map((g) => g.value) as [string, ...string[]];

const customExerciseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(60, { message: "Keep the name under 60 characters." }),
  muscleGroup: z.enum(MUSCLE_VALUES),
});

export type ExerciseResult = { error?: string; ok?: boolean };

export async function createCustomExercise(input: {
  name: string;
  muscleGroup: string;
}): Promise<ExerciseResult> {
  const parsed = customExerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase.from("exercises").insert({
    name: parsed.data.name,
    muscle_group: parsed.data.muscleGroup as never,
    is_custom: true,
    created_by: user.id,
  });

  if (error) {
    // Unique index on (created_by, lower(name)) for custom rows.
    if (error.code === "23505") {
      return { error: "You already have an exercise with that name." };
    }
    return { error: "Couldn't add that exercise. Please try again." };
  }

  revalidatePath("/app/exercises");
  return { ok: true };
}

export async function deleteCustomExercise(id: string): Promise<ExerciseResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  // RLS already restricts deletes to the user's own custom rows; the eq is belt-and-suspenders.
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) {
    // 23503 = foreign_key_violation: the exercise is referenced by logged history.
    if (error.code === "23503") {
      return {
        error: "This exercise is used in a routine or logged workout, so it can't be deleted.",
      };
    }
    return { error: "Couldn't delete that exercise." };
  }

  revalidatePath("/app/exercises");
  return { ok: true };
}
