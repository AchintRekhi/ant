// Pure unit test for the streak algorithm. Run: node scripts/streak-core.test.ts
import { computeCurrentStreak } from "../src/lib/streak-core.ts";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${label}`);
  if (!cond) failures++;
}

const TODAY = "2026-05-27";

// Helper: dates counting back consecutively from a given day.
function consecutive(end: string, n: number): string[] {
  const base = Math.floor(Date.UTC(
    Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)),
  ) / 86_400_000);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date((base - i) * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
}

check("no activity → 0", computeCurrentStreak([], TODAY) === 0);

check("active today only → 1", computeCurrentStreak([TODAY], TODAY) === 1);

check("active yesterday only (today not logged yet) → 1",
  computeCurrentStreak(["2026-05-26"], TODAY) === 1);

check("5 consecutive days ending today → 5",
  computeCurrentStreak(consecutive(TODAY, 5), TODAY) === 5);

check("duplicates don't inflate",
  computeCurrentStreak([TODAY, TODAY, "2026-05-26"], TODAY) === 2);

check("last activity 3 days ago → broken (0)",
  computeCurrentStreak(["2026-05-24"], TODAY) === 0);

// One missed day in the middle, bridged by a freeze.
check("single internal gap is frozen → counts both sides",
  // active: today, yesterday, [gap 05-25], 05-24, 05-23 → 4 active days
  computeCurrentStreak(["2026-05-27", "2026-05-26", "2026-05-24", "2026-05-23"], TODAY) === 4);

// Two consecutive missed days break it (only one side counts).
check("two consecutive internal gaps break the streak",
  // active today,yesterday; then 05-25 & 05-24 BOTH missing; 05-23 active.
  computeCurrentStreak(["2026-05-27", "2026-05-26", "2026-05-23"], TODAY) === 2);

// A second freeze within 7 days is not allowed.
check("second freeze within 7 days is disallowed",
  // active: 27,26 then gap 25 (freeze) 24 then gap 23 (needs 2nd freeze, <7d apart) → stops; counts 27,26,24 = 3
  computeCurrentStreak(["2026-05-27", "2026-05-26", "2026-05-24", "2026-05-22"], TODAY) === 3);

// Front gap of one day (yesterday missed) is bridged.
check("missed yesterday is bridged by a freeze",
  // last active 05-25 (2 days before today) → frontGap 1 → freeze; streak from 05-25 back
  computeCurrentStreak(["2026-05-25", "2026-05-24", "2026-05-23"], TODAY) === 3);

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("\nAll streak-core tests passed.");
