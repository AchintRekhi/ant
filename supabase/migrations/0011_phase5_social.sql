-- Phase 5: social layer — follows (with request approval for private accounts),
-- blocks, and the RLS visibility rules that let viewers read a target user's
-- progress only when they're allowed to.
--
-- Visibility ladder (top wins):
--   * Always allowed: the row's owner reading their own data.
--   * Always denied : either side has blocked the other.
--   * Allowed       : target is public, OR viewer has an accepted follow.
--   * Otherwise     : denied (private + non-follower).
--
-- We layer permissive policies on top of the existing owner-only ones rather
-- than rewriting them — Postgres ORs multiple permissive policies, so the
-- owner keeps full access and viewers get read-only on the social subset.

create type follow_status as enum ('pending', 'accepted');

-- ── follows ──────────────────────────────────────────────────────────────────
-- A row means follower → following at the given status. Public accounts get
-- 'accepted' immediately; private accounts start at 'pending' until approved.
-- A user can't follow themselves.
create table follows (
  follower_id  uuid          not null references auth.users (id) on delete cascade,
  following_id uuid          not null references auth.users (id) on delete cascade,
  status       follow_status not null default 'pending',
  created_at   timestamptz   not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);
create index follows_following_idx on follows (following_id, status);
create index follows_follower_idx  on follows (follower_id,  status);

-- ── blocks ───────────────────────────────────────────────────────────────────
-- A row means blocker has hidden blocked. Mutual cascade is enforced in the
-- block action (we also drop any existing follow rows in both directions).
create table blocks (
  blocker_id uuid        not null references auth.users (id) on delete cascade,
  blocked_id uuid        not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on blocks (blocked_id);

-- ── Visibility helper ────────────────────────────────────────────────────────
-- True when the current auth user is allowed to see `target`'s progress data
-- (sessions/sets/bodyweight/routines/activity/badges). SECURITY DEFINER so it
-- can peek at profiles.privacy and follows even when the caller's own RLS
-- would forbid it; STABLE so it's cached within a statement.
create function public.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Self always wins.
    auth.uid() = target
    or (
      -- Never if either side has blocked the other.
      not exists (
        select 1 from blocks b
        where (b.blocker_id = target     and b.blocked_id = auth.uid())
           or (b.blocker_id = auth.uid() and b.blocked_id = target)
      )
      and (
        -- Public profile, anyone signed in may view.
        exists (
          select 1 from profiles p
          where p.id = target and p.privacy = 'public'
        )
        -- Or private, but the viewer is an accepted follower.
        or exists (
          select 1 from follows f
          where f.follower_id  = auth.uid()
            and f.following_id = target
            and f.status       = 'accepted'
        )
      )
    );
$$;

-- ── RLS on the new tables ────────────────────────────────────────────────────
alter table follows enable row level security;
alter table blocks  enable row level security;

-- follows: I can see rows where I'm either side (so I can list my followers,
-- my following, and incoming pending requests).
create policy "follows_select_either_side" on follows
  for select to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

-- I can create a follow only as the follower, and only if the target hasn't
-- blocked me (and I haven't blocked them).
create policy "follows_insert_as_follower" on follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = following_id   and b.blocked_id = (select auth.uid()))
         or (b.blocker_id = (select auth.uid()) and b.blocked_id = following_id)
    )
  );

-- I can update a follow only when I'm the target (accepting a pending request).
-- The transition is constrained in the server action to pending → accepted.
create policy "follows_update_as_target" on follows
  for update to authenticated
  using (following_id = (select auth.uid()))
  with check (following_id = (select auth.uid()));

-- Either side can delete: follower unfollows / cancels; target rejects / removes.
create policy "follows_delete_either_side" on follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

-- blocks: owner-scoped (I manage my own block list; I never see who blocked me).
create policy "blocks_owner" on blocks
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

-- ── Profile visibility ───────────────────────────────────────────────────────
-- Profiles stay findable so users can search for someone to follow, but a
-- block from either side hides the row entirely. The "owner" policy from
-- phase 1 still covers the owner reading their own row.
create policy "profiles_select_visible" on profiles
  for select to authenticated
  using (
    not exists (
      select 1 from blocks b
      where (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))
         or (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
    )
  );

-- ── Social SELECT policies on owner-scoped tables ────────────────────────────
-- Each adds a permissive SELECT on top of the existing owner policy. INSERT/
-- UPDATE/DELETE remain owner-only because those policies don't include SELECT.

create policy "body_weights_select_viewable" on body_weights
  for select to authenticated using (public.can_view_user(user_id));

create policy "workout_sessions_select_viewable" on workout_sessions
  for select to authenticated using (public.can_view_user(user_id));

create policy "session_exercises_select_viewable" on session_exercises
  for select to authenticated
  using (exists (
    select 1 from workout_sessions ws
    where ws.id = session_exercises.session_id
      and public.can_view_user(ws.user_id)
  ));

create policy "sets_select_viewable" on sets
  for select to authenticated
  using (exists (
    select 1 from session_exercises se
    join workout_sessions ws on ws.id = se.session_id
    where se.id = sets.session_exercise_id
      and public.can_view_user(ws.user_id)
  ));

create policy "routines_select_viewable" on routines
  for select to authenticated using (public.can_view_user(user_id));

create policy "routine_days_select_viewable" on routine_days
  for select to authenticated
  using (exists (
    select 1 from routines r
    where r.id = routine_days.routine_id
      and public.can_view_user(r.user_id)
  ));

create policy "rde_select_viewable" on routine_day_exercises
  for select to authenticated
  using (exists (
    select 1 from routine_days rd
    join routines r on r.id = rd.routine_id
    where rd.id = routine_day_exercises.routine_day_id
      and public.can_view_user(r.user_id)
  ));

create policy "activity_log_select_viewable" on activity_log
  for select to authenticated using (public.can_view_user(user_id));

create policy "user_badges_select_viewable" on user_badges
  for select to authenticated using (public.can_view_user(user_id));

-- goals stay strictly private — they're personal targets, not social signal.

-- ── search_users RPC ─────────────────────────────────────────────────────────
-- Username/display-name prefix search. SECURITY INVOKER so it inherits the
-- caller's RLS on profiles (i.e. blocked rows are already filtered out).
create function public.search_users(q text, max_results int default 20)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  privacy      privacy_level
)
language sql
stable
as $$
  select id, username, display_name, avatar_url, privacy
  from profiles
  where username is not null
    and onboarding_complete = true
    and id <> auth.uid()
    and (
      username      ilike q || '%'
      or display_name ilike q || '%'
    )
  order by username
  limit greatest(1, least(max_results, 50));
$$;
