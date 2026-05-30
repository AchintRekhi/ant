import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import {
  challengeStatus,
  daysBetween,
  formatScore,
  formatTarget,
  metricLabel,
  pointsForRank,
  targetProgress,
  type Metric,
} from "@/lib/challenges";
import { finalizeChallenge } from "../actions";
import ChallengeActions from "./ChallengeActions";

type Params = Promise<{ id: string }>;

export default async function ChallengePage({ params }: { params: Params }) {
  const me = await requireOnboardedProfile();
  const { id } = await params;

  const supabase = await createClient();

  const { data: c } = await supabase
    .from("challenges")
    .select(
      "id, name, description, privacy, metric, exercise_id, target_value, starts_at, ends_at, finalized_at, creator_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const { data: exercise } = await supabase
    .from("exercises")
    .select("name")
    .eq("id", c.exercise_id)
    .maybeSingle();
  const exerciseName = exercise?.name ?? "Unknown exercise";

  // Auto-finalize once the window is over. The SQL is idempotent and the
  // first viewer after ends_at pays the cost; subsequent views see the
  // frozen leaderboard. We swallow errors — non-creators are allowed via
  // SECURITY DEFINER, but a failure here shouldn't break rendering.
  if (!c.finalized_at && new Date().toISOString().slice(0, 10) > c.ends_at) {
    await finalizeChallenge(c.id);
    const { data: fresh } = await supabase
      .from("challenges")
      .select("finalized_at")
      .eq("id", id)
      .maybeSingle();
    if (fresh?.finalized_at) c.finalized_at = fresh.finalized_at;
  }

  const status = challengeStatus({
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    finalizedAt: c.finalized_at,
  });

  // Participants → profile cards (two-step join: challenge_participants
  // points at auth.users, so PostgREST can't auto-embed profiles via FK).
  const { data: participants } = await supabase
    .from("challenge_participants")
    .select("user_id, joined_at, final_score, final_rank, points_awarded")
    .eq("challenge_id", c.id);

  const userIds = (participants ?? []).map((p) => p.user_id);
  const { data: profs } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds)
    : { data: [] };
  const profById = new Map((profs ?? []).map((p) => [p.id, p]));

  const live: { user_id: string; score: number }[] = c.finalized_at
    ? []
    : (
        (await supabase.rpc("challenge_leaderboard", { c_id: c.id })).data ?? []
      );
  const scoreByUser = new Map(live.map((r) => [r.user_id, Number(r.score)]));

  const isCreator   = c.creator_id === me.id;
  const isJoined    = (participants ?? []).some((p) => p.user_id === me.id);
  const canJoin     = !isJoined && c.privacy === "public" && status !== "finalized" && status !== "ended";
  const canFinalize = isCreator && status === "ended"; // safety button in case the auto pass missed

  // For private creators, surface a list of accepted followers they could
  // invite. Skipped for public challenges (anyone can join themselves).
  const inviteOptions =
    isCreator && c.privacy === "private" && status !== "finalized" && status !== "ended"
      ? await loadInviteCandidates(supabase, me.id, userIds)
      : [];

  const ordered = [...(participants ?? [])]
    .map((p) => {
      const score = c.finalized_at
        ? Number(p.final_score ?? 0)
        : scoreByUser.get(p.user_id) ?? 0;
      return { ...p, score, profile: profById.get(p.user_id) };
    })
    .sort((a, b) => {
      // After finalize, ranks are stored; before, sort by live score desc.
      if (c.finalized_at) return (a.final_rank ?? 99) - (b.final_rank ?? 99);
      return b.score - a.score;
    });

  // Avatars are signed-URL'd at render time (private bucket).
  const withAvatars = await Promise.all(
    ordered.map(async (p) => ({
      ...p,
      avatarSrc: await getAvatarUrl(p.profile?.avatar_url ?? null),
    })),
  );

  const daysLeft  = daysBetween(new Date().toISOString().slice(0, 10), c.ends_at);
  const daysUntil = daysBetween(new Date().toISOString().slice(0, 10), c.starts_at);

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="text-sm">
        <Link href="/app/challenges" className="text-zinc-500 underline">
          ← All challenges
        </Link>
      </div>

      <h1 className="mt-2 text-2xl font-bold tracking-tight">{c.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {exerciseName} · {metricLabel(c.metric as Metric)} ·{" "}
        {c.privacy === "private" ? "Private" : "Public"} · {fmt(c.starts_at)} – {fmt(c.ends_at)}
      </p>
      {c.target_value != null && (
        <p className="mt-2 text-sm font-medium">
          🎯 Target: {formatTarget(c.metric as Metric, Number(c.target_value), me.units)}
        </p>
      )}
      {c.description && (
        <p className="mt-3 whitespace-pre-line rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          {c.description}
        </p>
      )}

      <StatusBanner status={status} daysLeft={daysLeft} daysUntil={daysUntil} />

      <ChallengeActions
        challengeId={c.id}
        canJoin={canJoin}
        canLeave={isJoined && !c.finalized_at}
        canFinalize={canFinalize}
        canDelete={isCreator}
        inviteOptions={inviteOptions}
      />

      <h2 className="mt-10 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Scoreboard
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-zinc-200">
        {withAvatars.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-400">No participants yet.</li>
        )}
        {withAvatars.map((p, i) => {
          const rank = c.finalized_at ? p.final_rank ?? null : i + 1;
          const username = p.profile?.username ?? "—";
          return (
            <li key={p.user_id} className="flex items-center gap-3 py-3">
              <span className="w-6 text-sm font-semibold tabular-nums text-zinc-500">
                {rank ? `${rank}.` : "—"}
              </span>
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-400">
                {p.avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  (p.profile?.display_name || username).charAt(0).toUpperCase()
                )}
              </div>
              <Link
                href={`/app/u/${username}`}
                className="min-w-0 flex-1 truncate text-sm hover:underline"
              >
                @{username}
                {p.user_id === c.creator_id && (
                  <span className="ml-2 text-xs text-zinc-400">· creator</span>
                )}
              </Link>
              <div className="text-right">
                <div className="text-sm font-medium tabular-nums">
                  {formatScore(c.metric as Metric, p.score, me.units)}
                </div>
                {c.target_value != null && (
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                    {Math.round(targetProgress(p.score, Number(c.target_value)) * 100)}% of target
                  </div>
                )}
                {c.finalized_at && (
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">
                    +{p.points_awarded ?? pointsForRank(p.final_rank ?? 0)} pts
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBanner({
  status,
  daysLeft,
  daysUntil,
}: {
  status: "upcoming" | "active" | "ended" | "finalized";
  daysLeft: number;
  daysUntil: number;
}) {
  const text =
    status === "upcoming"
      ? `Starts in ${daysUntil} day${daysUntil === 1 ? "" : "s"}.`
      : status === "active"
        ? `Ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
        : status === "ended"
          ? "Window closed — finalizing scores."
          : "Finalized · points awarded.";
  return (
    <div className="mt-4 rounded-lg border border-black bg-zinc-50 px-4 py-3 text-sm">
      {text}
    </div>
  );
}

async function loadInviteCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meId: string,
  alreadyIn: string[],
): Promise<{ id: string; username: string; displayName: string | null }[]> {
  // follows.follower_id points to auth.users, so PostgREST can't auto-embed
  // profiles through that FK. Two-step: get follower ids, then look up cards.
  const { data: followers } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("following_id", meId)
    .eq("status", "accepted");
  const ids = (followers ?? [])
    .map((f) => f.follower_id)
    .filter((id) => !alreadyIn.includes(id));
  if (ids.length === 0) return [];

  const { data: profs } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", ids);
  return (profs ?? [])
    .filter((p) => p.username)
    .map((p) => ({ id: p.id, username: p.username!, displayName: p.display_name }));
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
