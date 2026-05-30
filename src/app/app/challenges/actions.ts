"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { evaluateBadges } from "@/lib/badges";

export type ChallengeResult = { error?: string; ok?: boolean };

const createSchema = z.object({
  name:        z.string().trim().min(1, "Give it a name.").max(80),
  description: z.string().trim().max(280).optional(),
  privacy:     z.enum(["public", "private"]),
  metric:      z.enum(["exercise_max_weight", "exercise_total_reps"]),
  exerciseId:  z.string().uuid("Pick an exercise."),
  targetValue: z.number().positive().optional(),
  startsAt:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
  endsAt:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date."),
});
export type CreateChallengeInput = z.infer<typeof createSchema>;

/**
 * Create a challenge. The creator is auto-joined as the first participant —
 * a challenge without its creator wouldn't make sense for either privacy mode.
 */
export async function createChallenge(
  input: CreateChallengeInput,
): Promise<ChallengeResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.endsAt < d.startsAt) return { error: "End date can't be before the start date." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { data: row, error } = await supabase
    .from("challenges")
    .insert({
      creator_id:   user.id,
      name:         d.name,
      description:  d.description || null,
      privacy:      d.privacy,
      metric:       d.metric,
      exercise_id:  d.exerciseId,
      target_value: d.targetValue ?? null,
      starts_at:    d.startsAt,
      ends_at:      d.endsAt,
    })
    .select("id")
    .single();
  if (error || !row) return { error: "Couldn't create the challenge." };

  await supabase
    .from("challenge_participants")
    .insert({ challenge_id: row.id, user_id: user.id });
  await evaluateBadges(supabase, user.id);

  revalidatePath("/app/challenges");
  redirect(`/app/challenges/${row.id}`);
}

/** Join (public challenge). The RLS insert policy enforces window + privacy. */
export async function joinChallenge(challengeId: string): Promise<ChallengeResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("challenge_participants")
    .insert({ challenge_id: challengeId, user_id: user.id });
  if (error) {
    // 23505 unique_violation = already joined.
    if (error.code === "23505") return { ok: true };
    return { error: "Couldn't join the challenge." };
  }

  await evaluateBadges(supabase, user.id);
  revalidatePath(`/app/challenges/${challengeId}`);
  revalidatePath("/app/challenges");
  return { ok: true };
}

/** Leave the challenge (or, if you're the creator, kick someone). */
export async function removeParticipant(
  challengeId: string,
  userId: string,
): Promise<ChallengeResult> {
  const supabase = await createClient();
  const me = await getUser();
  if (!me) return { error: "Your session expired." };

  const { error } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", userId);
  if (error) return { error: "Couldn't update the challenge." };

  revalidatePath(`/app/challenges/${challengeId}`);
  revalidatePath("/app/challenges");
  return { ok: true };
}

/** Creator-only: invite an accepted follower to a private challenge. */
export async function inviteFollower(
  challengeId: string,
  userId: string,
): Promise<ChallengeResult> {
  const supabase = await createClient();
  const me = await getUser();
  if (!me) return { error: "Your session expired." };

  const { error } = await supabase
    .from("challenge_participants")
    .insert({ challenge_id: challengeId, user_id: userId });
  if (error) {
    if (error.code === "23505") return { ok: true };
    return { error: "Couldn't invite that follower." };
  }

  revalidatePath(`/app/challenges/${challengeId}`);
  return { ok: true };
}

/** Idempotent finalize — server-side, awards points + ranks. Safe to call
 *  on any view of an ended challenge; the SQL guards against double-running. */
export async function finalizeChallenge(challengeId: string): Promise<ChallengeResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase.rpc("finalize_challenge", { c_id: challengeId });
  if (error) return { error: "Couldn't finalize the challenge." };

  // Newly-awarded points may unlock a Champion / In-the-Arena badge for any
  // participant — evaluate for the caller (others will catch up on their
  // next page render).
  await evaluateBadges(supabase, user.id);

  revalidatePath(`/app/challenges/${challengeId}`);
  revalidatePath("/app/challenges");
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}

/** Creator-only delete. RLS enforces ownership. */
export async function deleteChallenge(challengeId: string): Promise<ChallengeResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").delete().eq("id", challengeId);
  if (error) return { error: "Couldn't delete the challenge." };

  revalidatePath("/app/challenges");
  redirect("/app/challenges");
}
