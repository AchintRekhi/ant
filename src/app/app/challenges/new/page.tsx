import { requireOnboardedProfile } from "@/lib/auth/dal";
import NewChallengeForm from "./NewChallengeForm";

export default async function NewChallengePage() {
  await requireOnboardedProfile();
  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">New challenge</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Set a date window, pick a metric, and invite friends or open it to anyone.
      </p>
      <NewChallengeForm />
    </div>
  );
}
