"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError, inputClasses } from "@/components/ui";
import { quickLogActivity, deleteActivity } from "./actions";

export type ActivityItem = {
  id: string;
  localDate: string;
  source: "session" | "quick";
  description: string | null;
};

export default function ActivityClient({ items }: { items: ActivityItem[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setError(undefined);
    startTransition(async () => {
      const result = await quickLogActivity(value);
      if (result?.error) setError(result.error);
      else {
        setText("");
        router.refresh();
      }
    });
  };

  const remove = (id: string) => {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteActivity(id);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium text-zinc-500">Quick-log activity</h2>
      <form onSubmit={submit} className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. 50 pushups, 5k run…"
          maxLength={120}
          className={inputClasses}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? "…" : "Log"}
        </Button>
      </form>
      <FormError message={error} />

      <h2 className="mb-2 mt-8 text-sm font-medium text-zinc-500">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">
          Nothing logged yet. Finish a workout or quick-log something above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3"
            >
              <div>
                <div className="font-medium">
                  {a.source === "session" ? "Workout" : a.description || "Activity"}
                </div>
                <div className="mt-0.5 text-sm text-zinc-500">
                  {formatDate(a.localDate)}
                  {a.source === "session" && " · from a session"}
                </div>
              </div>
              {a.source === "quick" && (
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={pending}
                  className="text-zinc-300 hover:text-black disabled:opacity-40"
                  aria-label="Remove activity"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(date: string): string {
  // date is a plain "YYYY-MM-DD"; parse as local to avoid a UTC day shift.
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
