"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormError, inputClasses } from "@/components/ui";
import { WEEKDAYS } from "@/lib/days";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import {
  addExerciseToDay,
  deleteRoutine,
  removeExerciseFromDay,
  removeRoutineDay,
  renameRoutine,
  setRoutineDay,
} from "../actions";

export type LibraryExercise = { id: string; name: string; muscleGroup: MuscleGroup };
export type RoutineDayExercise = {
  id: string;
  exerciseId: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
};
export type RoutineDayData = {
  id: string;
  dayOfWeek: number;
  label: string;
  exercises: RoutineDayExercise[];
};

export default function RoutineEditor({
  routineId,
  routineName,
  days,
  library,
}: {
  routineId: string;
  routineName: string;
  days: RoutineDayData[];
  library: LibraryExercise[];
}) {
  const router = useRouter();
  const [name, setName] = useState(routineName);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result && "error" in result && result.error) setError(result.error);
      else router.refresh();
    });
  };

  const byDay = new Map(days.map((d) => [d.dayOfWeek, d]));

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <Link href="/app/routines" className="text-sm text-zinc-500 hover:text-black">
        ← Routines
      </Link>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== routineName) run(() => renameRoutine(routineId, name));
        }}
        className="mt-3 w-full border-none bg-transparent text-2xl font-bold tracking-tight outline-none"
      />

      <FormError message={error} />

      <div className="mt-4 flex flex-col gap-3">
        {WEEKDAYS.map((wd) => {
          const day = byDay.get(wd.value);
          return (
            <DayCard
              key={wd.value}
              routineId={routineId}
              weekday={wd}
              day={day}
              library={library}
              pending={pending}
              run={run}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          if (confirm("Delete this routine? This can't be undone.")) {
            run(() => deleteRoutine(routineId));
          }
        }}
        disabled={pending}
        className="mt-8 text-sm text-red-600 underline hover:text-red-800 disabled:opacity-40"
      >
        Delete routine
      </button>
    </div>
  );
}

function DayCard({
  routineId,
  weekday,
  day,
  library,
  pending,
  run,
}: {
  routineId: string;
  weekday: { value: number; label: string };
  day?: RoutineDayData;
  library: LibraryExercise[];
  pending: boolean;
  run: (fn: () => Promise<{ error?: string } | void>) => void;
}) {
  const [label, setLabel] = useState(day?.label ?? "");
  const [picking, setPicking] = useState(false);

  if (!day) {
    return (
      <button
        type="button"
        onClick={() => run(() => setRoutineDay(routineId, weekday.value, ""))}
        disabled={pending}
        className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-left text-sm text-zinc-400 hover:border-black hover:text-black disabled:opacity-40"
      >
        + Plan {weekday.label}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {weekday.label}
        </span>
        <button
          type="button"
          onClick={() => run(() => removeRoutineDay(routineId, day.id))}
          disabled={pending}
          className="text-xs text-zinc-400 underline hover:text-black disabled:opacity-40"
        >
          Remove day
        </button>
      </div>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label !== day.label) run(() => setRoutineDay(routineId, weekday.value, label));
        }}
        placeholder="Focus (e.g. Push, Legs)"
        className="mt-2 w-full bg-transparent text-lg font-medium outline-none placeholder:text-zinc-300"
      />

      {day.exercises.length > 0 && (
        <ul className="mt-2 divide-y divide-zinc-100">
          {day.exercises.map((ex) => (
            <li key={ex.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {ex.name}
                {(ex.targetSets || ex.targetReps) && (
                  <span className="ml-2 text-zinc-400">
                    {ex.targetSets ?? "?"}×{ex.targetReps ?? "?"}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => run(() => removeExerciseFromDay(routineId, ex.id))}
                disabled={pending}
                className="text-zinc-400 hover:text-black disabled:opacity-40"
                aria-label={`Remove ${ex.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {picking ? (
        <AddExercisePicker
          library={library}
          pending={pending}
          onCancel={() => setPicking(false)}
          onAdd={(exerciseId, targetSets, targetReps) => {
            run(() =>
              addExerciseToDay(routineId, {
                dayId: day.id,
                exerciseId,
                targetSets,
                targetReps,
              }),
            );
            setPicking(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="mt-2 text-sm text-zinc-500 underline hover:text-black"
        >
          + Add exercise
        </button>
      )}
    </div>
  );
}

function AddExercisePicker({
  library,
  pending,
  onAdd,
  onCancel,
}: {
  library: LibraryExercise[];
  pending: boolean;
  onAdd: (exerciseId: string, sets: number | null, reps: number | null) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");

  const q = query.trim().toLowerCase();
  const matches = q
    ? library.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg bg-zinc-50 p-3">
      {selected ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{selected.name}</span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-zinc-400 underline hover:text-black"
            >
              Change
            </button>
          </div>
          <div className="flex gap-3">
            <NumberField value={sets} onChange={setSets} placeholder="Sets" />
            <NumberField value={reps} onChange={setReps} placeholder="Reps" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onAdd(
                  selected.id,
                  sets ? Number(sets) : null,
                  reps ? Number(reps) : null,
                )
              }
              disabled={pending}
              className="flex-1"
            >
              Add
            </Button>
          </div>
        </>
      ) : (
        <>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the library…"
            className={inputClasses}
          />
          {matches.length > 0 && (
            <ul className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
              {matches.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e)}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-zinc-100"
                  >
                    {e.name}
                    <span className="ml-2 text-xs text-zinc-400">
                      {MUSCLE_GROUPS.find((g) => g.value === e.muscleGroup)?.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="self-start text-sm text-zinc-400 underline hover:text-black"
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${inputClasses} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
    />
  );
}
