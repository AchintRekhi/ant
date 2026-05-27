"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveRoutine } from "./actions";

export default function SetActiveButton({
  routineId,
  isActive,
}: {
  routineId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isActive) {
    return (
      <span className="shrink-0 rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
        ★ Active
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const result = await setActiveRoutine(routineId);
          if (!result?.error) router.refresh();
        })
      }
      disabled={pending}
      className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:border-black hover:text-black disabled:opacity-40"
    >
      {pending ? "…" : "Set active"}
    </button>
  );
}
