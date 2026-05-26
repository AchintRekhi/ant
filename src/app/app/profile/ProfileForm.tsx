"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, FormError, inputClasses } from "@/components/ui";
import {
  cmToFeetInches,
  feetInchesToCm,
  type Units,
} from "@/lib/units";
import { GOAL_TYPES } from "@/lib/validation";
import {
  availabilityColor,
  useUsernameAvailability,
} from "@/lib/useUsernameAvailability";
import { updateAvatar, updateProfile } from "./actions";

type Gender = "male" | "female" | "other" | "prefer_not_to_say";
type Experience = "beginner" | "intermediate" | "advanced";
type Privacy = "public" | "private";
type GoalType = (typeof GOAL_TYPES)[number];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const GOALS: { value: GoalType; label: string }[] = [
  { value: "lose_weight", label: "Lose weight" },
  { value: "build_muscle", label: "Build muscle" },
  { value: "get_stronger", label: "Get stronger" },
  { value: "stay_consistent", label: "Stay consistent" },
];

export type ProfileInitial = {
  username: string;
  displayName: string;
  bio: string;
  gender: Gender;
  heightCm: number;
  units: Units;
  privacy: Privacy;
  experienceLevel: Experience;
  goals: GoalType[];
};

export default function ProfileForm({
  initial,
  age,
  avatarUrl,
}: {
  initial: ProfileInitial;
  age: number | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(initial.username);
  const { status: usernameStatus, message: usernameMessage } =
    useUsernameAvailability(username, initial.username.trim().toLowerCase());
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [units, setUnits] = useState<Units>(initial.units);
  const [privacy, setPrivacy] = useState<Privacy>(initial.privacy);
  const [experience, setExperience] = useState<Experience>(initial.experienceLevel);
  const [goals, setGoals] = useState<GoalType[]>(initial.goals);

  // Height kept as separate display strings; the active pair depends on `units`.
  const seedFtIn = cmToFeetInches(initial.heightCm || 0);
  const [heightCmStr, setHeightCmStr] = useState(
    initial.heightCm ? String(Math.round(initial.heightCm)) : "",
  );
  const [heightFt, setHeightFt] = useState(
    initial.heightCm ? String(seedFtIn.feet) : "",
  );
  const [heightIn, setHeightIn] = useState(
    initial.heightCm ? String(seedFtIn.inches) : "",
  );

  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [avatarBusy, setAvatarBusy] = useState(false);

  const computedHeightCm =
    units === "metric"
      ? Number(heightCmStr)
      : feetInchesToCm(Number(heightFt || 0), Number(heightIn || 0));

  // Convert the displayed height when switching units so the value is preserved.
  const switchUnits = (next: Units) => {
    if (next === units) return;
    if (next === "imperial") {
      const { feet, inches } = cmToFeetInches(Number(heightCmStr) || 0);
      setHeightFt(heightCmStr ? String(feet) : "");
      setHeightIn(heightCmStr ? String(inches) : "");
    } else {
      const cm = feetInchesToCm(Number(heightFt || 0), Number(heightIn || 0));
      setHeightCmStr(cm ? String(Math.round(cm)) : "");
    }
    setUnits(next);
  };

  const toggleGoal = (g: GoalType) =>
    setGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  const save = () => {
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      const result = await updateProfile({
        username: username.trim().toLowerCase(),
        displayName,
        bio,
        gender,
        heightCm: computedHeightCm,
        units,
        privacy,
        experienceLevel: experience,
        goals,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  const onAvatarPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    setError(undefined);
    setAvatarBusy(true);
    startTransition(async () => {
      const result = await updateAvatar(formData);
      setAvatarBusy(false);
      if (result.error) setError(result.error);
      else router.refresh();
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <div className="mt-8 flex flex-col gap-8">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-2xl font-semibold text-zinc-400">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (displayName || username || "?").charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <Button
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy || pending}
          >
            {avatarBusy ? "Uploading…" : "Change photo"}
          </Button>
          <p className="mt-1 text-xs text-zinc-400">JPEG, PNG, or WebP. Max 5 MB.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onAvatarPicked}
            className="hidden"
          />
        </div>
      </div>

      <Field label="Username">
        <div className="flex items-center rounded-lg border border-zinc-300 px-4 focus-within:border-black">
          <span className="text-lg text-zinc-400">@</span>
          <input
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
            }
            className="w-full bg-transparent py-3 pl-1 text-lg outline-none placeholder:text-zinc-400"
          />
        </div>
        {usernameStatus !== "idle" && (
          <p className={`text-xs ${availabilityColor(usernameStatus)}`}>
            {usernameStatus === "checking"
              ? "Checking availability…"
              : usernameStatus === "available"
                ? "✓ Available"
                : usernameMessage}
          </p>
        )}
      </Field>

      <Field label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={inputClasses}
        />
      </Field>

      <Field label="Bio">
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="A short bio (optional)."
          className={`${inputClasses} resize-none`}
        />
      </Field>

      {age !== null && (
        <Field label="Age">
          <p className="text-lg">{age}</p>
        </Field>
      )}

      <Field label="Gender">
        <Pills
          options={GENDERS}
          value={gender}
          onChange={(v) => setGender(v)}
        />
      </Field>

      <Field label="Units">
        <Pills
          options={[
            { value: "metric" as Units, label: "Metric" },
            { value: "imperial" as Units, label: "Imperial" },
          ]}
          value={units}
          onChange={switchUnits}
        />
      </Field>

      <Field label="Height">
        {units === "metric" ? (
          <Measure
            value={heightCmStr}
            onChange={setHeightCmStr}
            suffix="cm"
            placeholder="175"
          />
        ) : (
          <div className="flex gap-3">
            <Measure value={heightFt} onChange={setHeightFt} suffix="ft" placeholder="5" />
            <Measure value={heightIn} onChange={setHeightIn} suffix="in" placeholder="9" />
          </div>
        )}
      </Field>

      <Field label="Experience">
        <Pills
          options={EXPERIENCE}
          value={experience}
          onChange={(v) => setExperience(v)}
        />
      </Field>

      <Field
        label="Account privacy"
        hint={
          privacy === "private"
            ? "Only approved followers can see your activity."
            : "Anyone can view your profile."
        }
      >
        <Pills
          options={[
            { value: "private" as Privacy, label: "Private" },
            { value: "public" as Privacy, label: "Public" },
          ]}
          value={privacy}
          onChange={(v) => setPrivacy(v)}
        />
      </Field>

      <Field label="Goals">
        <div className="flex flex-wrap gap-2">
          {GOALS.map((g) => {
            const active = goals.includes(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => toggleGoal(g.value)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  active
                    ? "border-black bg-black text-white"
                    : "border-zinc-300 hover:border-black"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-white py-4">
        <FormError message={error} />
        {saved && !error && (
          <p className="text-sm text-zinc-500" aria-live="polite">
            Saved.
          </p>
        )}
        <Button
          onClick={save}
          disabled={
            pending ||
            avatarBusy ||
            usernameStatus === "taken" ||
            usernameStatus === "invalid" ||
            usernameStatus === "checking"
          }
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// ── Presentational pieces ─────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-2">
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
  onChange: (value: T) => void;
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

function Measure({
  value,
  onChange,
  suffix,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  suffix: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-1 items-center rounded-lg border border-zinc-300 px-4 focus-within:border-black">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent py-3 text-lg outline-none placeholder:text-zinc-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="pl-2 text-lg text-zinc-400">{suffix}</span>
    </div>
  );
}
