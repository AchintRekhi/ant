import "server-only";

import { createClient } from "@/lib/supabase/server";

// Avatars live in a private bucket under a per-user folder ({user_id}/avatar),
// scoped by the RLS policies in migration 0004. Profiles store the object path
// (not a URL); we mint a short-lived signed URL whenever we need to render it.

export const AVATAR_BUCKET = "avatars";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — re-minted on every render.

/** Canonical object path for a user's avatar. Extension-less so re-uploads
 *  overwrite the same object (content type is stored as metadata), leaving no orphans. */
export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar`;
}

/** Turn a stored avatar object path into a signed URL the browser can load. */
export async function getAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
