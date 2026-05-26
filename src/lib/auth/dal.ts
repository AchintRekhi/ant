import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;

/**
 * The Data Access Layer for auth. Every server-side data request that needs the
 * current user should go through here so the session check is never forgotten.
 * `cache()` memoizes the result for a single render pass to avoid duplicate calls.
 */

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
});

/** Require a signed-in user, or redirect to /login. Returns the auth user. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a signed-in user whose onboarding is complete. Redirects to /login if
 * not signed in, or to /onboarding if the profile is unfinished. Use this to
 * guard the main app area.
 */
export async function requireOnboardedProfile(): Promise<Profile> {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarding_complete) redirect("/onboarding");
  return profile;
}
