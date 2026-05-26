import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/auth/dal";
import OnboardingWizard from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (profile?.onboarding_complete) redirect("/app");

  // Suggest a username from the email local-part (sanitized to the allowed set).
  const suggested = (user.email ?? "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);

  return <OnboardingWizard suggestedUsername={suggested} />;
}
