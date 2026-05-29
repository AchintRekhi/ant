import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import {
  acceptFollowRequest,
  removeFollower,
  unblockUser,
  unfollowUser,
} from "./actions";

type Tab = "requests" | "followers" | "following" | "blocked";

const TABS: { key: Tab; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
  { key: "blocked", label: "Blocked" },
];

type SP = Promise<{ tab?: string }>;

export default async function SocialPage({ searchParams }: { searchParams: SP }) {
  const me = await requireOnboardedProfile();
  const { tab } = await searchParams;
  const active: Tab = (TABS.find((t) => t.key === tab)?.key as Tab) ?? "requests";

  const supabase = await createClient();

  // Each branch pulls the row set for its tab and joins the matching profile
  // card. We hand-roll the join (two queries) instead of using PostgREST's
  // embedded select — it stays readable and avoids ambiguous FK names.
  const ids = await collectIds(supabase, me.id, active);
  const cards = ids.length > 0 ? await loadCards(supabase, ids) : [];
  const withAvatars = await Promise.all(
    cards.map(async (c) => ({ ...c, avatarSrc: await getAvatarUrl(c.avatar_url) })),
  );

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">People</h1>

      <nav className="mt-6 flex gap-1 border-b border-zinc-200 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/social?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 pb-2 ${
              active === t.key
                ? "border-black font-medium text-black"
                : "border-transparent text-zinc-500 hover:text-black"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 flex flex-col divide-y divide-zinc-200">
        {withAvatars.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">
            {emptyMessage(active)}
          </p>
        )}
        {withAvatars.map((p) => (
          <Row
            key={p.id}
            tab={active}
            id={p.id}
            username={p.username}
            displayName={p.display_name}
            avatarSrc={p.avatarSrc}
          />
        ))}
      </div>
    </div>
  );
}

function emptyMessage(tab: Tab): string {
  switch (tab) {
    case "requests":  return "No pending follow requests.";
    case "followers": return "Nobody follows you yet.";
    case "following": return "You aren't following anyone yet.";
    case "blocked":   return "You haven't blocked anyone.";
  }
}

async function collectIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  me: string,
  tab: Tab,
): Promise<string[]> {
  if (tab === "requests") {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => r.follower_id);
  }
  if (tab === "followers") {
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", me)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => r.follower_id);
  }
  if (tab === "following") {
    const { data } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", me)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => r.following_id);
  }
  // blocked
  const { data } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", me)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => r.blocked_id);
}

type Card = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

async function loadCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<Card[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", ids);
  // Preserve the order the IDs came in (most-recent-first from the source
  // table). Missing rows (e.g. blocked profile that hid itself) are skipped.
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p && p.username))
    .map((p) => ({
      id: p.id,
      username: p.username!,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
    }));
}

function Row({
  tab,
  id,
  username,
  displayName,
  avatarSrc,
}: {
  tab: Tab;
  id: string;
  username: string;
  displayName: string | null;
  avatarSrc: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Link
        href={`/app/u/${username}`}
        className="flex flex-1 items-center gap-3 hover:opacity-80"
      >
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-400">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            (displayName || username).charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">@{username}</div>
          {displayName && (
            <div className="truncate text-xs text-zinc-500">{displayName}</div>
          )}
        </div>
      </Link>
      <RowActions tab={tab} id={id} />
    </div>
  );
}

function RowActions({ tab, id }: { tab: Tab; id: string }) {
  // Wrap each action so form-action's signature `(FormData) => void` is
  // satisfied — the actions return Result for their client-side callers but
  // here we just fire-and-forget.
  const accept  = async () => { "use server"; await acceptFollowRequest(id); };
  const remove  = async () => { "use server"; await removeFollower(id); };
  const unfoll  = async () => { "use server"; await unfollowUser(id); };
  const unblock = async () => { "use server"; await unblockUser(id); };

  if (tab === "requests") {
    return (
      <div className="flex gap-2">
        <form action={accept}>
          <button className="rounded-full bg-black px-3 py-1 text-xs text-white hover:bg-zinc-800">
            Accept
          </button>
        </form>
        <form action={remove}>
          <button className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-black">
            Decline
          </button>
        </form>
      </div>
    );
  }
  if (tab === "followers") {
    return (
      <form action={remove}>
        <button className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-black">
          Remove
        </button>
      </form>
    );
  }
  if (tab === "following") {
    return (
      <form action={unfoll}>
        <button className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-black">
          Unfollow
        </button>
      </form>
    );
  }
  // blocked
  return (
    <form action={unblock}>
      <button className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:border-black">
        Unblock
      </button>
    </form>
  );
}
