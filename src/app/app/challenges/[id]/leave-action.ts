"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

/** Leave a challenge as the current user. Thin wrapper over removeParticipant
 *  so the client doesn't need to know its own user id to call the action. */
export async function leaveChallenge(challengeId: string) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't leave the challenge." };

  revalidatePath(`/app/challenges/${challengeId}`);
  revalidatePath("/app/challenges");
  return { ok: true };
}
