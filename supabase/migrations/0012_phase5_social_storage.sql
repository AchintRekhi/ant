-- Phase 5 (storage half): let viewers read avatars and workout photos of
-- users whose progress they're allowed to see. The owner-only policies from
-- migrations 0004 and 0007 stay in place; these are additional permissive
-- SELECT policies that OR-extend them.
--
-- Storage objects encode the owner's auth.users id as the first path segment,
-- so we extract it and feed it into public.can_view_user.

create policy "avatars_select_viewable" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_view_user(((storage.foldername(name))[1])::uuid)
  );

create policy "workout_photos_select_viewable" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'workout-photos'
    and public.can_view_user(((storage.foldername(name))[1])::uuid)
  );
