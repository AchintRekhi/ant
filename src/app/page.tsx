import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/dal";
import { Button } from "@/components/ui";

export default async function Home() {
  // Signed-in users skip the marketing screen.
  if (await getUser()) redirect("/app");

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-white px-6 text-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-6xl font-bold tracking-tight">ANT</h1>
          <p className="text-sm text-zinc-500">Track your gym progress.</p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Link href="/signup" className="w-full">
            <Button className="w-full">Get started</Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button variant="ghost" className="w-full">
              Log in
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
