"use client";

import { useState, useTransition } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import WeightChart, { type WeightPoint } from "@/components/WeightChart";
import { lbsToKg } from "@/lib/units";
import { WEIGH_IN_INTERVAL_DAYS, daysSince } from "@/lib/bodyweight";
import type { Units } from "@/lib/units";
import { addBodyWeight, deleteBodyWeight } from "./actions";

export type WeightEntry = {
  id: string;
  recordedAt: string;
  displayWeight: number;
};

export default function BodyweightClient({
  entries,
  units,
}: {
  entries: WeightEntry[]; // newest first
  units: Units;
}) {
  const unitLabel = units === "imperial" ? "lb" : "kg";
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const latest = entries[0];
  const sinceLast = latest ? daysSince(latest.recordedAt) : null;
  const due = sinceLast === null || sinceLast >= WEIGH_IN_INTERVAL_DAYS;

  // Chart wants oldest → newest, with at least two points to draw a line.
  // Two entries on the same calendar day land on the same `t` (we stamp dates
  // at noon UTC), which Recharts uses inside its tick keys — duplicates would
  // crash the keying. Collapse to one point per day, keeping the most recent
  // entry's value (entries is newest-first, so the first one wins).
  const byDay = new Map<string, WeightEntry>();
  for (const e of entries) {
    const day = e.recordedAt.slice(0, 10); // YYYY-MM-DD
    if (!byDay.has(day)) byDay.set(day, e);
  }
  const points: WeightPoint[] = [...byDay.values()]
    .reverse()
    .map((e) => ({ t: new Date(e.recordedAt).getTime(), value: e.displayWeight }));

  const submit = () => {
    const n = Number(weight);
    if (!n) {
      setError("Enter your weight.");
      return;
    }
    const weightKg = units === "imperial" ? lbsToKg(n) : n;
    setError(undefined);
    startTransition(async () => {
      const result = await addBodyWeight({ weightKg, recordedDate: date });
      if (result.error) setError(result.error);
      else setWeight("");
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteBodyWeight(id);
      if (result.error) setError(result.error);
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-8">
      {due && (
        <div className="rounded-lg border border-black bg-zinc-50 px-4 py-3 text-sm">
          {sinceLast === null
            ? "Log your first weigh-in to start your trend."
            : `It's been ${sinceLast} days — time to weigh in.`}
        </div>
      )}

      {/* Add entry */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center rounded-lg border border-zinc-300 px-4 focus-within:border-black">
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            placeholder={units === "imperial" ? "155" : "70"}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full bg-transparent py-3 text-lg outline-none placeholder:text-zinc-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="pl-2 text-lg text-zinc-400">{unitLabel}</span>
        </label>
        <input
          type="date"
          value={date}
          max={today()}
          onChange={(e) => setDate(e.target.value)}
          className={inputClasses}
        />
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Log weight"}
        </Button>
        <FormError message={error} />
      </div>

      {/* Trend */}
      {points.length >= 2 ? (
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-500">Trend</h2>
          <WeightChart data={points} unit={unitLabel} />
        </div>
      ) : (
        entries.length > 0 && (
          <p className="text-sm text-zinc-400">
            Log at least two entries to see your trend.
          </p>
        )
      )}

      {/* History */}
      {entries.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-zinc-500">History</h2>
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span className="font-medium">
                  {e.displayWeight} {unitLabel}
                </span>
                <span className="flex items-center gap-4">
                  <span className="text-zinc-500">{formatDate(e.recordedAt)}</span>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    disabled={pending}
                    className="text-zinc-400 underline hover:text-black disabled:opacity-40"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
