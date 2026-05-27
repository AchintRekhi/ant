// Pure streak math. No DB, no clock — mirrors the pr-core/pr split so it can be
// unit-tested in isolation and re-run cheaply.
//
// Streak rule (locked in the plan): activity on consecutive local days keeps the
// streak alive. A single missed day is bridged by a "freeze", but at most ONE
// freeze may be used per rolling 7-day window. Two consecutive missed days — or
// a second freeze within 7 days of the last one — ends the streak.
//
// "Today" is in progress: an unlogged today never breaks the streak on its own.
// The streak counts only days with actual activity (frozen days bridge but don't
// add to the count).

/** Days since the Unix epoch for a "YYYY-MM-DD" date, in UTC (calendar-only). */
function dayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * Current streak length given the user's active local dates and their local
 * "today". `dates` may be unsorted and contain duplicates.
 */
export function computeCurrentStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;
  const active = new Set(dates.map(dayNumber));
  const todayNum = dayNumber(today);

  const lastActive = Math.max(...active);
  // Completed missed days between the last activity and yesterday. Today itself
  // is in progress, so it isn't counted as missed.
  const frontGap = todayNum - 1 - lastActive;
  if (frontGap >= 2) return 0; // two+ days missed at the front — can't bridge.

  // One freeze may cover a single missed day at the front (yesterday).
  let lastFreezeDay: number | null = frontGap === 1 ? todayNum - 1 : null;

  let streak = 0;
  let day = lastActive;
  while (true) {
    if (active.has(day)) {
      streak++;
      day--;
      continue;
    }
    // Missed (internal) day — bridge it only if a freeze is free in this window.
    const freezeFree = lastFreezeDay === null || lastFreezeDay - day >= 7;
    if (freezeFree) {
      lastFreezeDay = day;
      day--;
      continue;
    }
    break;
  }
  return streak;
}
