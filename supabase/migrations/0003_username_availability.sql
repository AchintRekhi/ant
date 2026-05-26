-- Username availability check for onboarding.
-- profiles RLS is owner-only, so a normal SELECT can't see whether someone else
-- already took a username. This SECURITY DEFINER function returns only a boolean
-- (no row data), letting signed-in users check availability without leaking data.
create function public.is_username_available(candidate text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.profiles where username = lower(candidate)
  );
$$;

revoke execute on function public.is_username_available(text) from public, anon;
grant  execute on function public.is_username_available(text) to authenticated;
