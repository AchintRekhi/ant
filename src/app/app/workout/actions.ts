"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { recomputePRsForExercises } from "@/lib/pr";

export type WorkoutResult = { error?: string; ok?: boolean };

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_BUCKET = "workout-photos";

/**
 * Start a session. When seeded from a routine day, copy that day's exercises
 * (in order) into the session so the user can start logging straight away.
 * Redirects to the live session.
 */
export async function startSession(routineDayId: string | null): Promise<WorkoutResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { data: session, error } = await supabase
    .from("workout_sessions")
    .insert({ user_id: user.id, routine_day_id: routineDayId })
    .select("id")
    .single();
  if (error || !session) return { error: "Couldn't start the workout." };

  if (routineDayId) {
    const { data: planned } = await supabase
      .from("routine_day_exercises")
      .select("exercise_id, sort_order")
      .eq("routine_day_id", routineDayId)
      .order("sort_order");
    if (planned && planned.length > 0) {
      await supabase.from("session_exercises").insert(
        planned.map((p) => ({
          session_id: session.id,
          exercise_id: p.exercise_id,
          sort_order: p.sort_order,
        })),
      );
    }
  }

  redirect(`/app/workout/${session.id}`);
}

export async function addSessionExercise(
  sessionId: string,
  exerciseId: string,
): Promise<WorkoutResult> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("session_exercises")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const { error } = await supabase.from("session_exercises").insert({
    session_id: sessionId,
    exercise_id: exerciseId,
    sort_order: count ?? 0,
  });
  if (error) return { error: "Couldn't add that exercise." };

  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

export async function removeSessionExercise(
  sessionId: string,
  seId: string,
): Promise<WorkoutResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("session_exercises").delete().eq("id", seId);
  if (error) return { error: "Couldn't remove that exercise." };

  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

const setSchema = z.object({
  reps: z.number().int().min(0).max(1000),
  weightKg: z.number().min(0).max(1000),
});

/** Append a set to a session exercise. `weightKg` is already metric. */
export async function addSet(
  sessionId: string,
  seId: string,
  input: { reps: number; weightKg: number },
): Promise<WorkoutResult> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the reps and weight." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("sets")
    .select("set_number")
    .eq("session_exercise_id", seId)
    .order("set_number", { ascending: false })
    .limit(1);
  const nextNumber = (existing?.[0]?.set_number ?? 0) + 1;

  const { error } = await supabase.from("sets").insert({
    session_exercise_id: seId,
    set_number: nextNumber,
    reps: parsed.data.reps,
    weight_kg: parsed.data.weightKg,
    is_pr: false,
  });
  if (error) return { error: "Couldn't add that set." };

  await recomputeIfFinished(supabase, seId);
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

export async function updateSet(
  sessionId: string,
  setId: string,
  input: { reps: number; weightKg: number },
): Promise<WorkoutResult> {
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the reps and weight." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("sets")
    .update({ reps: parsed.data.reps, weight_kg: parsed.data.weightKg })
    .eq("id", setId)
    .select("session_exercise_id")
    .single();
  if (!row) return { error: "Couldn't save that set." };

  await recomputeIfFinished(supabase, row.session_exercise_id);
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

export async function removeSet(sessionId: string, setId: string): Promise<WorkoutResult> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("sets")
    .delete()
    .eq("id", setId)
    .select("session_exercise_id")
    .single();

  if (row) await recomputeIfFinished(supabase, row.session_exercise_id);
  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

export async function saveNotes(sessionId: string, notes: string): Promise<WorkoutResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_sessions")
    .update({ notes: notes.trim() || null })
    .eq("id", sessionId);
  if (error) return { error: "Couldn't save your notes." };
  return { ok: true };
}

/** Finish the session (stamp ended_at) and flag PRs across its exercises. */
export async function finishSession(sessionId: string): Promise<WorkoutResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("workout_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) return { error: "Couldn't finish the workout." };

  const { data: ses } = await supabase
    .from("session_exercises")
    .select("exercise_id")
    .eq("session_id", sessionId);
  await recomputePRsForExercises(supabase, (ses ?? []).map((s) => s.exercise_id));

  revalidatePath("/app/workout");
  revalidatePath(`/app/workout/${sessionId}`);
  redirect(`/app/workout/${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<WorkoutResult> {
  const supabase = await createClient();

  // Note the exercises so PRs can be recomputed after the session is gone.
  const { data: ses } = await supabase
    .from("session_exercises")
    .select("exercise_id")
    .eq("session_id", sessionId);
  const exerciseIds = (ses ?? []).map((s) => s.exercise_id);

  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId);
  if (error) return { error: "Couldn't delete the workout." };

  await recomputePRsForExercises(supabase, exerciseIds);
  revalidatePath("/app/workout");
  redirect("/app/workout");
}

export async function uploadSessionPhoto(formData: FormData): Promise<WorkoutResult> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const file = formData.get("photo");
  if (!sessionId) return { error: "Missing session." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return { error: "Use a JPEG, PNG, or WebP image." };
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo must be under 8 MB." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const path = `${user.id}/${sessionId}`;
  const { error: upErr } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { error: "Upload failed. Please try again." };

  const { error } = await supabase
    .from("workout_sessions")
    .update({ photo_url: path })
    .eq("id", sessionId);
  if (error) return { error: "Couldn't attach the photo." };

  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

export async function removeSessionPhoto(sessionId: string): Promise<WorkoutResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  await supabase.storage.from(PHOTO_BUCKET).remove([`${user.id}/${sessionId}`]);
  await supabase.from("workout_sessions").update({ photo_url: null }).eq("id", sessionId);

  revalidatePath(`/app/workout/${sessionId}`);
  return { ok: true };
}

/** Recompute PRs for a set's exercise, but only once its session is finished. */
async function recomputeIfFinished(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seId: string,
): Promise<void> {
  const { data } = await supabase
    .from("session_exercises")
    .select("exercise_id, workout_sessions ( ended_at )")
    .eq("id", seId)
    .single();
  if (data?.workout_sessions?.ended_at) {
    await recomputePRsForExercises(supabase, [data.exercise_id]);
  }
}
