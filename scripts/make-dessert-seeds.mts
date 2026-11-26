// Builds src/game/business/dessertSeeds.ts: for each of the 50 desserts of the list (dessertGallery.ts DESSERT_LADDER), SEEDS_PER_DESSERT (6) plate seeds at the dessert's band tier, each
//   1. PROVEN: the deck is won by the real rules in deck order, on time and with taps up to 4 s late;
//   2. RATED: a careful player (`ratePlate`, 12 rounds) finds how hard the plate is (0 = always won with room to spare, 1 = never won);
//   3. ON ONE CLIMBING CURVE: every dessert has a target hardness on one curve that rises from the first dessert to the last (CURVE below, inside the band tiers' windows RUN_HARDNESS);
//      its six seeds are the rated ones next to each other (by hardness) whose average sits nearest that target, easiest first. So the list gets harder dessert by dessert, across bands too.
//   4. GENTLE AT THE START: the first ten desserts only use deals that random tapping also finishes most times (CASUAL_FIRST_TEN; measured with this script's own random players, not the
//      QA's, so dessert-run-qa F stays an independent check).
// Developer 2026-11-19 ("ensure and increase the quality of the levels"), reworked 2026-11-26 for the 50-level list and 2026-11-27 ("easy first then gradually tougher": before, each band
// restarted at its window's foot, so level 41 was easier than level 40).
//
// Rating takes about a second a candidate, so the rated candidates are cached in a pool folder, one file per dessert, and the keys can run in parallel:
//   npx tsx scripts/make-dessert-seeds.mts --pool=<dir> --key=eclair [--candidates=120]     (one dessert; run these, any number at once)
//   npx tsx scripts/make-dessert-seeds.mts --pool=<dir>                                     (writes dessertSeeds.ts from the pool files;
//                                                                                            rates any file that is missing, one by one)
// then: npx prettier --write src/game/business/dessertSeeds.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import {
  DESSERT_LADDER,
  bandOf,
  tierOfLadderLevel,
  type DessertId,
} from "../src/game/business/dessertGallery.ts";
import {
  RUN_TIERS,
  STEP,
  makeRun,
  playDeckOrder,
  ratePlate,
  runDeckProblem,
  stepRun,
  tapLane,
  type RunTier,
} from "../src/game/business/dessertRun.ts";

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const poolDir = arg("pool") ?? "scripts/.dessert-pool";
const onlyKey = arg("key");
const candidates = Number(arg("candidates") ?? 120);
const wanted = 6;
mkdirSync(poolDir, { recursive: true });

type Row = { seed: number; win: number; peak: number; stars3: number; hardness: number };

