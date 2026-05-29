import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import { weekdayLabel } from "@/lib/days";
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

  // Either no such user OR they (or we) have a block in place — RLS hides
  // the row in both cases, and "not found" is the right user-facing reply.
  if (!target) notFound();

  const isSelf = target.id === me.id;
  const [relationship, counts, viewable] = await Promise.all([
    getRelationship(target.id),
    getFollowCounts(target.id),
    canViewUser(target.id),
  ]);
  const avatarSrc = await getAvatarUrl(target.avatar_url);

  // Progress, badges, routines — only fetched when the viewer is allowed in.
  // RLS would block them anyway, but skipping the queries saves round-trips
  // on a private profile.
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

      {target.bio && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{target.bio}</p>
      )}

      <dl className="mt-6 grid grid-cols-3 divide-x divide-zinc-200 rounded-lg border border-zinc-200 text-center">
        <Stat label="Followers" value={counts.followers} />
        <Stat label="Following" value={counts.following} />
        <Stat label="Streak"    value={target.current_streak} />
      </dl>

      {/* Self has no actions; everyone else gets follow + block. */}
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

      {/* Visibility gate — locked panel for private, full detail for visible. */}
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
                  <li key={r.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="mt-0.5 text-sm text-zinc-500">
                      {r.days.length === 0
                        ? "No days planned"
                        : r.days.map((d) => weekdayLabel(d).slice(0, 3)).join(" · ")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent activity">
            {detail.recent.length === 0 ? (
              <p className="text-sm text-zinc-400">No activity yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-zinc-200 text-sm">
                {detail.recent.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span>{a.description || (a.source === "session" ? "Workout" : "Activity")}</span>
                    <span className="text-zinc-500">{a.local_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="mt-6 text-center text-sm">
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
  recent: {
    id: string;
    local_date: string;
    source: "session" | "quick";
    description: string | null;
  }[];
};

async function loadDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Detail> {
  const [badgesRes, routinesRes, recentRes] = await Promise.all([
    supabase
      .from("user_badges")
      .select("badge_code, badges(name, description, sort_order)")
      .eq("user_id", userId),
    supabase
      .from("routines")
      .select("id, name, routine_days(day_of_week)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("activity_log")
      .select("id, local_date, source, description")
      .eq("user_id", userId)
      .order("local_date", { ascending: false })
      .limit(10),
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

  return { badges, routines, recent: recentRes.data ?? [] };
}
