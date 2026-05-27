-- 0009: pause support for workout sessions (and thus a recorded duration).
-- started_at/ended_at already bracket a session, so total elapsed time was
-- always derivable; these columns let the user pause mid-workout so paused
-- time is excluded from the *active* duration we show.
--   paused_at            — set while the session is currently paused (else null)
--   total_paused_seconds — accumulated paused time from already-resumed pauses
-- Active duration = (ended_at ?? paused_at ?? now) − started_at − total_paused_seconds.

alter table workout_sessions
  add column paused_at            timestamptz,
  add column total_paused_seconds integer not null default 0
    check (total_paused_seconds >= 0);