function rateKey(id: DessertId, level: number): Row[] {
  const tier = RUN_TIERS[tierOfLadderLevel(level) - 1]!;
  const file = `${poolDir}/${id}-${tier.id}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Row[];
  const rows: Row[] = [];
  for (let candidate = 1; candidate <= candidates; candidate += 1) {
    const seed =
      (Math.imul(candidate, 0x45d9f3b) ^ Math.imul(tier.id, 0x119de1f3) ^ 0xde55e47) >>> 0;
    if (runDeckProblem(makeRun(id, seed, tier), tier) !== null) continue;
    if (!playDeckOrder(makeRun(id, seed, tier), tier).won) continue;
    const late = makeSeededRand(seed);
    if (!playDeckOrder(makeRun(id, seed, tier), tier, () => Math.floor(late() * 240)).won) continue;
    rows.push({ seed, ...ratePlate(id, seed, tier, 12) });
  }
  writeFileSync(file, JSON.stringify(rows));
  console.log(`${id} (tier ${tier.id}): ${rows.length} proven and rated of ${candidates}`);
  return rows;
}

if (onlyKey) {
  const level = DESSERT_LADDER.indexOf(onlyKey as DessertId) + 1;
  if (level < 1) throw new Error(`unknown dessert ${onlyKey}`);
  rateKey(onlyKey as DessertId, level);
  process.exit(0);
}

/** The average hardness the list aims for at the start of each ten (and at the last dessert): one climb, no step back where a band changes. */
const CURVE = [0, 0.06, 0.13, 0.24, 0.4, 0.55] as const;
const targetAt = (n: number) => {
  const band = Math.min(4, Math.floor(n / 10));
  const along = band < 4 ? (n % 10) / 10 : (n % 10) / 9;
  return CURVE[band]! + (CURVE[band + 1]! - CURVE[band]!) * along;
};

/** The share of random players (a random row whenever a standby spot is free; eight of them, this script's own) who finish a deal. */
function casualWins(id: DessertId, seed: number, tier: RunTier): number {
  let won = 0;
  for (let k = 1; k <= 8; k += 1) {
    const round = makeRun(id, seed, tier);
    const rand = makeSeededRand((seed ^ (0x7000 + k * 7907)) >>> 0);
    let guard = 0;
    while (round.phase === "play" && guard++ < 150_000) {
      if (round.spots.indexOf(null) >= 0 && rand() < 0.2) {
        const open = round.lanes.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0);
        if (open.length) tapLane(round, open[Math.floor(rand() * open.length)]!);
      }
      stepRun(round, STEP, 1);
    }
    won += Number(round.phase === "won");
  }
  return won / 8;
}
/** In the first ten, a deal is used only when random play finishes it at least this often. */
const CASUAL_FIRST_TEN = 0.75;

const lines = [
  "/** Generated by scripts/make-dessert-seeds.mts. Every seed was won by the real rules in deck order, on time and late, and rated by a careful player; the seeds of a dessert run easiest first, and their average climbs one curve from the first dessert to the last. */",
  "export const DESSERT_RUN_SEEDS: Record<string, readonly number[]> = {",
];
/** The average of the dessert before: no dessert aims below it, so one that overshot its point does not make the next one easier. */
let climbed = 0;
DESSERT_LADDER.forEach((id, n) => {
  const level = n + 1;
  const tier = RUN_TIERS[tierOfLadderLevel(level) - 1]!;
  const all = rateKey(id, level);
  if (all.length < wanted) throw new Error(`${id}: only ${all.length} proven plates`);
  // The six rated plates next to each other by hardness whose average is nearest the dessert's point on the curve (a plate's rating moves in steps of one careful round in twelve, so a window
  // across two steps lands between them); of equals, the tightest.
  const target = Math.max(targetAt(n), climbed);
  let pool = all;
  if (n < 10) {
    // the deals nearest the target first, until sixty of them are gentle for random play too
    const nearest = [...all].sort(
      (a, b) => Math.abs(a.hardness - target) - Math.abs(b.hardness - target) || a.seed - b.seed,
    );
    const gentle: Row[] = [];
    for (const row of nearest) {
      if (casualWins(id, row.seed, tier) >= CASUAL_FIRST_TEN) gentle.push(row);
      if (gentle.length >= 60) break;
    }
    if (gentle.length < wanted)
      throw new Error(`${id}: only ${gentle.length} deals gentle enough for the first ten`);
    pool = gentle;
  }
  const byHardness = [...pool].sort((a, b) => a.hardness - b.hardness || a.seed - b.seed);
  let best = { off: Infinity, spread: Infinity, at: 0 };
  for (let at = 0; at + wanted <= byHardness.length; at++) {
    const six = byHardness.slice(at, at + wanted);
    const off = Math.abs(six.reduce((sum, r) => sum + r.hardness, 0) / wanted - target);
    const spread = six[wanted - 1]!.hardness - six[0]!.hardness;
    if (off < best.off - 1e-9 || (off < best.off + 1e-9 && spread < best.spread - 1e-9))
      best = { off, spread, at };
  }
  const seeds = byHardness.slice(best.at, best.at + wanted);
  const mean = seeds.reduce((s, r) => s + r.hardness, 0) / wanted;
  climbed = mean;
  console.log(
    `L${level} ${id} (band ${bandOf(level) + 1}, tier ${tier.id}): ${all.length} rated, ${wanted} kept, target ${target.toFixed(2)}, hardness ${seeds[0]!.hardness.toFixed(2)} .. ${seeds[wanted - 1]!.hardness.toFixed(2)} (mean ${mean.toFixed(2)})`,
  );
  lines.push(`  "${id}-${tier.id}": [${seeds.map((r) => r.seed).join(", ")}],`);
});
lines.push("};", "");
writeFileSync("src/game/business/dessertSeeds.ts", lines.join("\n"), "utf8");
