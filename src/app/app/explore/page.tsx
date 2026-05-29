import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import SearchBox from "./SearchBox";

type SP = Promise<{ q?: string }>;

export default async function ExplorePage({ searchParams }: { searchParams: SP }) {
  await requireOnboardedProfile();
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();

  // Two modes:
  //   * No query  → recent public profiles to browse ("explore")
  //   * Query     → prefix search via the search_users RPC (case-insensitive,
  //                 covers username + display_name, excludes self & blocked)
  let rows: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    privacy: "public" | "private";
  }[] = [];

  if (query.length === 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, privacy")
      .eq("privacy", "public")
      .eq("onboarding_complete", true)
      .not("username", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);
    rows = ((data ?? []) as typeof rows).filter((r) => r.username);
  } else {
    const { data } = await supabase.rpc("search_users", { q: query, max_results: 25 });
    rows = (data ?? []) as typeof rows;
  }

  const withAvatars = await Promise.all(
    rows.map(async (r) => ({ ...r, avatarSrc: await getAvatarUrl(r.avatar_url) })),
  );

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Find people by username or name.
      </p>

      <SearchBox initial={query} />

      <h2 className="mt-8 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {query ? `Results for "${query}"` : "Public profiles"}
      </h2>

      <ul className="mt-3 flex flex-col divide-y divide-zinc-200">
        {withAvatars.length === 0 && (
          <li className="py-6 text-center text-sm text-zinc-500">
            {query ? "No matches." : "No public profiles to show yet."}
          </li>
        )}
        {withAvatars.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/u/${p.username}`}
              className="flex items-center gap-3 py-3 hover:opacity-80"
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-sm font-semibold text-zinc-400">
                {p.avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  (p.display_name || p.username).charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">@{p.username}</div>
                {p.display_name && (
                  <div className="truncate text-xs text-zinc-500">{p.display_name}</div>
                )}
              </div>
              {p.privacy === "private" && (
                <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  Private
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
