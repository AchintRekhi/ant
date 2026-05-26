-- Phase 2: avatar storage.
-- A private bucket whose objects live under a per-user folder ({user_id}/...),
-- so RLS can scope every operation to the owner by reading the first path segment.
-- Profile pages render avatars through short-lived signed URLs. Public/follower
-- visibility of avatars is layered on in Phase 5 alongside the rest of the social graph.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- (select auth.uid()) is wrapped so the planner evaluates it once per statement.
-- (storage.foldername(name))[1] is the leading path segment, i.e. the owner's id.
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
