"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/auth/dal";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validation";
import { AVATAR_BUCKET, avatarObjectPath } from "@/lib/storage";

export type SaveResult = { error?: string; ok?: boolean };

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Update the profile fields and reconcile the user's goal set. Username
 * availability is only re-checked when it actually changed (the RPC would
 * otherwise report the user's own current username as taken).
 */
export async function updateProfile(
  input: ProfileUpdateInput,
): Promise<SaveResult> {
  const parsed = profileUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const current = await getProfile();
  if (current?.username !== data.username) {
    const { data: available } = await supabase.rpc("is_username_available", {
      candidate: data.username,
    });
    if (!available) return { error: "That username is taken." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      username: data.username,
      display_name: data.displayName,
      bio: data.bio || null,
      gender: data.gender,
      height_cm: data.heightCm,
      units: data.units,
      privacy: data.privacy,
      experience_level: data.experienceLevel,
    })
    .eq("id", user.id);

  if (profileError) {
    if (profileError.code === "23505") return { error: "That username is taken." };
    return { error: "Couldn't save your profile. Please try again." };
  }

  // Reconcile goals to match the selection: add the chosen ones (idempotent),
  // then drop any that were deselected. Upsert preserves fields a later phase
  // may set (target_value, status) on goals that stay selected.
  const { error: upsertError } = await supabase.from("goals").upsert(
    data.goals.map((type) => ({ user_id: user.id, type })),
    { onConflict: "user_id,type" },
  );
  if (upsertError) return { error: "Couldn't save your goals. Please try again." };

  const { error: deleteError } = await supabase
    .from("goals")
    .delete()
    .eq("user_id", user.id)
    .not("type", "in", `(${data.goals.join(",")})`);
  if (deleteError) return { error: "Couldn't save your goals. Please try again." };

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Upload a new avatar to the user's private folder and point the profile at it.
 * The upload runs through the user's session client, so the storage RLS policy
 * (owner-only) is the real guard.
 */
export async function updateAvatar(formData: FormData): Promise<SaveResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Use a JPEG, PNG, or WebP image." };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Image must be under 5 MB." };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const path = avatarObjectPath(user.id);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: "Upload failed. Please try again." };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", user.id);
  if (profileError) return { error: "Couldn't save your avatar." };

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}
