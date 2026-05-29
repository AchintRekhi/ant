import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

// Relationship between the viewer and a target user, as seen by the UI: drives
// which CTA to render on a profile (Follow / Requested / Following / Yourself).
export type Relationship =
  | "self"
  | "blocked_by_me"
  | "none"
  | "requested"
  | "following";

export type ProfileCard = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  privacy: "public" | "private";
};

/**
 * Resolve viewer ↔ target relationship from the viewer's side. Self check is
 * cheap; for everyone else we read `blocks` and `follows` once. Blocks are
 * checked first because they win over any follow row that hasn't been cleaned
 * up yet.
 */
export async function getRelationship(targetId: string): Promise<Relationship> {
  const viewer = await getUser();
  if (!viewer) return "none";
  if (viewer.id === targetId) return "self";

  const supabase = await createClient();

  const { data: iBlocked } = await supabase
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", viewer.id)
    .eq("blocked_id", targetId)
    .maybeSingle();
  if (iBlocked) return "blocked_by_me";

  const { data: follow } = await supabase
    .from("follows")
    .select("status")
    .eq("follower_id", viewer.id)
    .eq("following_id", targetId)
    .maybeSingle();
  if (!follow) return "none";
  return follow.status === "accepted" ? "following" : "requested";
}

/** Whether the viewer is allowed to see the target's progress data. Mirrors
 *  the SQL `can_view_user` so server components can branch before querying. */
export async function canViewUser(targetId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_view_user", { target: targetId });
  return data === true;
}

/** Counts that show on every profile header. Both honour RLS — a private
 *  account that hasn't approved the viewer still returns its counts because
 *  the `follows` SELECT policy lets either side of the row read it. */
export async function getFollowCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const supabase = await createClient();
  const [followers, following] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", userId)
      .eq("status", "accepted"),
  ]);
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
  };
}
