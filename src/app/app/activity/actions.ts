"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/dal";
import { localDateInTz } from "@/lib/days";
import { recomputeStreak } from "@/lib/streak";
import { evaluateBadges } from "@/lib/badges";

export type ActivityResult = { error?: string; ok?: boolean };

const descriptionSchema = z.string().trim().min(1).max(120);

/** Quick-log any physical activity ("50 pushups"). Counts toward the streak. */
export async function quickLogActivity(description: string): Promise<ActivityResult> {
  const parsed = descriptionSchema.safeParse(description);
  if (!parsed.success) return { error: 'Describe the activity (e.g. "50 pushups").' };

  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Your session expired." };

  const { error } = await supabase.from("activity_log").insert({
    user_id: profile.id,
    local_date: localDateInTz(new Date(), profile.timezone),
    source: "quick",
    description: parsed.data,
  });
  if (error) return { error: "Couldn't log that activity." };

  await recomputeStreak(supabase, profile.id, profile.timezone);
  await evaluateBadges(supabase, profile.id);

  revalidatePath("/app/activity");
  revalidatePath("/app");
  return { ok: true };
}

/** Remove a quick-logged activity (session-derived rows are managed by the session). */
export async function deleteActivity(id: string): Promise<ActivityResult> {
  const supabase = await createClient();
  const profile = await getProfile();
  if (!profile) return { error: "Your session expired." };

  const { error } = await supabase
    .from("activity_log")
    .delete()
    .eq("id", id)
    .eq("source", "quick");
  if (error) return { error: "Couldn't remove that activity." };

  await recomputeStreak(supabase, profile.id, profile.timezone);

  revalidatePath("/app/activity");
  revalidatePath("/app");
  return { ok: true };
}
