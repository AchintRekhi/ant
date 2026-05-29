-- Phase 5 (advisor follow-ups):
--   * pin search_users.search_path so it's not role-mutable (lint 0011).
--   * Revoke can_view_user from anon — the function is needed by RLS policies
--     (called as authenticated) and by the server via rpc(), but anonymous
--     clients have no business calling it directly (lint 0028).

alter function public.search_users(text, int) set search_path = public, pg_temp;

revoke execute on function public.can_view_user(uuid) from anon;
