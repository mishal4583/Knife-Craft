/**
 * TAP CUT QA (developer 2026-11-08: "increase the cutting speed of the basic knife to the top knife", "I just tapped the same spot as fast as
 * I could and it is still not 100 percent", "do not make the cutting too hectic").
 *   A  speed: the tap cut is 320 ms at 1.0; the basic knife has the top knife's speed; no knife is slower than 0.9
 *   B  fewer cuts: a slice holds 8 cuts (was 12), Chop too
 *   C  the soft magnet: an honest tap lands near an even slot; tapping the SAME spot walks across the ingredient in even steps
 *   D  the magnet never touches Chop (irregular on purpose) or a single-cut halve
 * Run: npx tsx scripts/tap-cut-qa.mts
 */
import { TAP_KNIFE, TECHNIQUES, requiredCutsFor } from "../src/game/definitions.ts";
import { KNIFE_CATALOG, knifeOrDefault } from "../src/game/knives/knifeDefinitions.ts";
import { knifeTapCadence, tapSequenceMs } from "../src/game/knives/knifeTiming.ts";
import {
  SLOT_MAGNET_KEEP,
  idealPositions,
  magnetToSlot,
  resolveContinuousPosition,
} from "../src/game/CutGeometry.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}

console.log("A. Speed");
{
  const base =
    TAP_KNIFE.PREP_MS +
    TAP_KNIFE.PAUSE_MS +
    TAP_KNIFE.CUT_MS +
    TAP_KNIFE.IMPACT_MS +
    TAP_KNIFE.RETRACT_MS;
  assert(
    base === 320,
    "A1: one tap cut keeps the knife busy 320 ms at timingMult 1 (was 455)",
    base,
  );
  const chef = knifeOrDefault("chef");
  const fastest = Math.min(...KNIFE_CATALOG.map((k) => k.animation.timingMult));
  assert(
    chef.animation.timingMult === fastest && fastest === 0.85,
    "A2: the basic knife has the top knife's speed (timingMult 0.85)",
    KNIFE_CATALOG.map((k) => [k.name, k.animation.timingMult]),
  );
  assert(
    KNIFE_CATALOG.every((k) => k.animation.timingMult <= 0.9),
    "A3: no knife is slower than 0.9: the cleaver and the bread knife are no longer sluggish",
  );
  assert(
    Math.round(tapSequenceMs(knifeTapCadence(TAP_KNIFE, chef))) === 272,
    "A4: the basic knife's tap cut is 272 ms",
  );
  assert(
    TAP_KNIFE.BUFFER_TAIL_MS >= 100,
    "A5: a tap that lands just before the cut ends is queued (a fast tapper loses none)",
  );
}

console.log("B. Fewer cuts");
{
  assert(
    TAP_KNIFE.MIN_GAP_FRAC === 0.07,
    "B1: the closest two cuts may be is 7% of the band (back to 7% on 2026-11-11: the 10% of 2026-11-08 cut the slice count, the developer undid it)",
  );
  assert(
    requiredCutsFor(TECHNIQUES.slice) === 12 && requiredCutsFor(TECHNIQUES.chop) === 12,
    "B2: a slice and a chop are 12 cuts again (8 from 2026-11-08 to 2026-11-10)",
    [requiredCutsFor(TECHNIQUES.slice), requiredCutsFor(TECHNIQUES.chop)],
  );
}

console.log("C. The soft magnet");
{
  const band = { lo: 100, hi: 500 };
  const n = 8;
  const ideal = idealPositions(band.lo, band.hi, n);
  const spacing = (band.hi - band.lo) / (n + 1);
  // Tapping the very same spot eight times, as fast as possible.
  const existing: number[] = [];
  for (let i = 0; i < n; i++) {
    const aim = magnetToSlot(band, existing, 310, n) ?? 310;
    const c = resolveContinuousPosition(
      band,
      existing,
      aim,
      TAP_KNIFE.MIN_EDGE_FRAC,
      TAP_KNIFE.MIN_GAP_FRAC,
    );
    if (c == null) break;
    existing.push(c);
  }
  const sorted = [...existing].sort((a, b) => a - b);
  const worst = Math.max(...sorted.map((c, i) => Math.abs(c - ideal[i]!)));
  assert(
    sorted.length === n && worst < 1e-9,
    `C1: eight taps on the SAME spot give eight cuts, each exactly on a slot of the even grid (worst ${worst.toFixed(2)} px of a ${spacing.toFixed(0)} px step)`,
    { sorted, ideal },
  );
  // Evenness the way the grader sees it: the spread of the gaps, edges included.
  const gaps = [band.lo, ...sorted, band.hi].map((v, i, a) => (i ? v - a[i - 1]! : 0)).slice(1);
  const mean = gaps.reduce((t, g) => t + g, 0) / gaps.length;
  const rel = Math.sqrt(gaps.reduce((t, g) => t + (g - mean) ** 2, 0) / gaps.length) / mean;
  assert(
    rel < 0.02,
    `C2: the pieces differ by less than 2% from each other (${(rel * 100).toFixed(2)}%)`,
    gaps,
  );
  // An honest tap near a slot keeps only a sliver of its offset.
  const near = magnetToSlot(band, [ideal[0]!], ideal[3]! + 12, n)!;
  assert(
    Math.abs(near - ideal[3]!) <= 12 * SLOT_MAGNET_KEEP + 1e-6,
    "C3: a tap 12 px off a slot lands within 2 px of it",
    near - ideal[3]!,
  );
  // A tap on an occupied slot goes exactly onto the nearest free one.
  const pushed = magnetToSlot(band, [ideal[3]!], ideal[3]! + 1, n)!;
  assert(
    Math.abs(pushed - ideal[2]!) < 1e-9 || Math.abs(pushed - ideal[4]!) < 1e-9,
    "C4: a tap on a slot that is already cut goes exactly onto the next free slot",
    pushed,
  );
  assert(
    magnetToSlot(band, ideal, 300, n) === null && magnetToSlot(band, [], 300, 0) === null,
    "C5: with every slot cut (or none asked for) there is no magnet: the free placement takes over",
  );
}

console.log("D. What the magnet leaves alone");
{
  assert(
    TECHNIQUES.chop.placementJitterFrac !== undefined &&
      TECHNIQUES.halve.fixedRequiredCuts === true,
    "D1: Chop (jittered on purpose) and Halve (one cut) are excluded in the scene",
  );
}

console.log(failures ? `\nTAP CUT QA: ${failures} FAILURE(S)` : "\nTAP CUT QA: ALL PASS");
process.exit(failures ? 1 : 0);
