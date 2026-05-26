import { getProfile } from "@/lib/auth/dal";
import { ageFromDob } from "@/lib/validation";
import { formatHeight } from "@/lib/units";

export default async function DashboardPage() {
  // The layout already guarantees an onboarded profile; re-read is cache()'d.
  const profile = await getProfile();
  if (!profile) return null;

  const age = profile.dob ? ageFromDob(profile.dob) : null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome, {profile.display_name ?? profile.username}.
      </h1>
      <p className="mt-2 text-zinc-500">
        Your profile is set up. The core workout-tracking loop arrives in the
        next phases.
      </p>

      <dl className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 text-sm">
        <Row label="Username" value={`@${profile.username}`} />
        {age !== null && <Row label="Age" value={String(age)} />}
        {profile.height_cm !== null && (
          <Row label="Height" value={formatHeight(profile.height_cm, profile.units)} />
        )}
        <Row
          label="Experience"
          value={capitalize(profile.experience_level ?? "—")}
        />
        <Row label="Units" value={capitalize(profile.units)} />
        <Row label="Privacy" value={capitalize(profile.privacy)} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
