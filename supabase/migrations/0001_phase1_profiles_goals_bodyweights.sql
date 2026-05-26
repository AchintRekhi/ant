-- Phase 1: Auth & onboarding schema.
-- Tables: profiles (1:1 with auth.users), goals, body_weights.
-- All measurements stored in metric; converted to the user's unit at the UI layer.
-- DOB is stored only to derive age — never expose the date to clients.

-- ── Enums ────────────────────────────────────────────────────────────────────
create type units_pref       as enum ('metric', 'imperial');
create type gender           as enum ('male', 'female', 'other', 'prefer_not_to_say');
create type experience_level as enum ('beginner', 'intermediate', 'advanced');
create type privacy_level    as enum ('public', 'private');
create type goal_type        as enum ('lose_weight', 'build_muscle', 'get_stronger', 'stay_consistent');
create type goal_status      as enum ('active', 'achieved', 'abandoned');

-- ── profiles ─────────────────────────────────────────────────────────────────
-- One row per auth user, created automatically by a trigger at signup (empty,
-- onboarding_complete = false) and filled in by the onboarding wizard.
create table profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  username            text unique,
  display_name        text,
  dob                 date,
  gender              gender,
  height_cm           numeric(5, 2) check (height_cm is null or (height_cm > 50 and height_cm < 300)),
  units               units_pref       not null default 'metric',
  timezone            text             not null default 'UTC',
  privacy             privacy_level    not null default 'private',
  experience_level    experience_level,
  avatar_url          text,
  bio                 text,
  onboarding_complete boolean          not null default false,
  current_streak      integer          not null default 0,
  longest_streak      integer          not null default 0,
  last_active_date    date,
  total_points        integer          not null default 0,
  created_at          timestamptz      not null default now(),
  updated_at          timestamptz      not null default now(),

  -- Usernames are lowercase, 3–30 chars of [a-z0-9_]. Stored normalized so the
  -- UNIQUE constraint is effectively case-insensitive.
  constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,30}$'),

  -- A finished profile must have the fields the onboarding wizard collects.
  constraint complete_profile_requires_fields check (
    not onboarding_complete or (
      username is not null
      and dob is not null
      and gender is not null
      and height_cm is not null
      and experience_level is not null
    )
  )
);

comment on column profiles.dob is 'Stored only to derive age; never expose the date to clients.';
comment on column profiles.height_cm is 'Metric. Convert to the user''s units at the UI layer.';

-- ── goals ────────────────────────────────────────────────────────────────────
-- Set at onboarding, revisable later. One row per goal type per user.
create table goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  type         goal_type   not null,
  target_value numeric,
  target_date  date,
  status       goal_status not null default 'active',
  created_at   timestamptz not null default now(),
  unique (user_id, type)
);

create index goals_user_id_idx on goals (user_id);

-- ── body_weights ─────────────────────────────────────────────────────────────
-- Time series feeding the trend chart and the 15-day weigh-in prompt.
create table body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users (id) on delete cascade,
  weight_kg   numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
  recorded_at timestamptz   not null default now()
);

create index body_weights_user_recorded_idx on body_weights (user_id, recorded_at desc);

-- ── updated_at maintenance ───────────────────────────────────────────────────
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

-- ── Auto-create a profile row when an auth user is created ───────────────────
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Phase 1 is owner-only. Public-profile / follower visibility is added in Phase 5.
alter table profiles     enable row level security;
alter table goals        enable row level security;
alter table body_weights enable row level security;

-- profiles: a user can read and update only their own row. Inserts come from the
-- SECURITY DEFINER trigger above, so no insert policy is required.
create policy "profiles_select_own" on profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles_update_own" on profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- goals: full CRUD scoped to the owner.
create policy "goals_select_own" on goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals_insert_own" on goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals_update_own" on goals
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "goals_delete_own" on goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- body_weights: full CRUD scoped to the owner.
create policy "body_weights_select_own" on body_weights
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "body_weights_insert_own" on body_weights
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "body_weights_update_own" on body_weights
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "body_weights_delete_own" on body_weights
  for delete to authenticated using ((select auth.uid()) = user_id);
