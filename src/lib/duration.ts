// Workout session timing. A session is bracketed by started_at/ended_at; while
// paused, paused_at is set and the clock freezes there. total_paused_seconds is
// the sum of already-resumed pauses. The "active" duration excludes paused time.
//
// Pure (no DB, no Date.now() of its own) so it's easy to test and so the live
// timer can re-run it each tick with a fresh `now`.

export type SessionTiming = {
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  totalPausedSeconds: number;
};

/** Active (unpaused) seconds elapsed. `now` is epoch ms (Date.now()). */
export function activeSeconds(t: SessionTiming, now: number): number {
  const start = new Date(t.startedAt).getTime();
  // Freeze at ended_at if finished, else at paused_at if paused, else live.
  const end = t.endedAt
    ? new Date(t.endedAt).getTime()
    : t.pausedAt
      ? new Date(t.pausedAt).getTime()
      : now;
  const seconds = Math.round((end - start) / 1000) - t.totalPausedSeconds;
  return Math.max(0, seconds);
}

/** Clock form for the live timer: "M:SS" under an hour, else "H:MM:SS". */
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/** Compact form for history: "1h 23m", "23m", or "<1m". */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}
