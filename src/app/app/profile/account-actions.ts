"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser, getProfile } from "@/lib/auth/dal";
import { AVATAR_BUCKET, WORKOUT_PHOTO_BUCKET } from "@/lib/storage";

export type DeleteResult = { error?: string };

/**
 * Hard-delete the signed-in user's account and all their data. Destructive and
 * irreversible, so the form makes the user re-type their exact username to
 * confirm.
 *
 * Order matters. Every owner table cascades from auth.users, so deleting the
 * auth user wipes the bulk of it — but `session_exercises → exercises` is
 * ON DELETE RESTRICT, and a user's custom exercises are only ever referenced by
 * their own sessions. So we drop their sessions first (cascading the set rows),
 * then their custom exercises, leaving the auth-user delete free to cascade the
 * remainder (profile, goals, body_weights, routines, activity_log, badges,
 * follows, blocks, challenges, …).
 *
 * Storage objects aren't in Postgres, so we sweep the user's folder out of both
 * buckets explicitly. Uses the service-role client throughout — RLS can't
 * authorise reaching into auth.users, and a half-deleted session would block it.
 */
export async function deleteAccount(
  _prev: DeleteResult | null,
  formData: FormData,
): Promise<DeleteResult> {
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const profile = await getProfile();
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (!profile?.username || confirm !== profile.username) {
    return { error: "Type your username exactly to confirm." };
  }

  const admin = createAdminClient();

  // 1. Sweep storage: everything under {userId}/ in both buckets.
  for (const bucket of [AVATAR_BUCKET, WORKOUT_PHOTO_BUCKET]) {
    const { data: files } = await admin.storage.from(bucket).list(user.id);
    if (files && files.length > 0) {
      await admin.storage
        .from(bucket)
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  }

  // 2. Sessions before custom exercises (see the RESTRICT note above).
  await admin.from("workout_sessions").delete().eq("user_id", user.id);
  await admin.from("exercises").delete().eq("created_by", user.id);

  // 3. The auth user — cascades everything else.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: "Couldn't delete your account. Please try again." };
  }

  // 4. Clear the now-orphaned session cookies, then leave.
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
