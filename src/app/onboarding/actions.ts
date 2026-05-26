"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";
import {
  onboardingSchema,
  usernameSchema,
  type OnboardingInput,
} from "@/lib/validation";

export type UsernameCheck = {
  available: boolean;
  error?: string;
};

/** Validate format and check the username isn't already taken. */
export async function checkUsername(raw: string): Promise<UsernameCheck> {
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    return { available: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { available: false, error: "Your session expired." };

  const { data, error } = await supabase.rpc("is_username_available", {
    candidate: parsed.data,
  });
  if (error) return { available: false, error: "Couldn't check that username." };

  return data
    ? { available: true }
    : { available: false, error: "That username is taken." };
}

export type OnboardingResult = { error?: string };

/**
 * Persist the full onboarding payload: fills in the profile (marking it
 * complete), records the chosen goals, and logs the first bodyweight entry.
 * Redirects into the app on success.
 */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // Re-check availability to surface a friendly message before the unique
  // constraint would reject the update.
  const { data: available } = await supabase.rpc("is_username_available", {
    candidate: data.username,
  });
  if (!available) return { error: "That username is taken." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      username: data.username,
      display_name: data.username,
      dob: data.dob,
      gender: data.gender,
      height_cm: data.heightCm,
      units: data.units,
      timezone: data.timezone,
      experience_level: data.experienceLevel,
      onboarding_complete: true,
    })
    .eq("id", user.id);

  if (profileError) {
    // 23505 = unique_violation (username raced).
    if (profileError.code === "23505") {
      return { error: "That username is taken." };
    }
    return { error: "Couldn't save your profile. Please try again." };
  }

  // Goals: one row per selected type. Idempotent on retry via the unique
  // (user_id, type) constraint.
  const { error: goalsError } = await supabase.from("goals").upsert(
    data.goals.map((type) => ({ user_id: user.id, type })),
    { onConflict: "user_id,type" },
  );
  if (goalsError) {
    return { error: "Couldn't save your goals. Please try again." };
  }

  // First bodyweight entry, feeding the trend chart in Phase 2.
  const { error: weightError } = await supabase
    .from("body_weights")
    .insert({ user_id: user.id, weight_kg: data.weightKg });
  if (weightError) {
    return { error: "Couldn't save your weight. Please try again." };
  }

  redirect("/app");
  return {};
}
