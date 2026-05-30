"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/dal";

export type ReportResult = { error?: string; ok?: boolean };

/**
 * File a moderation report against another user's workout photo. The RLS policy
 * is the real guard — it only admits a report on a session the reporter can see
 * and doesn't own. A duplicate (already reported) is treated as success so the
 * UI reads the same either way.
 */
export async function reportPhoto(
  _prev: ReportResult | null,
  formData: FormData,
): Promise<ReportResult> {
  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!sessionId) return { error: "Missing session." };
  if (reason.length < 1) return { error: "Add a short reason." };
  if (reason.length > 500) return { error: "Keep it under 500 characters." };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Your session expired." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    session_id: sessionId,
    reason,
  });

  if (error) {
    if (error.code === "23505") return { ok: true }; // already reported
    return { error: "Couldn't submit the report. Please try again." };
  }
  return { ok: true };
}
