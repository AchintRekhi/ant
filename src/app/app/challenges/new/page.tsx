import { requireOnboardedProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import NewChallengeForm from "./NewChallengeForm";

export default async function NewChallengePage() {
  const profile = await requireOnboardedProfile();

  // The picker is a client component, so source the library here. RLS scopes
  // this to the seeded exercises + the user's own custom ones.
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, muscle_group")
    .order("name");

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">New challenge</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Pick an exercise and a measure, set a date window, and invite friends or
        open it to anyone.
      </p>
      <NewChallengeForm exercises={exercises ?? []} units={profile.units} />
    </div>
  );
}
