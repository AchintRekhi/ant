-- Phase 6: challenges & points.
--
-- A challenge is a creator-defined competition over a date window with one
-- of a small set of metrics. Public challenges accept anyone; private ones
-- accept only the creator's accepted followers (the "with your friends"
-- semantics in the plan).
--
-- Scoreboards are computed on demand from the existing activity_log / sets
-- tables — we don't store running scores. When the window ends, a
-- finalize step freezes the leaderboard, awards points and stamps
-- final_rank / final_score / points_awarded so badges and the profile's
-- total_points are stable.
--
-- Points scheme (single source of truth in finalize_challenge):
--   1st place: 50  ·  2nd: 25  ·  3rd: 10  ·  any participant: +5

create type challenge_metric  as enum ('active_days', 'total_volume', 'longest_streak');
create type challenge_privacy as enum ('public', 'private');

create table challenges (
  id           uuid              primary key default gen_random_uuid(),
  creator_id   uuid              not null references auth.users (id) on delete cascade,
  name         text              not null,
  description  text,
  privacy      challenge_privacy not null,
  metric       challenge_metric  not null,
  starts_at    date              not null,
  ends_at      date              not null,
  finalized_at timestamptz,
  created_at   timestamptz       not null default now(),
  constraint dates_ordered check (ends_at >= starts_at)
);
create index challenges_creator_idx on challenges (creator_id);
create index challenges_dates_idx   on challenges (starts_at, ends_at);

create table challenge_participants (
  challenge_id   uuid    not null references challenges (id) on delete cascade,
  user_id        uuid    not null references auth.users (id) on delete cascade,
  joined_at      timestamptz not null default now(),
  final_score    numeric,            -- frozen by finalize_challenge
  final_rank     smallint,           -- frozen by finalize_challenge (1-based, ties share)
  points_awarded integer not null default 0,
  primary key (challenge_id, user_id)
);
create index cp_user_idx on challenge_participants (user_id);

-- ── Visibility helper ────────────────────────────────────────────────────────
-- A challenge is visible to: its creator, any participant, OR (if public)
-- anyone signed in. Wrapped in a SECURITY DEFINER function so the RLS
-- policies stay declarative.
create function public.can_view_challenge(c_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from challenges c
    where c.id = c_id
      and (
        c.privacy = 'public'
        or c.creator_id = auth.uid()
        or exists (
          select 1 from challenge_participants cp
          where cp.challenge_id = c.id and cp.user_id = auth.uid()
        )
      )
  );
$$;
revoke execute on function public.can_view_challenge(uuid) from anon;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table challenges             enable row level security;
alter table challenge_participants enable row level security;

create policy "challenges_select" on challenges
  for select to authenticated
  using (public.can_view_challenge(id));

create policy "challenges_insert_self" on challenges
  for insert to authenticated
  with check (creator_id = (select auth.uid()));

create policy "challenges_update_creator" on challenges
  for update to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "challenges_delete_creator" on challenges
  for delete to authenticated
  using (creator_id = (select auth.uid()));

create policy "cp_select" on challenge_participants
  for select to authenticated
  using (public.can_view_challenge(challenge_id));

-- Public challenges: a user joins themselves (window must still be open).
create policy "cp_insert_self_public" on challenge_participants
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from challenges c
      where c.id = challenge_id
        and c.privacy = 'public'
        and c.finalized_at is null
        and c.ends_at >= current_date
    )
  );

-- Private challenges: the creator invites their accepted followers. The
-- creator can also add themselves the same way.
create policy "cp_insert_creator_invite" on challenge_participants
  for insert to authenticated
  with check (
    exists (
      select 1 from challenges c
      where c.id = challenge_id
        and c.creator_id = (select auth.uid())
        and c.finalized_at is null
        and c.ends_at >= current_date
    )
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from follows f
        where f.follower_id = challenge_participants.user_id
          and f.following_id = (select auth.uid())
          and f.status       = 'accepted'
      )
    )
  );

-- Leaving: a participant can always remove themselves; the creator can
-- also remove anyone (until finalize freezes the scoreboard).
create policy "cp_delete_self_or_creator" on challenge_participants
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from challenges c
      where c.id = challenge_participants.challenge_id
        and c.creator_id = (select auth.uid())
        and c.finalized_at is null
    )
  );

