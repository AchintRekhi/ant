-- Phase 4: gamification — activity log (powers streaks), badge definitions, and
-- earned badges. Streaks themselves live on profiles (current_streak,
-- longest_streak, last_active_date) and are recomputed from activity_log.
--
-- A "day" is the user's LOCAL day (stored as activity_log.local_date) so a
-- streak boundary follows the user's timezone, not UTC.

create type activity_source as enum ('session', 'quick');

-- One row per logged physical activity: a finished workout session, or a
-- quick-logged activity ("50 pushups"). Both feed the streak.
create table activity_log (
  id          uuid            primary key default gen_random_uuid(),
  user_id     uuid            not null references auth.users (id) on delete cascade,
  local_date  date            not null,
  source      activity_source not null,
  description text,
  -- For source = 'session', the session it came from (so finishing is idempotent).
  session_id  uuid            references workout_sessions (id) on delete cascade,
  created_at  timestamptz     not null default now()
);
create index activity_log_user_date_idx on activity_log (user_id, local_date desc);
-- A given session contributes at most one activity row.
create unique index activity_log_session_idx
  on activity_log (session_id) where session_id is not null;

-- Data-driven badge catalogue. The engine reads `kind` + `threshold`; adding a
-- badge is a data insert, not a code change.
--   kind 'streak'   → awarded when longest_streak >= threshold
--   kind 'workouts' → awarded when total activity count >= threshold
--   kind 'first_pr' → awarded once the user has any PR set
create table badges (
  code        text     primary key,
  name        text     not null,
  description text     not null,
  kind        text     not null check (kind in ('streak', 'workouts', 'first_pr')),
  threshold   integer  check (threshold is null or threshold > 0),
  sort_order  smallint not null default 0
);

create table user_badges (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  badge_code text        not null references badges (code) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table activity_log enable row level security;
alter table badges       enable row level security;
alter table user_badges  enable row level security;

create policy "activity_log_owner" on activity_log
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Badge definitions are public reference data — readable by any signed-in user.
create policy "badges_read" on badges
  for select to authenticated using (true);

create policy "user_badges_owner" on user_badges
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Seed badge definitions ─────────────────────────────────────────────────────
insert into badges (code, name, description, kind, threshold, sort_order) values
  ('first_workout', 'First Activity',  'Logged your first activity',        'workouts',  1,   0),
  ('streak_10',     '10-Day Streak',   'Active 10 days in a row',           'streak',    10,  10),
  ('streak_30',     '30-Day Streak',   'Active 30 days in a row',           'streak',    30,  20),
  ('streak_60',     '60-Day Streak',   'Active 60 days in a row',           'streak',    60,  30),
  ('streak_90',     '90-Day Streak',   'Active 90 days in a row',           'streak',    90,  40),
  ('streak_180',    '180-Day Streak',  'Active 180 days in a row',          'streak',    180, 50),
  ('streak_365',    '365-Day Streak',  'A full year — every single day',    'streak',    365, 60),
  ('first_pr',      'First PR',         'Set your first personal record',    'first_pr',  null, 70);
