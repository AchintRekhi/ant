-- 0008: single active routine per user
-- Adds routines.is_active. Only the active routine drives the Workout page's
-- "Scheduled for today" suggestion. A partial unique index enforces at most one
-- active routine per user.

alter table routines add column is_active boolean not null default false;

create unique index routines_one_active_per_user
  on routines (user_id) where is_active;
