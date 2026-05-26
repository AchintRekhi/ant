-- Harden the Phase 1 trigger functions (addresses Supabase security advisors).
-- 1. Pin set_updated_at's search_path (it was role-mutable).
-- 2. Revoke EXECUTE on both trigger functions so they can't be called as RPCs.
--    Triggers still fire — they run as the table owner regardless of EXECUTE grants.

alter function public.set_updated_at() set search_path = '';

revoke execute on function public.set_updated_at()  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
