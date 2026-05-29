-- Tighten EXECUTE on every SECURITY DEFINER function in the public schema.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which on a
-- Supabase project means both anon and authenticated can call them via
-- /rest/v1/rpc. We want these functions reachable only by signed-in users
-- (the server calls them on the user's behalf) — never by anon.
--
-- Pattern: revoke from PUBLIC (which clears anon's inherited EXECUTE), then
-- grant explicitly to authenticated.

revoke execute on function public.can_view_user(uuid)            from public;
grant  execute on function public.can_view_user(uuid)            to   authenticated;

revoke execute on function public.can_view_challenge(uuid)       from public;
grant  execute on function public.can_view_challenge(uuid)       to   authenticated;

revoke execute on function public.challenge_leaderboard(uuid)    from public;
grant  execute on function public.challenge_leaderboard(uuid)    to   authenticated;

revoke execute on function public.finalize_challenge(uuid)       from public;
grant  execute on function public.finalize_challenge(uuid)       to   authenticated;