-- ── Live leaderboard ─────────────────────────────────────────────────────────
-- One SQL surface for the three metrics. SECURITY DEFINER so it can read
-- participants' activity_log / sets rows regardless of whether the caller
-- follows them — visibility is gated up front by can_view_challenge.
--
-- Score semantics:
--   active_days     count of distinct local dates with any activity
--   total_volume    sum of reps × weight_kg for sets in finished sessions
--                   whose start_date falls inside the window
--   longest_streak  longest run of consecutive active_days inside the window
create function public.challenge_leaderboard(c_id uuid)
returns table (user_id uuid, score numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  m challenge_metric;
  s date;
  e date;
begin
  if not public.can_view_challenge(c_id) then return; end if;

  select metric, starts_at, ends_at into m, s, e from challenges where id = c_id;
  if m is null then return; end if;

  if m = 'active_days' then
    return query
      select cp.user_id,
             count(distinct al.local_date)::numeric as score
        from challenge_participants cp
        left join activity_log al
          on al.user_id    = cp.user_id
         and al.local_date between s and e
       where cp.challenge_id = c_id
       group by cp.user_id;

  elsif m = 'total_volume' then
    return query
      select cp.user_id,
             coalesce(sum(st.reps * st.weight_kg), 0)::numeric as score
        from challenge_participants cp
        left join workout_sessions ws
          on ws.user_id   = cp.user_id
         and ws.ended_at is not null
         and (ws.started_at::date) between s and e
        left join session_exercises se on se.session_id          = ws.id
        left join sets              st on st.session_exercise_id = se.id
       where cp.challenge_id = c_id
       group by cp.user_id;

  elsif m = 'longest_streak' then
    return query
      with dates as (
        select cp.user_id, al.local_date
          from challenge_participants cp
          left join activity_log al
            on al.user_id    = cp.user_id
           and al.local_date between s and e
         where cp.challenge_id = c_id
      ),
      distinct_dates as (
        select distinct user_id, local_date
          from dates
         where local_date is not null
      ),
      grouped as (
        -- The classic "consecutive-day groups" trick: subtract the row's
        -- ordinal from the date — runs of consecutive days collapse to a
        -- shared anchor date.
        select user_id, local_date,
               local_date - (row_number() over (partition by user_id order by local_date))::int as grp
          from distinct_dates
      ),
      runs as (
        select user_id, grp, count(*)::int as len
          from grouped
         group by user_id, grp
      )
      select cp.user_id,
             coalesce(max(r.len), 0)::numeric as score
        from challenge_participants cp
        left join runs r on r.user_id = cp.user_id
       where cp.challenge_id = c_id
       group by cp.user_id;
  end if;
end;
$$;
revoke execute on function public.challenge_leaderboard(uuid) from anon;

-- ── Finalize (idempotent) ────────────────────────────────────────────────────
-- Once the window has ended, freeze the leaderboard, award points and bump
-- profiles.total_points. Safe to call multiple times — it short-circuits if
-- finalized_at is already set, or if the challenge hasn't ended yet.
--
-- Ties share their rank "Olympic" style (two 1sts → next is 3rd). Points
-- for shared ranks: both share-1sts get the 1st-place award.
create function public.finalize_challenge(c_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c challenges%rowtype;
begin
  select * into c from challenges where id = c_id for update;
  if not found then return; end if;
  if c.finalized_at is not null then return; end if;
  if c.ends_at >= current_date then return; end if;

  -- Compute scores → ranks (descending, dense for ties as described above).
  with scored as (
    select user_id, score from public.challenge_leaderboard(c_id)
  ),
  ranked as (
    select user_id, score,
           rank() over (order by score desc) as r
      from scored
  )
  update challenge_participants cp
     set final_score    = r.score,
         final_rank     = r.r,
         points_awarded = case r.r
                            when 1 then 50
                            when 2 then 25
                            when 3 then 10
                            else        5
                          end
    from ranked r
   where cp.challenge_id = c_id
     and cp.user_id      = r.user_id;

  -- Roll the award into profiles.total_points. A participant who never
  -- logged anything still gets the 5-point participation reward.
  update profiles p
     set total_points = total_points + coalesce(sub.pts, 0)
    from (
      select user_id, sum(points_awarded)::int as pts
        from challenge_participants
       where challenge_id = c_id
       group by user_id
    ) sub
   where p.id = sub.user_id;

  update challenges set finalized_at = now() where id = c_id;
end;
$$;
revoke execute on function public.finalize_challenge(uuid) from anon;

-- ── Seed two challenge badges ───────────────────────────────────────────────
-- The existing badge engine reads kind + threshold; we extend the kind set
-- here. Migration 0015 (matching code update) teaches evaluateBadges about
-- 'challenge_join' and 'challenge_win'.
alter table badges drop constraint badges_kind_check;
alter table badges
  add constraint badges_kind_check
  check (kind in ('streak', 'workouts', 'first_pr', 'challenge_join', 'challenge_win'));

insert into badges (code, name, description, kind, threshold, sort_order) values
  ('first_challenge_join', 'In the Arena', 'Joined your first challenge',         'challenge_join', 1, 80),
  ('first_challenge_won',  'Champion',     'Won your first challenge (1st place)', 'challenge_win',  1, 90);
