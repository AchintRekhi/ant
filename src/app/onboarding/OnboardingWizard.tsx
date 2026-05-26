"use client";

import { useMemo, useState } from "react";
import { Button, FormError, inputClasses } from "@/components/ui";
import { feetInchesToCm, lbsToKg } from "@/lib/units";
import { ageFromDob, GOAL_TYPES } from "@/lib/validation";
import {
  availabilityColor,
  useUsernameAvailability,
} from "@/lib/useUsernameAvailability";
import { checkUsername, completeOnboarding } from "./actions";

type Units = "metric" | "imperial";
type Gender = "male" | "female" | "other" | "prefer_not_to_say";
type Experience = "beginner" | "intermediate" | "advanced";
type GoalType = (typeof GOAL_TYPES)[number];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const EXPERIENCE: { value: Experience; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "New to training" },
  { value: "intermediate", label: "Intermediate", hint: "Train regularly" },
  { value: "advanced", label: "Advanced", hint: "Years of experience" },
];

const GOALS: { value: GoalType; label: string }[] = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "get_stronger", label: "Get stronger" },
  { value: "stay_consistent", label: "Stay consistent" },
];

const STEP_COUNT = 9;

export default function OnboardingWizard({
  suggestedUsername,
}: {
  suggestedUsername: string;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // Field state.
  const [username, setUsername] = useState(suggestedUsername);
  const [units, setUnits] = useState<Units>("metric");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weight, setWeight] = useState("");
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );
  const [experience, setExperience] = useState<Experience | "">("");
  const [goals, setGoals] = useState<GoalType[]>([]);

  const { status: usernameStatus, message: usernameMessage } =
    useUsernameAvailability(username);

  const back = () => {
    setError(undefined);
    setStep((s) => Math.max(0, s - 1));
  };
  const next = () => {
    setError(undefined);
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  };

  // ── Per-step validity (gates the Next button) ──────────────────────────────
  const computedHeightCm = useMemo(() => {
    if (units === "metric") return Number(heightCm);
    return feetInchesToCm(Number(heightFt || 0), Number(heightIn || 0));
  }, [units, heightCm, heightFt, heightIn]);

  const computedWeightKg = useMemo(() => {
    const n = Number(weight);
    if (!n) return 0;
    return units === "metric" ? n : lbsToKg(n);
  }, [units, weight]);

  const dobAge = dob ? ageFromDob(dob) : null;

  const stepValid = (): boolean => {
    switch (step) {
      case 0:
        return /^[a-z0-9_]{3,30}$/.test(username.trim().toLowerCase());
      case 1:
        return true; // units always has a default
      case 2:
        return dobAge !== null && dobAge >= 13 && dobAge <= 100;
      case 3:
        return gender !== "";
      case 4:
        return computedHeightCm >= 50 && computedHeightCm <= 300;
      case 5:
        return computedWeightKg >= 20 && computedWeightKg <= 500;
      case 6:
        return timezone.trim().length > 0;
      case 7:
        return experience !== "";
      case 8:
        return goals.length > 0;
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!stepValid()) return;
    // Username availability is checked server-side before advancing.
    if (step === 0) {
      // The live check already confirmed it; otherwise verify before advancing.
      if (usernameStatus !== "available") {
        setBusy(true);
        const result = await checkUsername(username);
        setBusy(false);
        if (!result.available) {
          setError(result.error ?? "That username isn't available.");
          return;
        }
      }
    }
    next();
  };

  const handleFinish = async () => {
    if (!stepValid()) return;
    setBusy(true);
    setError(undefined);
    const result = await completeOnboarding({
      username: username.trim().toLowerCase(),
      units,
      dob,
      gender: gender as Gender,
      heightCm: computedHeightCm,
      weightKg: computedWeightKg,
      timezone,
      experienceLevel: experience as Experience,
      goals,
    });
    // On success the action redirects; we only get here on error.
    setBusy(false);
    if (result?.error) setError(result.error);
  };

  const toggleGoal = (g: GoalType) =>
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const maxDob = isoDateYearsAgo(13);
  const minDob = isoDateYearsAgo(100);

  return (
    <main className="flex min-h-full flex-1 flex-col bg-white px-6 py-8 text-black">
      <ProgressDots total={STEP_COUNT} current={step} />

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-8">
        {step === 0 && (
          <Step title="Pick a username" subtitle="This is how others find you.">
            <div className="flex items-center rounded-lg border border-zinc-300 px-4 focus-within:border-black">
              <span className="text-lg text-zinc-400">@</span>
              <input
                autoFocus
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                placeholder="username"
                className="w-full bg-transparent py-3 pl-1 text-lg outline-none placeholder:text-zinc-400"
              />
            </div>
            <p className={`mt-2 text-xs ${availabilityColor(usernameStatus)}`}>
              {usernameStatus === "checking"
                ? "Checking availability…"
                : usernameStatus === "available"
                  ? "✓ Available"
                  : usernameStatus === "taken" || usernameStatus === "invalid"
                    ? usernameMessage
                    : "3–30 characters: lowercase letters, numbers, underscores."}
            </p>
          </Step>
        )}

        {step === 1 && (
          <Step title="Preferred units" subtitle="You can change this later.">
            <Choice
              options={[
                { value: "metric", label: "Metric", hint: "kg, cm" },
                { value: "imperial", label: "Imperial", hint: "lb, ft/in" },
              ]}
              value={units}
              onChange={(v) => setUnits(v as Units)}
            />
          </Step>
        )}

        {step === 2 && (
          <Step
            title="Date of birth"
            subtitle="Used only to calculate your age — never shown to anyone."
          >
            <input
              type="date"
              value={dob}
              min={minDob}
              max={maxDob}
              onChange={(e) => setDob(e.target.value)}
              className={inputClasses}
            />
            {dobAge !== null && dobAge >= 13 && dobAge <= 100 && (
              <p className="mt-2 text-sm text-zinc-500">Age {dobAge}.</p>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step title="Gender">
            <Choice
              options={GENDERS}
              value={gender}
              onChange={(v) => setGender(v as Gender)}
            />
          </Step>
        )}

        {step === 4 && (
          <Step title="How tall are you?">
            {units === "metric" ? (
              <Measure
                value={heightCm}
                onChange={setHeightCm}
                suffix="cm"
                placeholder="175"
                autoFocus
              />
            ) : (
              <div className="flex gap-3">
                <Measure
                  value={heightFt}
                  onChange={setHeightFt}
                  suffix="ft"
                  placeholder="5"
                  autoFocus
                />
                <Measure
                  value={heightIn}
                  onChange={setHeightIn}
                  suffix="in"
                  placeholder="9"
                />
              </div>
            )}
          </Step>
        )}

        {step === 5 && (
          <Step
            title="Current bodyweight"
            subtitle="We'll start tracking your trend from here."
          >
            <Measure
              value={weight}
              onChange={setWeight}
              suffix={units === "metric" ? "kg" : "lb"}
              placeholder={units === "metric" ? "70" : "155"}
              autoFocus
            />
          </Step>
        )}

        {step === 6 && (
          <Step
            title="Your timezone"
            subtitle="Keeps streaks and reminders on your local day."
          >
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputClasses}
            />
          </Step>
        )}

        {step === 7 && (
          <Step title="Experience level">
            <Choice
              options={EXPERIENCE}
              value={experience}
              onChange={(v) => setExperience(v as Experience)}
            />
          </Step>
        )}

        {step === 8 && (
          <Step title="What are your goals?" subtitle="Pick one or more.">
            <div className="flex flex-col gap-3">
              {GOALS.map((g) => {
                const active = goals.includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleGoal(g.value)}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-lg transition ${
                      active
                        ? "border-black bg-black text-white"
                        : "border-zinc-300 hover:border-black"
                    }`}
                  >
                    {g.label}
                    <span>{active ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        <FormError message={error} />
      </div>

      <div className="mx-auto flex w-full max-w-sm gap-3">
        {step > 0 && (
          <Button variant="ghost" onClick={back} disabled={busy}>
            Back
          </Button>
        )}
        {step < STEP_COUNT - 1 ? (
          <Button
            onClick={handleNext}
            disabled={
              !stepValid() ||
              busy ||
              (step === 0 &&
                (usernameStatus === "taken" ||
                  usernameStatus === "checking" ||
                  usernameStatus === "invalid"))
            }
            className="flex-1"
          >
            {busy ? "Checking…" : "Continue"}
          </Button>
        ) : (
          <Button
            onClick={handleFinish}
            disabled={!stepValid() || busy}
            className="flex-1"
          >
            {busy ? "Finishing…" : "Finish"}
          </Button>
        )}
      </div>
    </main>
  );
}

// ── Presentational pieces ─────────────────────────────────────────────────────

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="mx-auto flex w-full max-w-sm items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition ${
            i <= current ? "bg-black" : "bg-zinc-200"
          }`}
        />
      ))}
    </div>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T | "";
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-lg transition ${
              active
                ? "border-black bg-black text-white"
                : "border-zinc-300 hover:border-black"
            }`}
          >
            <span>{o.label}</span>
            {o.hint && (
              <span
                className={`text-sm ${active ? "text-zinc-300" : "text-zinc-400"}`}
              >
                {o.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Measure({
  value,
  onChange,
  suffix,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-1 items-center rounded-lg border border-zinc-300 px-4 focus-within:border-black">
      <input
        type="number"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent py-3 text-lg outline-none placeholder:text-zinc-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="pl-2 text-lg text-zinc-400">{suffix}</span>
    </div>
  );
}

// Today minus N years, as YYYY-MM-DD (for the date input bounds).
function isoDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}
