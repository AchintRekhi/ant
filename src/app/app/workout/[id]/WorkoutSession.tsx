"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, FormError, inputClasses } from "@/components/ui";
import { kgToLbs, lbsToKg, type Units } from "@/lib/units";
import type { MuscleGroup } from "@/lib/exercises";
import {
  addSessionExercise,
  addSet,
  deleteSession,
  finishSession,
  removeSessionExercise,
  removeSessionPhoto,
  removeSet,
  saveNotes,
  updateSet,
  uploadSessionPhoto,
} from "../actions";

export type LibraryExercise = { id: string; name: string; muscleGroup: MuscleGroup };
export type SetData = {
  id: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  isPr: boolean;
};
export type SessionExerciseData = {
  id: string;
  exerciseId: string;
  name: string;
  sets: SetData[];
};

export default function WorkoutSession({
  sessionId,
  startedAt,
  endedAt,
  title,
  notes,
  photoUrl,
  units,
  exercises,
  library,
}: {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  title: string;
  notes: string;
  photoUrl: string | null;
  units: Units;
  exercises: SessionExerciseData[];
  library: LibraryExercise[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(undefined);
    startTransition(async () => {
      const result = await fn();
      if (result && "error" in result && result.error) setError(result.error);
      else router.refresh();
    });
  };

  const unit = units === "imperial" ? "lb" : "kg";

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8">
      <Link href="/app/workout" className="text-sm text-zinc-500 hover:text-black">
        ← Workouts
      </Link>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <span className="text-sm text-zinc-400">
          {endedAt ? "Finished" : "In progress"}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">{formatDateTime(startedAt)}</p>

      <FormError message={error} />

      <div className="mt-6 flex flex-col gap-4">
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            sessionId={sessionId}
            ex={ex}
            unit={unit}
            units={units}
            pending={pending}
            run={run}
          />
        ))}
      </div>

      {picking ? (
        <ExercisePicker
          library={library}
          pending={pending}
          onCancel={() => setPicking(false)}
          onPick={(exerciseId) => {
            run(() => addSessionExercise(sessionId, exerciseId));
            setPicking(false);
          }}
        />
      ) : (
        <Button variant="ghost" onClick={() => setPicking(true)} className="mt-4 w-full">
          + Add exercise
        </Button>
      )}

      <NotesField sessionId={sessionId} initial={notes} />

      <PhotoField
        sessionId={sessionId}
        photoUrl={photoUrl}
        pending={pending}
        run={run}
      />

      <div className="mt-8 flex flex-col gap-3">
        {!endedAt && (
          <Button onClick={() => run(() => finishSession(sessionId))} disabled={pending}>
            {pending ? "Finishing…" : "Finish workout"}
          </Button>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this workout? This can't be undone.")) {
              run(() => deleteSession(sessionId));
            }
          }}
          disabled={pending}
          className="text-sm text-red-600 underline hover:text-red-800 disabled:opacity-40"
        >
          Delete workout
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({
  sessionId,
  ex,
  unit,
  units,
  pending,
  run,
}: {
  sessionId: string;
  ex: SessionExerciseData;
  unit: string;
  units: Units;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string } | void>) => void;
}) {
  const lastSet = ex.sets[ex.sets.length - 1];

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{ex.name}</h2>
        <button
          type="button"
          onClick={() => run(() => removeSessionExercise(sessionId, ex.id))}
          disabled={pending}
          className="text-xs text-zinc-400 underline hover:text-black disabled:opacity-40"
        >
          Remove
        </button>
      </div>

      {ex.sets.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-6">#</span>
            <span className="flex-1">Weight ({unit})</span>
            <span className="flex-1">Reps</span>
            <span className="w-12" />
          </div>
          {ex.sets.map((s) => (
            <SetRow
              key={s.id}
              sessionId={sessionId}
              set={s}
              units={units}
              pending={pending}
              run={run}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          run(() =>
            addSet(sessionId, ex.id, {
              reps: lastSet?.reps ?? 0,
              weightKg: lastSet?.weightKg ?? 0,
            }),
          )
        }
        disabled={pending}
        className="mt-3 text-sm text-zinc-500 underline hover:text-black disabled:opacity-40"
      >
        + Add set
      </button>
    </div>
  );
}

function SetRow({
  sessionId,
  set,
  units,
  pending,
  run,
}: {
  sessionId: string;
  set: SetData;
  units: Units;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string } | void>) => void;
}) {
  const toDisplay = (kg: number) =>
    units === "imperial" ? Math.round(kgToLbs(kg) * 10) / 10 : kg;
  const toKg = (display: number) => (units === "imperial" ? lbsToKg(display) : display);

  const [weight, setWeight] = useState(set.weightKg ? String(toDisplay(set.weightKg)) : "");
  const [reps, setReps] = useState(set.reps ? String(set.reps) : "");

  const commit = () => {
    const w = toKg(Number(weight) || 0);
    const r = Number(reps) || 0;
    if (Math.abs(w - set.weightKg) < 0.001 && r === set.reps) return;
    run(() => updateSet(sessionId, set.id, { reps: r, weightKg: w }));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-sm text-zinc-400">{set.setNumber}</span>
      <input
        type="number"
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={commit}
        placeholder="0"
        className="w-full flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <input
        type="number"
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={commit}
        placeholder="0"
        className="w-full flex-1 rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-black [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="flex w-12 items-center justify-end gap-1">
        {set.isPr && (
          <span className="rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-white">
            PR
          </span>
        )}
        <button
          type="button"
          onClick={() => run(() => removeSet(sessionId, set.id))}
          disabled={pending}
          className="text-zinc-300 hover:text-black disabled:opacity-40"
          aria-label="Remove set"
        >
          ✕
        </button>
      </span>
    </div>
  );
}

function NotesField({ sessionId, initial }: { sessionId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const [, startTransition] = useTransition();
  return (
    <div className="mt-6">
      <label className="text-sm font-medium text-zinc-500">Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== initial) startTransition(() => void saveNotes(sessionId, notes));
        }}
        rows={2}
        placeholder="How did it go?"
        className={`mt-2 ${inputClasses} resize-none`}
      />
    </div>
  );
}

function PhotoField({
  sessionId,
  photoUrl,
  pending,
  run,
}: {
  sessionId: string;
  photoUrl: string | null;
  pending: boolean;
  run: (fn: () => Promise<{ error?: string } | void>) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("sessionId", sessionId);
    fd.append("photo", file);
    setBusy(true);
    startTransition(async () => {
      await uploadSessionPhoto(fd);
      setBusy(false);
      router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="mt-6">
      <label className="text-sm font-medium text-zinc-500">Photo</label>
      {photoUrl ? (
        <div className="mt-2 flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Workout" className="w-full rounded-lg border border-zinc-200" />
          <button
            type="button"
            onClick={() => run(() => removeSessionPhoto(sessionId))}
            disabled={pending}
            className="self-start text-sm text-zinc-400 underline hover:text-black disabled:opacity-40"
          >
            Remove photo
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <Button variant="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? "Uploading…" : "Add a photo"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPick}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

function ExercisePicker({
  library,
  pending,
  onPick,
  onCancel,
}: {
  library: LibraryExercise[];
  pending: boolean;
  onPick: (exerciseId: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? library.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 10)
    : library.slice(0, 10);

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg bg-zinc-50 p-3">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the library…"
        className={inputClasses}
      />
      <ul className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
        {matches.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onPick(e.id)}
              className="block w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-40"
            >
              {e.name}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        className="self-start text-sm text-zinc-400 underline hover:text-black"
      >
        Cancel
      </button>
    </div>
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
