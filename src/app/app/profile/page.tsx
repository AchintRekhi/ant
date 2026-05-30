import Link from "next/link";
import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import { ageFromDob, GOAL_LABELS, type GoalType } from "@/lib/validation";
import { kgToLbs, type Units } from "@/lib/units";
import ProfileForm from "./ProfileForm";
import DeleteAccount from "./DeleteAccount";
import BodyweightClient, { type WeightEntry } from "../bodyweight/BodyweightClient";

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  // Every owner-scoped table is also readable by followers/public viewers
  // (Phase 5 RLS), so filter by user_id explicitly. `badges` is global.
  const [{ data: goalRows }, { data: defs }, { data: earned }, { data: weights }, prCount, followCounts] =
    await Promise.all([
      supabase.from("goals").select("type").eq("user_id", profile.id),
      supabase.from("badges").select("code, name, description, sort_order").order("sort_order"),
      supabase.from("user_badges").select("badge_code").eq("user_id", profile.id),
      supabase
        .from("body_weights")
        .select("id, weight_kg, recorded_at")
        .eq("user_id", profile.id)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("sets")
        .select("id, session_exercises!inner(workout_sessions!inner(user_id))", {
          count: "exact",
          head: true,
        })
        .eq("is_pr", true)
        .eq("session_exercises.workout_sessions.user_id", profile.id),
      supabase
        .from("follows")
        .select("status", { count: "exact", head: true })
        .eq("following_id", profile.id)
        .eq("status", "pending"),
    ]);

  const goals = (goalRows ?? []).map((g) => g.type as GoalType);
  const avatarUrl = await getAvatarUrl(profile.avatar_url);
  const age = profile.dob ? ageFromDob(profile.dob) : null;

  // Bodyweight: one query feeds both the editor and the goal weight-delta.
  const isImperial = profile.units === "imperial";
  const weightEntries: WeightEntry[] = (weights ?? []).map((r) => ({
    id: r.id,
    recordedAt: r.recorded_at,
    displayWeight: isImperial
      ? Math.round(kgToLbs(r.weight_kg) * 10) / 10
      : Math.round(r.weight_kg * 10) / 10,
  }));
  // weights is newest-first; delta = latest − earliest.
  const weightDelta =
    weights && weights.length >= 2
      ? weights[0].weight_kg - weights[weights.length - 1].weight_kg
      : null;

  const earnedCodes = new Set((earned ?? []).map((e) => e.badge_code));
  const goalCards = goals.map((type) =>
    goalProgress(type, {
      currentStreak: profile.current_streak,
      longestStreak: profile.longest_streak,
      weightDeltaKg: weightDelta,
      prCount: prCount.count ?? 0,
      units: profile.units,
    }),
  );
  const pendingRequests = followCounts.count ?? 0;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Age and DOB are private — your date of birth is never shown to anyone.
      </p>

      <Link
        href="/app/social"
        className="mt-6 flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:border-black"
      >
        <span className="font-medium">People</span>
        <span className="text-sm text-zinc-500">
          {pendingRequests > 0
            ? `${pendingRequests} request${pendingRequests === 1 ? "" : "s"} · `
            : ""}
          Followers, following & blocked →
        </span>
      </Link>

      <ProfileForm
        initial={{
          username: profile.username ?? "",
          displayName: profile.display_name ?? "",
          bio: profile.bio ?? "",
          gender: profile.gender ?? "prefer_not_to_say",
          heightCm: profile.height_cm ?? 0,
          units: profile.units,
          privacy: profile.privacy,
          experienceLevel: profile.experience_level ?? "beginner",
          goals,
        }}
        age={age}
        avatarUrl={avatarUrl}
      />

      <section className="mt-12 border-t border-zinc-200 pt-8">
        <h2 className="text-base font-semibold">Bodyweight</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Log your weight regularly to see your trend.
        </p>
        <BodyweightClient entries={weightEntries} units={profile.units} />
      </section>

      {goalCards.length > 0 && (
        <section className="mt-12 border-t border-zinc-200 pt-8">
          <h2 className="text-base font-semibold">Goal progress</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {goalCards.map((c) => (
              <li
                key={c.label}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
              >
                <span className="font-medium">{c.label}</span>
                <span className="text-sm text-zinc-500">{c.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 border-t border-zinc-200 pt-8">
        <h2 className="text-base font-semibold">
          Badges · {earnedCodes.size}/{(defs ?? []).length}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(defs ?? []).map((b) => {
            const unlocked = earnedCodes.has(b.code);
            return (
              <div
                key={b.code}
                className={`rounded-lg border px-4 py-3 ${
                  unlocked ? "border-black bg-zinc-50" : "border-zinc-200 opacity-60"
                }`}
              >
                <div className="font-medium">
                  {unlocked ? "🏅 " : "🔒 "}
                  {b.name}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{b.description}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12 border-t border-zinc-200 pt-8">
        <h2 className="text-base font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Download everything in your account as a JSON file.
        </p>
        <a
          href="/app/export"
          download
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 px-5 text-sm font-medium text-black transition hover:border-black"
        >
          Export my data
        </a>
      </section>

      {profile.username && <DeleteAccount username={profile.username} />}
    </div>
  );
}

function goalProgress(
  type: GoalType,
  stats: {
    currentStreak: number;
    longestStreak: number;
    weightDeltaKg: number | null;
    prCount: number;
    units: Units;
  },
): { label: string; detail: string } {
  const label = GOAL_LABELS[type];
  switch (type) {
    case "stay_consistent":
      return {
        label,
        detail: `${stats.currentStreak}-day streak · best ${stats.longestStreak}`,
      };
    case "lose_weight":
    case "build_muscle":
      return { label, detail: weightDeltaDetail(type, stats.weightDeltaKg, stats.units) };
    case "get_stronger":
      return {
        label,
        detail: stats.prCount > 0 ? `${stats.prCount} PR${stats.prCount === 1 ? "" : "s"} set` : "No PRs yet",
      };
  }
}

function weightDeltaDetail(type: GoalType, deltaKg: number | null, units: Units): string {
  if (deltaKg === null) return "Log a few weigh-ins to track this";
  const display = units === "imperial" ? kgToLbs(Math.abs(deltaKg)) : Math.abs(deltaKg);
  const rounded = Math.round(display * 10) / 10;
  if (Math.abs(deltaKg) < 0.05) return "No change yet";
  const direction = deltaKg < 0 ? "down" : "up";
  const goodDirection = type === "lose_weight" ? deltaKg < 0 : deltaKg > 0;
  const unit = units === "imperial" ? "lb" : "kg";
  return `${goodDirection ? "✓ " : ""}${rounded} ${unit} ${direction}`;
}
