import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/dal";
import { logout } from "../(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard the whole app area: must be signed in and onboarded.
  const profile = await requireOnboardedProfile();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <Link href="/app" className="text-lg font-bold tracking-tight">
          ANT
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-zinc-500">@{profile.username}</span>
          <form action={logout}>
            <button
              type="submit"
              className="text-zinc-500 underline hover:text-black"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
