// Pure unit test for the PR algorithm. Run: node scripts/pr-core.test.ts
import { computePRFlags } from "../src/lib/pr-core.ts";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${label}`);
  if (!cond) failures++;
}

// Sets are passed already in chronological order (session start, then set number).
const flags = computePRFlags([
  { id: "a", weightKg: 60 }, // first positive weight → PR
  { id: "b", weightKg: 60 }, // equal, not a PR
  { id: "c", weightKg: 65 }, // new best → PR
  { id: "d", weightKg: 62 }, // below best, not a PR
  { id: "e", weightKg: 70 }, // new best → PR
]);
check("first positive weight is a PR", flags.get("a") === true);
check("equalling the best is not a PR", flags.get("b") === false);
check("beating the best is a PR", flags.get("c") === true);
check("a lighter set after a PR is not a PR", flags.get("d") === false);
check("a new best is a PR", flags.get("e") === true);

// Bodyweight (0 kg) sets never count as weight PRs.
const bw = computePRFlags([
  { id: "x", weightKg: 0 },
  { id: "y", weightKg: 0 },
]);
check("0 kg sets are never PRs", bw.get("x") === false && bw.get("y") === false);

// Order matters: the heaviest-first means later lighter sets aren't PRs.
const desc = computePRFlags([
  { id: "p", weightKg: 100 },
  { id: "q", weightKg: 80 },
]);
check("only the first set is a PR when weights descend", desc.get("p") === true && desc.get("q") === false);

console.log(failures === 0 ? "\nAll PR-core tests passed." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
