"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

type Result = { error?: string; ok?: boolean; status?: "pending" | "accepted" };

/**
 * Follow (or request to follow) a user. Public targets become accepted
 * immediately; private targets land at `pending` and wait for approval.
 * Idempotent: re-following an existing row returns its current status.
 */
export async function followUser(targetId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };
  if (user.id === targetId) return { error: "You can't follow yourself." };

  const { data: target } = await supabase
    .from("profiles")
    .select("privacy")
    .eq("id", targetId)
    .maybeSingle();
  // If the row isn't visible to us, either the user doesn't exist or one side
  // has a block in place. Either way, treat it as not-found.
  if (!target) return { error: "User not found." };

  const status = target.privacy === "public" ? "accepted" : "pending";

  // upsert because the caller might be retrying — the existing row's status
  // is what we report back regardless.
  const { error } = await supabase
    .from("follows")
    .upsert(
      { follower_id: user.id, following_id: targetId, status },
      { onConflict: "follower_id,following_id", ignoreDuplicates: true },
    );

  if (error) return { error: "Couldn't follow this user." };

  revalidatePath(`/app/u/[username]`, "page");
  revalidatePath("/app/social");
  return { ok: true, status };
}

/** Stop following / cancel a pending request. */
export async function unfollowUser(targetId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetId);

  if (error) return { error: "Couldn't unfollow." };

  revalidatePath(`/app/u/[username]`, "page");
  revalidatePath("/app/social");
  return { ok: true };
}

/** Approve an incoming follow request. */
export async function acceptFollowRequest(followerId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("follows")
    .update({ status: "accepted" })
    .eq("follower_id", followerId)
    .eq("following_id", user.id)
    .eq("status", "pending");

  if (error) return { error: "Couldn't accept the request." };

  revalidatePath("/app/social");
  return { ok: true };
}

/** Reject (or remove) an incoming follow row. Works for both pending requests
 *  and already-accepted followers ("remove this follower"). */
export async function removeFollower(followerId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", user.id);

  if (error) return { error: "Couldn't update the request." };

  revalidatePath("/app/social");
  return { ok: true };
}

/**
 * Block a user. Also clears any follow rows in either direction so the
 * relationship is fully severed — a stale follow + a block would leave the
 * UI inconsistent.
 */
export async function blockUser(targetId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };
  if (user.id === targetId) return { error: "You can't block yourself." };

  const { error: blockError } = await supabase
    .from("blocks")
    .upsert(
      { blocker_id: user.id, blocked_id: targetId },
      { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
    );
  if (blockError) return { error: "Couldn't block this user." };

  // Drop any follow rows in either direction. RLS lets us delete rows where
  // we're either side, so this single call covers both.
  await supabase
    .from("follows")
    .delete()
    .or(
      `and(follower_id.eq.${user.id},following_id.eq.${targetId}),` +
        `and(follower_id.eq.${targetId},following_id.eq.${user.id})`,
    );

  revalidatePath(`/app/u/[username]`, "page");
  revalidatePath("/app/social");
  return { ok: true };
}

/** Lift a previously-applied block. */
export async function unblockUser(targetId: string): Promise<Result> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetId);

  if (error) return { error: "Couldn't unblock." };

  revalidatePath(`/app/u/[username]`, "page");
  revalidatePath("/app/social");
  return { ok: true };
}
