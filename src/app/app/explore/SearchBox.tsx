"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClasses } from "@/components/ui";

/**
 * Debounced search input that pushes the query into the URL — the page itself
 * is a server component, so changing `?q=` re-renders the results server-side
 * with no extra fetch wiring on the client.
 */
export default function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = value.trim();
      const next = trimmed
        ? `/app/explore?q=${encodeURIComponent(trimmed)}`
        : "/app/explore";
      startTransition(() => router.replace(next, { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
    // initial is intentionally not a dep — it only seeds first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search @username…"
      className={`${inputClasses} mt-6`}
      autoFocus
    />
  );
}
