import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvatarUrl } from "@/lib/storage";
import { ageFromDob, GOAL_TYPES } from "@/lib/validation";
import ProfileForm from "./ProfileForm";

type GoalType = (typeof GOAL_TYPES)[number];

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: goalRows } = await supabase.from("goals").select("type");
  const goals = (goalRows ?? []).map((g) => g.type as GoalType);

  const avatarUrl = await getAvatarUrl(profile.avatar_url);
  const age = profile.dob ? ageFromDob(profile.dob) : null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Age and DOB are private — your date of birth is never shown to anyone.
      </p>
      <ProfileForm
        initial={{
          username: profile.username ?? "",
          displayName: profile.display_name ?? "",
          bio: profile.bio ?? "",
          gender: profile.gender ?? "prefer_not_to_say",
          heightCm: profile.height_cm ?? 0,
          units: profile.units,
          privacy: profile.privacy,
          experienceLevel: profile.experience_level ?? "beginner",
          goals,
        }}
        age={age}
        avatarUrl={avatarUrl}
      />
    </div>
  );
}
