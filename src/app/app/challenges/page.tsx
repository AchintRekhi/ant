import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import { challengeStatus, metricLabel, type Metric } from "@/lib/challenges";

type Row = {
  id: string;
  name: string;
  metric: Metric;
  privacy: "public" | "private";
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
  creator_id: string;
};

export default async function ChallengesPage() {
  const me = await requireOnboardedProfile();
  const supabase = await createClient();

  // Two lists: ones I'm in, and discoverable public ones I'm not. Both are
  // RLS-gated — private challenges I'm not a participant of never appear.
  const { data: mineRows } = await supabase
    .from("challenge_participants")
    .select(
      "challenge_id, challenges!inner(id, name, metric, privacy, starts_at, ends_at, finalized_at, creator_id)",
    )
    .eq("user_id", me.id)
    .order("joined_at", { ascending: false });

  const mine: Row[] = (mineRows ?? [])
    .map((r) => r.challenges)
    .filter((c): c is Row => Boolean(c));

  const mineIds = new Set(mine.map((c) => c.id));

  const { data: publicRows } = await supabase
    .from("challenges")
    .select("id, name, metric, privacy, starts_at, ends_at, finalized_at, creator_id")
    .eq("privacy", "public")
    .order("starts_at", { ascending: false })
    .limit(20);

  const discover: Row[] = (publicRows ?? []).filter((c) => !mineIds.has(c.id));

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
        <Link href="/app/challenges/new">
          <Button>New challenge</Button>
        </Link>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Compete with friends or the wider community on activity, volume, or streak.
      </p>

      <Section title="Yours">
        {mine.length === 0 ? (
          <p className="text-sm text-zinc-400">
            You're not in a challenge yet — create one or join a public one below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((c) => (
              <li key={c.id}>
                <ChallengeCard row={c} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Discover public challenges">
        {discover.length === 0 ? (
          <p className="text-sm text-zinc-400">No open public challenges right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {discover.map((c) => (
              <li key={c.id}>
                <ChallengeCard row={c} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChallengeCard({ row }: { row: Row }) {
  const status = challengeStatus({
    startsAt:    row.starts_at,
    endsAt:      row.ends_at,
    finalizedAt: row.finalized_at,
  });
  return (
    <Link
      href={`/app/challenges/${row.id}`}
      className="block rounded-lg border border-zinc-200 px-4 py-3 hover:border-black"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{row.name}</span>
        <StatusPill status={status} />
      </div>
      <div className="mt-0.5 text-sm text-zinc-500">
        {metricLabel(row.metric)} ·{" "}
        {row.privacy === "private" ? "Private" : "Public"} ·{" "}
        {fmt(row.starts_at)} – {fmt(row.ends_at)}
      </div>
    </Link>
  );
}

function StatusPill({ status }: { status: "upcoming" | "active" | "ended" | "finalized" }) {
  const text =
    status === "active"
      ? "Live"
      : status === "upcoming"
        ? "Starts soon"
        : status === "ended"
          ? "Awaiting results"
          : "Finalized";
  const tone =
    status === "active"
      ? "bg-black text-white"
      : status === "finalized"
        ? "border border-black"
        : "border border-zinc-300 text-zinc-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>
      {text}
    </span>
  );
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
