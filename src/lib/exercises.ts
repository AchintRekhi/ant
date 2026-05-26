import type { Enums } from "@/lib/supabase/database.types";

export type MuscleGroup = Enums<"muscle_group">;

// Display order + labels for muscle groups. Order is used wherever exercises
// are grouped in the UI.
export const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "arms", label: "Arms" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "full_body", label: "Full body" },
  { value: "other", label: "Other" },
];

const LABELS = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.value, g.label]));

export function muscleGroupLabel(group: MuscleGroup): string {
  return LABELS[group] ?? group;
}
