"use client";

import { useState, useTransition } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import { METRICS, type Metric } from "@/lib/challenges";
import { createChallenge } from "../actions";

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type Privacy = "public" | "private";

export default function NewChallengeForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("private");
  const [metric, setMetric] = useState<Metric>("active_days");
  // Default: a one-week window starting today. People tend to want short
  // first runs; tightening the default keeps that easy.
  const [startsAt, setStartsAt] = useState(todayIso());
  const [endsAt,   setEndsAt]   = useState(inDaysIso(7));

  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(undefined);
    startTransition(async () => {
      const result = await createChallenge({
        name,
        description: description.trim() || undefined,
        privacy,
        metric,
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
          placeholder="June 50-day push"
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

      <Field label="Metric" hint={tagline}>
        <Pills
          options={METRICS.map((m) => ({ value: m.value, label: m.label }))}
          value={metric}
          onChange={setMetric}
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
          disabled={pending || name.trim().length === 0}
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
