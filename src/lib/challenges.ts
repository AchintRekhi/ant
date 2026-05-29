import { kgToLbs, type Units } from "@/lib/units";

// Single source of truth for the metric-facing copy. The DB enum stays the
// authoritative type — these are just labels for the UI.
export type Metric = "active_days" | "total_volume" | "longest_streak";

export const METRICS: { value: Metric; label: string; tagline: string }[] = [
  { value: "active_days",    label: "Most active days",   tagline: "Distinct days with any activity in the window." },
  { value: "total_volume",   label: "Highest total volume", tagline: "Sum of reps × weight across the window." },
  { value: "longest_streak", label: "Longest streak in window", tagline: "Most consecutive active days inside the window." },
];

export function metricLabel(m: Metric): string {
  return METRICS.find((x) => x.value === m)?.label ?? m;
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

/** Format a score for display, depending on the metric (and weight units). */
export function formatScore(metric: Metric, score: number, units: Units): string {
  if (metric === "active_days") {
    return `${Math.round(score)} day${score === 1 ? "" : "s"}`;
  }
  if (metric === "longest_streak") {
    return `${Math.round(score)} day${score === 1 ? "" : "s"}`;
  }
  // total_volume — score is sum(reps * weight_kg).
  const display = units === "imperial" ? kgToLbs(score) : score;
  const rounded = Math.round(display);
  const unit = units === "imperial" ? "lb" : "kg";
  return `${rounded.toLocaleString()} ${unit}`;
}

/** Points awarded by final rank — mirrored from finalize_challenge(). */
export function pointsForRank(rank: number): number {
  if (rank === 1) return 50;
  if (rank === 2) return 25;
  if (rank === 3) return 10;
  return 5;
}
