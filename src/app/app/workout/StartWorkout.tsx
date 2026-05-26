"use client";

import { useState, useTransition } from "react";
import { Button, FormError } from "@/components/ui";
import { weekdayLabel } from "@/lib/days";
import { startSession } from "./actions";

export type RoutineOption = {
  id: string;
  name: string;
  days: { id: string; dayOfWeek: number; label: string }[];
};

export default function StartWorkout({
  routines,
  today,
}: {
  routines: RoutineOption[];
  today: number;
}) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [openRoutineId, setOpenRoutineId] = useState<string | null>(null);

  const start = (routineDayId: string | null) => {
    setError(undefined);
    startTransition(async () => {
      const result = await startSession(routineDayId);
      if (result?.error) setError(result.error);
    });
  };

  // Suggest any routine day scheduled for today.
  const todaySuggestions = routines.flatMap((r) =>
    r.days
      .filter((d) => d.dayOfWeek === today)
      .map((d) => ({ routineName: r.name, ...d })),
  );

  return (
    <div className="flex flex-col gap-4">
      {todaySuggestions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-black bg-zinc-50 p-4">
          <span className="text-sm font-medium">Scheduled for today</span>
          {todaySuggestions.map((s) => (
            <Button key={s.id} onClick={() => start(s.id)} disabled={pending}>
              {s.label || s.routineName} · {weekdayLabel(s.dayOfWeek)}
            </Button>
          ))}
        </div>
      )}

      <Button onClick={() => start(null)} disabled={pending} variant="primary">
        {pending ? "Starting…" : "Start empty workout"}
      </Button>

      {routines.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-500">Or start from a routine</span>
          {routines.map((r) => (
            <div key={r.id} className="rounded-lg border border-zinc-200">
              <button
                type="button"
                onClick={() => setOpenRoutineId(openRoutineId === r.id ? null : r.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
              >
                {r.name}
                <span className="text-zinc-400">{openRoutineId === r.id ? "−" : "+"}</span>
              </button>
              {openRoutineId === r.id && (
                <div className="flex flex-col gap-1 border-t border-zinc-100 p-2">
                  {r.days.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-zinc-400">No days planned.</p>
                  ) : (
                    r.days.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => start(d.id)}
                        disabled={pending}
                        className="rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-40"
                      >
                        <span className="text-zinc-400">{weekdayLabel(d.dayOfWeek)}</span>
                        {d.label ? ` · ${d.label}` : ""}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FormError message={error} />
    </div>
  );
}
