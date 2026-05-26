import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col bg-white text-black">
      <header className="px-6 pt-8">
        <Link href="/" className="text-xl font-bold tracking-tight">
          ANT
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
