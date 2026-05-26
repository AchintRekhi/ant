-- Phase 3: workout session photos. Private bucket, one object per session under
-- a per-user folder ({user_id}/{session_id}), scoped to the owner by RLS exactly
-- like avatars (migration 0004). Rendered via short-lived signed URLs.

insert into storage.buckets (id, name, public)
values ('workout-photos', 'workout-photos', false)
on conflict (id) do nothing;

create policy "workout_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workout-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "workout_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'workout-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "workout_photos_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'workout-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'workout-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "workout_photos_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'workout-photos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
