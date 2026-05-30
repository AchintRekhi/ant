"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import { METRICS, isWeightMetric, type Metric } from "@/lib/challenges";
import { muscleGroupLabel, type MuscleGroup } from "@/lib/exercises";
import { lbsToKg, type Units } from "@/lib/units";
import { createChallenge } from "../actions";

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type Privacy = "public" | "private";
type ExerciseOption = { id: string; name: string; muscle_group: MuscleGroup };

export default function NewChallengeForm({
  exercises,
  units,
}: {
  exercises: ExerciseOption[];
  units: Units;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("private");
  const [metric, setMetric] = useState<Metric>("exercise_max_weight");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [target, setTarget] = useState("");
  // Default: a one-week window starting today. People tend to want short
  // first runs; tightening the default keeps that easy.
  const [startsAt, setStartsAt] = useState(todayIso());
  const [endsAt,   setEndsAt]   = useState(inDaysIso(7));

  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const selectedExercise = exercises.find((e) => e.id === exerciseId);
  const filtered = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    const list = q
      ? exercises.filter((e) => e.name.toLowerCase().includes(q))
      : exercises;
    return list.slice(0, 30);
  }, [exercises, exerciseSearch]);

  const weightMetric = isWeightMetric(metric);
  const targetUnit = weightMetric ? (units === "imperial" ? "lb" : "kg") : "reps";

  const submit = () => {
    setError(undefined);

    // Target is optional. Convert weight targets to kg (the DB stores metric).
    let targetValue: number | undefined;
    const raw = target.trim();
    if (raw) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError("Target must be a positive number, or leave it blank.");
        return;
      }
      targetValue = weightMetric && units === "imperial" ? lbsToKg(n) : n;
    }

    startTransition(async () => {
      const result = await createChallenge({
        name,
        description: description.trim() || undefined,
        privacy,
        metric,
        exerciseId,
        targetValue,
        startsAt,
        endsAt,
      });
      if (result.error) setError(result.error);
    });
  };

  const tagline = METRICS.find((m) => m.value === metric)?.tagline;

  return (
    <div className="mt-8 flex flex-col gap-6">
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="June 2000-rep push"
          maxLength={80}
          className={inputClasses}
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Anything you want participants to see."
          rows={3}
          maxLength={280}
          className={`${inputClasses} resize-none`}
        />
      </Field>

      <Field
        label="Exercise"
        hint={
          selectedExercise
            ? `Scoring is based on your logged ${selectedExercise.name} sets.`
            : "Pick the lift this challenge competes on."
        }
      >
        {selectedExercise ? (
          <div className="flex items-center justify-between rounded-lg border border-black px-4 py-3">
            <span>
              <span className="font-medium">{selectedExercise.name}</span>
              <span className="ml-2 text-xs uppercase tracking-wider text-zinc-400">
                {muscleGroupLabel(selectedExercise.muscle_group)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                setExerciseId("");
                setExerciseSearch("");
              }}
              className="text-sm text-zinc-500 underline hover:text-black"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              placeholder="Search exercises…"
              className={inputClasses}
            />
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-1 py-2 text-sm text-zinc-400">No matches.</p>
              ) : (
                filtered.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setExerciseId(e.id)}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 text-left text-sm hover:border-black"
                  >
                    <span>{e.name}</span>
                    <span className="text-xs uppercase tracking-wider text-zinc-400">
                      {muscleGroupLabel(e.muscle_group)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </Field>

      <Field label="Metric" hint={tagline}>
        <Pills
          options={METRICS.map((m) => ({ value: m.value, label: m.label }))}
          value={metric}
          onChange={setMetric}
        />
      </Field>

      <Field
        label={`Target (optional)`}
        hint={
          weightMetric
            ? "Set a goal weight to race toward, or leave blank to just rank highest."
            : "Set a goal rep count to race toward, or leave blank to just rank highest."
        }
      >
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={weightMetric ? "100" : "2000"}
            className={inputClasses}
          />
          <span className="text-sm text-zinc-500">{targetUnit}</span>
        </div>
      </Field>

      <Field
        label="Privacy"
        hint={
          privacy === "private"
            ? "Only people you invite (your accepted followers) can join."
            : "Anyone signed in can find and join."
        }
      >
        <Pills
          options={[
            { value: "private" as Privacy, label: "Private" },
            { value: "public"  as Privacy, label: "Public" },
          ]}
          value={privacy}
          onChange={setPrivacy}
        />
      </Field>

      <div className="flex gap-3">
        <Field label="Starts">
          <input
            type="date"
            value={startsAt}
            min={todayIso()}
            onChange={(e) => setStartsAt(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Ends">
          <input
            type="date"
            value={endsAt}
            min={startsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputClasses}
          />
        </Field>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-white py-4">
        <FormError message={error} />
        <Button
          onClick={submit}
          disabled={pending || name.trim().length === 0 || !exerciseId}
        >
          {pending ? "Creating…" : "Create challenge"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <label className="text-sm font-medium text-zinc-500">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              active
                ? "border-black bg-black text-white"
                : "border-zinc-300 hover:border-black"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
