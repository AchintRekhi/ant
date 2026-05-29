import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ageFromDob } from "@/lib/validation";
import { formatHeight, formatWeight } from "@/lib/units";
import { daysSince, weighInDue } from "@/lib/bodyweight";

export default async function DashboardPage() {
  // The layout already guarantees an onboarded profile; re-read is cache()'d.
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("body_weights")
    .select("weight_kg, recorded_at")
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

  const age = profile.dob ? ageFromDob(profile.dob) : null;
  const due = weighInDue(latest?.recorded_at);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome, {profile.display_name ?? profile.username}.
      </h1>

      <Link
        href="/app/activity"
        className="mt-6 flex items-center justify-between rounded-lg border border-black bg-zinc-50 px-5 py-4 hover:bg-zinc-100"
      >
        <span className="text-2xl font-bold tabular-nums">
          🔥 {profile.current_streak}
        </span>
        <span className="text-sm text-zinc-500">
          day{profile.current_streak === 1 ? "" : "s"} streak · log activity →
        </span>
      </Link>

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

      <dl className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
        <Row label="Username" value={`@${profile.username}`} />
        {latest && (
          <Row
            label="Current weight"
            value={formatWeight(latest.weight_kg, profile.units)}
          />
        )}
        {age !== null && <Row label="Age" value={String(age)} />}
        {profile.height_cm !== null && (
          <Row label="Height" value={formatHeight(profile.height_cm, profile.units)} />
        )}
        <Row label="Experience" value={capitalize(profile.experience_level ?? "—")} />
        <Row label="Privacy" value={capitalize(profile.privacy)} />
      </dl>

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
