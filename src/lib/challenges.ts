import { kgToLbs, type Units } from "@/lib/units";

// Single source of truth for the metric-facing copy. The DB enum stays the
// authoritative type — these are just labels for the UI.
//
// Every challenge targets one exercise; the metric decides how that exercise is
// scored over the window:
//   exercise_max_weight  → heaviest single set (MAX weight_kg)
//   exercise_total_reps  → total reps logged (SUM reps)
export type Metric = "exercise_max_weight" | "exercise_total_reps";

export const METRICS: { value: Metric; label: string; tagline: string }[] = [
  { value: "exercise_max_weight", label: "Heaviest weight", tagline: "Rank by your top single-set weight on this exercise." },
  { value: "exercise_total_reps", label: "Total reps",      tagline: "Rank by total reps logged on this exercise in the window." },
];

export function metricLabel(m: Metric): string {
  return METRICS.find((x) => x.value === m)?.label ?? m;
}

/** Whether the metric is measured in weight (vs. a raw rep count). */
export function isWeightMetric(m: Metric): boolean {
  return m === "exercise_max_weight";
}

/** Status label derived from the date window and finalized_at. */
export type Status = "upcoming" | "active" | "ended" | "finalized";

export function challengeStatus(args: {
  startsAt: string;
  endsAt: string;
  finalizedAt: string | null;
}): Status {
  if (args.finalizedAt) return "finalized";
  const today = new Date().toISOString().slice(0, 10);
  if (today < args.startsAt) return "upcoming";
  if (today > args.endsAt) return "ended"; // window over but points not awarded yet
  return "active";
}

/** Inclusive day count of a date window — used for "ends in N days" copy. */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Format a score/target value for display, per metric (and weight units). */
export function formatScore(metric: Metric, value: number, units: Units): string {
  if (isWeightMetric(metric)) {
    // score is in kg (DB is metric); convert at the UI layer only.
    const display = units === "imperial" ? kgToLbs(value) : value;
    const unit = units === "imperial" ? "lb" : "kg";
    return `${Math.round(display).toLocaleString()} ${unit}`;
  }
  // exercise_total_reps — a raw count.
  const reps = Math.round(value);
  return `${reps.toLocaleString()} rep${reps === 1 ? "" : "s"}`;
}

/** Alias for readability when formatting a challenge's optional target value. */
export const formatTarget = formatScore;

/** Fraction [0,1] of the way a score is toward the target. */
export function targetProgress(score: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(1, score / target));
}

/** Points awarded by final rank — mirrored from finalize_challenge(). */
export function pointsForRank(rank: number): number {
  if (rank === 1) return 50;
  if (rank === 2) return 25;
  if (rank === 3) return 10;
  return 5;
}
