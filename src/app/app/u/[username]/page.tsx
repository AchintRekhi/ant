import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import { weekdayLabel } from "@/lib/days";
import { activeSeconds, formatDuration } from "@/lib/duration";
import { canViewUser, getFollowCounts, getRelationship } from "@/lib/social";
import FollowButton from "./FollowButton";
import BlockButton from "./BlockButton";

type Params = Promise<{ username: string }>;

export default async function PublicProfilePage({ params }: { params: Params }) {
  const me = await requireOnboardedProfile();
  const { username } = await params;

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, privacy, current_streak, longest_streak, total_points")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  // No such row OR a block (either side) hides it via RLS — "not found"
  // covers both safely from the viewer's point of view.
  if (!target) notFound();

  const isSelf = target.id === me.id;
  const [relationship, counts, viewable] = await Promise.all([
    getRelationship(target.id),
    getFollowCounts(target.id),
    canViewUser(target.id),
  ]);
  const avatarSrc = await getAvatarUrl(target.avatar_url);

  // Detail (badges/routines/workouts/quick logs) is only fetched when the
  // viewer is allowed in. RLS would block them anyway, but skipping saves
  // round-trips on a locked profile.
  const detail = viewable ? await loadDetail(supabase, target.id) : null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <header className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-2xl font-semibold text-zinc-400">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            (target.display_name || target.username || "?").charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">@{target.username}</h1>
          {target.display_name && (
            <p className="truncate text-sm text-zinc-500">{target.display_name}</p>
          )}
        </div>
      </header>

      {/* Bio sits outside the visibility gate — same as a public-by-default
          social card. A private user can still set "follow me to see lifts!" */}
      {target.bio && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{target.bio}</p>
      )}

      <dl className="mt-6 grid grid-cols-3 divide-x divide-zinc-200 rounded-lg border border-zinc-200 text-center">
        <Stat label="Followers" value={counts.followers} />
        <Stat label="Following" value={counts.following} />
        <Stat label="Streak"    value={target.current_streak} />
      </dl>

      {!isSelf && (
        <div className="mt-6 flex gap-2">
          <FollowButton
            targetId={target.id}
            privacy={target.privacy}
            initialRelationship={relationship}
          />
          <BlockButton targetId={target.id} blocked={relationship === "blocked_by_me"} />
        </div>
      )}

      {!viewable && (
        <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
          🔒 This account is private. Follow to see their progress.
        </div>
      )}

      {viewable && detail && (
        <>
          <Section title="Badges">
            {detail.badges.length === 0 ? (
              <p className="text-sm text-zinc-400">No badges earned yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.badges.map((b) => (
                  <span
                    key={b.code}
                    title={b.description}
                    className="rounded-full border border-black px-3 py-1 text-xs"
                  >
                    {b.name}
                  </span>
                ))}
              </div>
            )}
          </Section>

          <Section title="Routines">
            {detail.routines.length === 0 ? (
              <p className="text-sm text-zinc-400">No routines yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.routines.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/app/u/${target.username}/routine/${r.id}`}
                      className="block rounded-lg border border-zinc-200 px-4 py-3 hover:border-black"
                    >
                      <div className="font-medium">{r.name}</div>
                      <div className="mt-0.5 text-sm text-zinc-500">
                        {r.days.length === 0
                          ? "No days planned"
                          : r.days.map((d) => weekdayLabel(d).slice(0, 3)).join(" · ")}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent workouts">
            {detail.workouts.length === 0 ? (
              <p className="text-sm text-zinc-400">No workouts logged yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.workouts.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/app/u/${target.username}/workout/${w.id}`}
                      className="block rounded-lg border border-zinc-200 px-4 py-3 hover:border-black"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{w.title}</span>
                        <span className="text-xs text-zinc-500">{w.date}</span>
                      </div>
                      <div className="mt-0.5 text-sm text-zinc-500">
                        {formatDuration(w.durationSeconds)} · {w.exerciseCount} exercise
                        {w.exerciseCount === 1 ? "" : "s"}
                        {w.prCount > 0 && (
                          <span className="ml-2 rounded-full border border-black px-2 py-0.5 text-[10px] uppercase tracking-wider">
                            {w.prCount} PR{w.prCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {detail.quickLogs.length > 0 && (
            <Section title="Other activity">
              <ul className="flex flex-col divide-y divide-zinc-200 text-sm">
                {detail.quickLogs.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span>{a.description || "Activity"}</span>
                    <span className="text-zinc-500">{a.local_date}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="mt-8 text-center text-sm">
            <Link href={`/app/u/${target.username}/progress`} className="text-zinc-500 underline">
              See full progress charts →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-3">
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
      <dt className="text-xs text-zinc-500">{label}</dt>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

// ── Detail fetch ─────────────────────────────────────────────────────────────

type Detail = {
  badges: { code: string; name: string; description: string }[];
  routines: { id: string; name: string; days: number[] }[];
  workouts: {
    id: string;
    title: string;
    date: string;
    durationSeconds: number;
    exerciseCount: number;
    prCount: number;
  }[];
  quickLogs: { id: string; local_date: string; description: string | null }[];
};

async function loadDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Detail> {
  const [badgesRes, routinesRes, workoutsRes, quickRes] = await Promise.all([
    supabase
      .from("user_badges")
      .select("badge_code, badges(name, description, sort_order)")
      .eq("user_id", userId),
    supabase
      .from("routines")
      .select("id, name, routine_days(day_of_week)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    // Finished sessions only — in-progress entries aren't a milestone yet.
    supabase
      .from("workout_sessions")
      .select(
        `id, started_at, ended_at, paused_at, total_paused_seconds,
         routine_days ( label ),
         session_exercises ( id, sets ( is_pr ) )`,
      )
      .eq("user_id", userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("activity_log")
      .select("id, local_date, description")
      .eq("user_id", userId)
      .eq("source", "quick")
      .order("local_date", { ascending: false })
      .limit(6),
  ]);

  const badges = (badgesRes.data ?? [])
    .filter((b) => b.badges)
    .map((b) => ({
      code: b.badge_code,
      name: b.badges!.name,
      description: b.badges!.description,
      sort: b.badges!.sort_order,
    }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ code, name, description }) => ({ code, name, description }));

  const routines = (routinesRes.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    days: (r.routine_days ?? [])
      .map((d) => d.day_of_week)
      .sort((a, b) => a - b),
  }));

  const workouts = (workoutsRes.data ?? []).map((s) => {
    const seList = s.session_exercises ?? [];
    const prCount = seList.reduce(
      (n, se) => n + (se.sets ?? []).filter((x) => x.is_pr).length,
      0,
    );
    return {
      id: s.id,
      title: s.routine_days?.label || "Freestyle",
      date: new Date(s.started_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      durationSeconds: activeSeconds(
        {
          startedAt: s.started_at,
          endedAt: s.ended_at,
          pausedAt: s.paused_at,
          totalPausedSeconds: s.total_paused_seconds,
        },
        Date.now(),
      ),
      exerciseCount: seList.length,
      prCount,
    };
  });

  return {
    badges,
    routines,
    workouts,
    quickLogs: quickRes.data ?? [],
  };
}
