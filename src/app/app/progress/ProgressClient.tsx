"use client";

import { useState } from "react";
import { inputClasses } from "@/components/ui";
import ExerciseProgressChart, {
  type ProgressPoint,
} from "@/components/ExerciseProgressChart";

export type ExerciseSeries = {
  id: string;
  name: string;
  points: ProgressPoint[];
};

export default function ProgressClient({
  series,
  unit,
}: {
  series: ExerciseSeries[];
  unit: string;
}) {
  const [selectedId, setSelectedId] = useState(series[0]?.id ?? "");

  if (series.length === 0) {
    return (
      <p className="mt-8 text-sm text-zinc-400">
        Log a few weighted workouts and your progress charts will appear here.
      </p>
    );
  }

  const selected = series.find((s) => s.id === selectedId) ?? series[0];
  const prPoints = selected.points.filter((p) => p.isPr);
  const best = Math.max(...selected.points.map((p) => p.value));

  return (
    <div className="mt-6 flex flex-col gap-6">
      <select
        value={selected.id}
        onChange={(e) => setSelectedId(e.target.value)}
        className={inputClasses}
      >
        {series.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-zinc-400">Best</div>
          <div className="text-lg font-semibold">
            {best} {unit}
          </div>
        </div>
        <div>
          <div className="text-zinc-400">PRs</div>
          <div className="text-lg font-semibold">{prPoints.length}</div>
        </div>
        <div>
          <div className="text-zinc-400">Sessions</div>
          <div className="text-lg font-semibold">{selected.points.length}</div>
        </div>
      </div>

      {selected.points.length >= 2 ? (
        <ExerciseProgressChart data={selected.points} unit={unit} />
      ) : (
        <p className="text-sm text-zinc-400">
          One session logged — log another to see the trend.
        </p>
      )}

      {prPoints.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-zinc-500">Records</h2>
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
            {prPoints
              .slice()
              .reverse()
              .map((p) => (
                <li key={p.t} className="flex items-center justify-between py-2">
                  <span className="font-medium">
                    {p.value} {unit}
                  </span>
                  <span className="text-zinc-500">
                    {new Date(p.t).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
