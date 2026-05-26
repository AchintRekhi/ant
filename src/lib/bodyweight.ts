// Bodyweight cadence helpers. Users are nudged to re-log their weight every
// 15 days (the trend chart needs reasonably regular points to be useful).

export const WEIGH_IN_INTERVAL_DAYS = 15;

const MS_PER_DAY = 86_400_000;

/** Whole days between an ISO timestamp and now (floored, never negative). */
export function daysSince(iso: string): number {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / MS_PER_DAY));
}

/** True when it's time to nudge a weigh-in: no entries yet, or the last one is ≥15 days old. */
export function weighInDue(lastRecordedAt: string | null | undefined): boolean {
  if (!lastRecordedAt) return true;
  return daysSince(lastRecordedAt) >= WEIGH_IN_INTERVAL_DAYS;
}
