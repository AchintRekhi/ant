// Pure PR logic, isolated from any DB access so it can be unit-tested directly.
// Heaviest-weight rule: walking a single exercise's sets in chronological order,
// a set is a PR when its weight beats every prior set's weight. Bodyweight
// (0 kg) sets never count.

export type OrderedSet = { id: string; weightKg: number };

/** Returns a map of set id → whether that set is a (heaviest-weight) PR. */
export function computePRFlags(orderedSets: OrderedSet[]): Map<string, boolean> {
  const result = new Map<string, boolean>();
  let runningMax = 0;
  for (const s of orderedSets) {
    const isPr = s.weightKg > 0 && s.weightKg > runningMax;
    if (s.weightKg > runningMax) runningMax = s.weightKg;
    result.set(s.id, isPr);
  }
  return result;
}
