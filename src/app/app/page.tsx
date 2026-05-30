import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { daysSince, weighInDue } from "@/lib/bodyweight";
import ActivityClient, { type ActivityItem } from "./activity/ActivityClient";

export default async function DashboardPage() {
  // The layout already guarantees an onboarded profile; re-read is cache()'d.
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("body_weights")
    .select("recorded_at")
    .eq("user_id", profile.id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Surface pending follow requests on the home tile so they're not buried
  // behind the People tab on a private account.
  const { count: pendingRequests } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.id)
    .eq("status", "pending");

  // Recent activity feeds the inline quick-log surface (moved here from the
  // dissolved Activity tab — logging any movement is a daily action).
  const { data: activities } = await supabase
    .from("activity_log")
    .select("id, local_date, source, description")
    .eq("user_id", profile.id)
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);
  const items: ActivityItem[] = (activities ?? []).map((a) => ({
    id: a.id,
    localDate: a.local_date,
    source: a.source,
    description: a.description,
  }));

  const due = weighInDue(latest?.recorded_at);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome, {profile.display_name ?? profile.username}.
      </h1>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-black bg-zinc-50 px-5 py-4">
        <span className="text-2xl font-bold tabular-nums">
          🔥 {profile.current_streak}
        </span>
        <span className="text-sm text-zinc-500">
          day{profile.current_streak === 1 ? "" : "s"} streak · best {profile.longest_streak}
        </span>
      </div>

      <Link
        href="/app/workout"
        className="mt-4 block rounded-lg bg-black px-4 py-3 text-center font-medium text-white hover:bg-zinc-800"
      >
        Start a workout →
      </Link>

      {due && (
        <Link
          href="/app/bodyweight"
          className="mt-6 block rounded-lg border border-black bg-zinc-50 px-4 py-3 text-sm hover:bg-zinc-100"
        >
          {latest
            ? `It's been ${daysSince(latest.recorded_at)} days since your last weigh-in. Log it →`
            : "Log your first weigh-in to start your trend →"}
        </Link>
      )}

      {pendingRequests ? (
        <Link
          href="/app/social?tab=requests"
          className="mt-4 block rounded-lg border border-black bg-zinc-50 px-4 py-3 text-sm hover:bg-zinc-100"
        >
          {pendingRequests} pending follow request
          {pendingRequests === 1 ? "" : "s"} →
        </Link>
      ) : null}

      <ActivityClient items={items} />
    </div>
  );
}
