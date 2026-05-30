-- Phase 8: photo reports (moderation affordance).
--
-- Public-profile workout photos are a moderation risk, so any signed-in user
-- who can see someone else's session can file a report on it. Reports are
-- write-only for ordinary users — they can read back their own, but reviewing
-- and acting on them happens out-of-band via the service role (no in-app admin
-- surface in v1). A unique (reporter, session) pair keeps one user from
-- spamming reports on the same photo.

create type report_status as enum ('open', 'reviewed', 'dismissed');

create table reports (
  id          uuid          primary key default gen_random_uuid(),
  reporter_id uuid          not null references auth.users (id)        on delete cascade,
  session_id  uuid          not null references workout_sessions (id)  on delete cascade,
  reason      text          not null check (char_length(reason) between 1 and 500),
  status      report_status not null default 'open',
  created_at  timestamptz   not null default now(),
  unique (reporter_id, session_id)
);
create index reports_session_idx on reports (session_id);
-- Partial index: the moderation queue only ever scans the still-open reports.
create index reports_open_idx on reports (created_at) where status = 'open';

alter table reports enable row level security;

-- File a report: only on someone else's session, and only one you can actually
-- see (public profile or accepted follower — reuses the Phase-5 visibility
-- helper). You can never report your own workout.
create policy "reports_insert_self" on reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and exists (
      select 1 from workout_sessions ws
      where ws.id = session_id
        and ws.user_id <> (select auth.uid())
        and public.can_view_user(ws.user_id)
    )
  );

-- A reporter can read back their own reports (e.g. to show "already reported").
-- No update/delete for ordinary users; no one else can read the queue.
create policy "reports_select_own" on reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));
