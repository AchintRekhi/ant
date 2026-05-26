"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import { bodyWeightSchema, type BodyWeightInput } from "@/lib/validation";

export type WeightResult = { error?: string; ok?: boolean };

/** Log a bodyweight entry. An optional date is stored at noon UTC so it lands
 *  on the intended calendar day regardless of the viewer's timezone. */
export async function addBodyWeight(
  input: BodyWeightInput,
): Promise<WeightResult> {
  const parsed = bodyWeightSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { weightKg, recordedDate } = parsed.data;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const row: { user_id: string; weight_kg: number; recorded_at?: string } = {
    user_id: user.id,
    weight_kg: weightKg,
  };
  if (recordedDate) row.recorded_at = `${recordedDate}T12:00:00Z`;

  const { error } = await supabase.from("body_weights").insert(row);
  if (error) return { error: "Couldn't save that entry. Please try again." };

  revalidatePath("/app/bodyweight");
  revalidatePath("/app");
  return { ok: true };
}

/** Delete one of the user's bodyweight entries. RLS scopes this to the owner. */
export async function deleteBodyWeight(id: string): Promise<WeightResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("body_weights")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't delete that entry." };

  revalidatePath("/app/bodyweight");
  revalidatePath("/app");
  return { ok: true };
}
