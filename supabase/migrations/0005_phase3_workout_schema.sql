-- Phase 3: the core loop — exercises, routines (templates), and logged sessions.
-- All weights stored in metric (kg); converted to the user's units at the UI layer.
--
-- Ownership model:
--   * exercises are either SEEDED (created_by null, visible to everyone) or
--     CUSTOM (created_by = a user, visible only to that user).
--   * everything else is owner-scoped. Child tables (routine_days, sets, …) have
--     no user_id of their own; RLS walks up to the owning routine/session.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type muscle_group as enum (
  'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body', 'other'
);

-- ── exercises (seeded library + per-user custom) ─────────────────────────────
create table exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text         not null,
  muscle_group muscle_group not null,
  is_custom    boolean      not null default false,
  created_by   uuid         references auth.users (id) on delete cascade,
  created_at   timestamptz  not null default now(),
  -- A custom exercise has an owner; a seeded one never does.
  constraint custom_has_owner check (is_custom = (created_by is not null))
);

-- Seeded names are globally unique; custom names are unique per owner. Both
-- case-insensitive so "Bench Press" and "bench press" don't both exist.
create unique index exercises_seeded_name_idx
  on exercises (lower(name)) where created_by is null;
create unique index exercises_custom_name_idx
  on exercises (created_by, lower(name)) where created_by is not null;
create index exercises_created_by_idx on exercises (created_by);

-- ── routines (templates) ─────────────────────────────────────────────────────
create table routines (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index routines_user_idx on routines (user_id);

create trigger routines_set_updated_at
  before update on routines
  for each row execute function public.set_updated_at();

-- day_of_week: 0 = Monday … 6 = Sunday (display order). One entry per weekday.
create table routine_days (
  id          uuid     primary key default gen_random_uuid(),
  routine_id  uuid     not null references routines (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  label       text,
  unique (routine_id, day_of_week)
);
create index routine_days_routine_idx on routine_days (routine_id);

create table routine_day_exercises (
  id             uuid     primary key default gen_random_uuid(),
  routine_day_id uuid     not null references routine_days (id) on delete cascade,
  exercise_id    uuid     not null references exercises (id) on delete cascade,
  target_sets    smallint check (target_sets is null or target_sets > 0),
  target_reps    smallint check (target_reps is null or target_reps > 0),
  sort_order     smallint not null default 0
);
create index rde_day_idx on routine_day_exercises (routine_day_id);

-- ── workout sessions (what actually happened) ────────────────────────────────
create table workout_sessions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  -- Which routine day this session followed, if any. Kept even if the routine
  -- day is later deleted (set null) so the logged history survives.
  routine_day_id uuid        references routine_days (id) on delete set null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  notes          text,
  photo_url      text,
  created_at     timestamptz not null default now()
);
create index ws_user_started_idx on workout_sessions (user_id, started_at desc);

create table session_exercises (
  id          uuid     primary key default gen_random_uuid(),
  session_id  uuid     not null references workout_sessions (id) on delete cascade,
  -- restrict: an exercise with logged history can't be deleted out from under it.
  exercise_id uuid     not null references exercises (id) on delete restrict,
  sort_order  smallint not null default 0
);
create index se_session_idx on session_exercises (session_id);

create table sets (
  id                  uuid          primary key default gen_random_uuid(),
  session_exercise_id uuid          not null references session_exercises (id) on delete cascade,
  set_number          smallint      not null,
  reps                smallint      not null check (reps >= 0),
  weight_kg           numeric(6, 2) not null default 0 check (weight_kg >= 0),
  -- Flagged by the app when this set beats the user's prior best for the exercise.
  is_pr               boolean       not null default false,
  unique (session_exercise_id, set_number)
);
create index sets_se_idx on sets (session_exercise_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table exercises             enable row level security;
alter table routines              enable row level security;
alter table routine_days          enable row level security;
alter table routine_day_exercises enable row level security;
alter table workout_sessions      enable row level security;
alter table session_exercises     enable row level security;
alter table sets                  enable row level security;

-- exercises: read seeded-or-own; write only your own custom rows.
create policy "exercises_select" on exercises
  for select to authenticated
  using (created_by is null or created_by = (select auth.uid()));
create policy "exercises_insert_own_custom" on exercises
  for insert to authenticated
  with check (is_custom and created_by = (select auth.uid()));
create policy "exercises_update_own" on exercises
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
create policy "exercises_delete_own" on exercises
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- routines: owner-scoped (one policy covers all commands).
create policy "routines_owner" on routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- routine_days: owned via the parent routine.
create policy "routine_days_owner" on routine_days
  for all to authenticated
  using (exists (
    select 1 from routines r
    where r.id = routine_days.routine_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from routines r
    where r.id = routine_days.routine_id and r.user_id = (select auth.uid())
  ));

-- routine_day_exercises: owned via routine_day → routine.
create policy "rde_owner" on routine_day_exercises
  for all to authenticated
  using (exists (
    select 1 from routine_days rd
    join routines r on r.id = rd.routine_id
    where rd.id = routine_day_exercises.routine_day_id and r.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from routine_days rd
    join routines r on r.id = rd.routine_id
    where rd.id = routine_day_exercises.routine_day_id and r.user_id = (select auth.uid())
  ));

-- workout_sessions: owner-scoped.
create policy "workout_sessions_owner" on workout_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- session_exercises: owned via the parent session.
create policy "session_exercises_owner" on session_exercises
  for all to authenticated
  using (exists (
    select 1 from workout_sessions ws
    where ws.id = session_exercises.session_id and ws.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from workout_sessions ws
    where ws.id = session_exercises.session_id and ws.user_id = (select auth.uid())
  ));

-- sets: owned via session_exercise → session.
create policy "sets_owner" on sets
  for all to authenticated
  using (exists (
    select 1 from session_exercises se
    join workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from session_exercises se
    join workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id and ws.user_id = (select auth.uid())
  ));
