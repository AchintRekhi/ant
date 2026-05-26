import { getProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { kgToLbs } from "@/lib/units";
import BodyweightClient, { type WeightEntry } from "./BodyweightClient";

export default async function BodyweightPage() {
  const profile = await getProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("body_weights")
    .select("id, weight_kg, recorded_at")
    .order("recorded_at", { ascending: false });

  const isImperial = profile.units === "imperial";
  const entries: WeightEntry[] = (rows ?? []).map((r) => ({
    id: r.id,
    recordedAt: r.recorded_at,
    // Display value rounded for presentation; the canonical kg stays in the DB.
    displayWeight: isImperial
      ? Math.round(kgToLbs(r.weight_kg) * 10) / 10
      : Math.round(r.weight_kg * 10) / 10,
  }));

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Bodyweight</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Log your weight regularly to see your trend.
      </p>
      <BodyweightClient entries={entries} units={profile.units} />
    </div>
  );
}
