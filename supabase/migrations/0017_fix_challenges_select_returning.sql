-- Fix: creating a challenge failed with "new row violates row-level security
-- policy for table challenges".
--
-- Root cause: the challenges SELECT policy called can_view_challenge(id), a
-- STABLE SECURITY DEFINER function that re-SELECTs the challenges table. During
-- INSERT ... RETURNING (the app does .insert(...).select("id").single()),
-- PostgreSQL applies the SELECT policy to the new row, but the STABLE function
-- runs under the command's snapshot and can't see the just-inserted row — so it
-- reported the creator's own new challenge as not-viewable and the RETURNING
-- failed, even though the INSERT check itself passed.
--
-- Inline the same visibility logic using the row's own columns (creator_id,
-- privacy) instead of round-tripping through the function. Evaluated directly
-- against the new row, so the creator branch passes immediately. The function
-- stays in place for the challenge_participants policies and the leaderboard,
-- where it keys off a different table and isn't subject to this gotcha.

drop policy "challenges_select" on challenges;
create policy "challenges_select" on challenges
  for select to authenticated
  using (
    privacy = 'public'
    or creator_id = (select auth.uid())
    or exists (
      select 1 from challenge_participants cp
      where cp.challenge_id = challenges.id
        and cp.user_id = (select auth.uid())
    )
  );
