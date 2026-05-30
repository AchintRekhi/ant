-- Phase 6 redesign: exercise-based challenges.
--
-- Challenges now compete on a specific exercise rather than generic activity.
-- A challenge picks one exercise from the library and one of two measures:
--   exercise_max_weight  → rank by the heaviest single set (MAX weight_kg)
--   exercise_total_reps  → rank by total reps (SUM reps)
-- both scoped to that exercise within [starts_at, ends_at]. An optional
-- target_value lets the creator set a goal (e.g. 100 kg, 2000 reps) that the
-- scoreboard shows as progress — ranking is still highest-wins.
--
-- The old metrics (active_days / total_volume / longest_streak) are dropped.
-- finalize_challenge() is metric-agnostic (it just calls the leaderboard), so
-- it is left untouched.

-- A couple of throwaway test challenges exist under the old metrics; they can't
-- be converted to the new model (no exercise) and none are finalized, so no
-- points are unwound. Clear them so the enum swap's cast has nothing to choke on.
delete from challenges;

-- ── Swap the metric enum ─────────────────────────────────────────────────────
-- The old and new label sets don't overlap, so cast through text. The
-- leaderboard depends on the enum, so drop it first (it's rewritten below);
-- finalize_challenge resolves the leaderboard by name at runtime and is fine.
drop function if exists public.challenge_leaderboard(uuid);

create type challenge_metric_new as enum ('exercise_max_weight', 'exercise_total_reps');
alter table challenges
  alter column metric type challenge_metric_new using (metric::text::challenge_metric_new);
drop type challenge_metric;
alter type challenge_metric_new rename to challenge_metric;

-- ── New challenge columns ────────────────────────────────────────────────────
-- exercise_id: which lift the challenge is about. RESTRICT on delete mirrors
-- session_exercises.exercise_id so deleting an exercise can't silently erase a
-- challenge's basis. target_value: optional goal (stored metric — kg for weight
-- challenges; a raw rep count for rep challenges).
alter table challenges
  add column exercise_id uuid not null references exercises (id) on delete restrict;
alter table challenges
  add column target_value numeric,
  add constraint target_positive check (target_value is null or target_value > 0);

-- ── Rewritten live leaderboard ───────────────────────────────────────────────
-- Same signature + semantics as before (one row per participant, including a 0
-- for those with no matching sets, so finalize still awards the +5). The
-- exercise filter lives in the LEFT JOIN ON clause precisely to keep that
-- zero-activity row. Visibility is gated up front by can_view_challenge.
create function public.challenge_leaderboard(c_id uuid)
returns table (user_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  m  challenge_metric;
  s  date;
  e  date;
  ex uuid;
begin
  if not public.can_view_challenge(c_id) then return; end if;

  select metric, starts_at, ends_at, exercise_id
    into m, s, e, ex
    from challenges where id = c_id;
  if m is null then return; end if;

  if m = 'exercise_max_weight' then
    return query
      select cp.user_id,
             coalesce(max(st.weight_kg), 0)::numeric as score
        from challenge_participants cp
        left join workout_sessions ws
          on ws.user_id   = cp.user_id
         and ws.ended_at is not null
         and (ws.started_at::date) between s and e
        left join session_exercises se
          on se.session_id  = ws.id
         and se.exercise_id = ex
        left join sets st on st.session_exercise_id = se.id
       where cp.challenge_id = c_id
       group by cp.user_id;

  elsif m = 'exercise_total_reps' then
    return query
      select cp.user_id,
             coalesce(sum(st.reps), 0)::numeric as score
        from challenge_participants cp
        left join workout_sessions ws
          on ws.user_id   = cp.user_id
         and ws.ended_at is not null
         and (ws.started_at::date) between s and e
        left join session_exercises se
          on se.session_id  = ws.id
         and se.exercise_id = ex
        left join sets st on st.session_exercise_id = se.id
       where cp.challenge_id = c_id
       group by cp.user_id;
  end if;
end;
$$;
revoke execute on function public.challenge_leaderboard(uuid) from anon;
