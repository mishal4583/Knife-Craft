/**
 * RESTAURANT PRESTIGE QA (the "Chef Pride" plan, Phase 4, developer 2026-11-23: "look what I built").
 *
 *  A  the tiers: five, rising thresholds from 0, unique names, short copy;
 *  B  the points: each of the five parts, their caps, popularity below 50 takes nothing away, the parts add up to the total, more campaign never means fewer points;
 *  C  the tier and its bar: the exact boundary, the progress to the next tier, nothing above the top;
 *  D  the pacing (design intent): a player who plays by default gets Local Favourite in the teens, City Landmark around the middle and Culinary Destination near the end;
 *     a good player gets them sooner; Living Legend is not given by the campaign alone;
 *  E  announcing: the starting tier is never announced, a tier up is announced once (a marker in chefRecord.seen), an old save that is several tiers up hears about the
 *     highest one only, and nothing is ever lost;
 *  F  pure and honest: nothing stored, no wallet, ledger, clock or random, no new top-level save field, no population claim;
 *  G  wiring: the Progress card from its level, the celebration card, the end of a service announces it and measures it.
 *
 * Run: npx tsx scripts/restaurant-prestige-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  ENDLESS_POINTS_MAX,
  PLACE_POINTS,
  PRESTIGE_FROM_LEVEL,
  PRESTIGE_TIERS,
  SPOTLESS_POINTS_MAX,
  STAGE_POINTS,
  announcePrestige,
  prestigeSeenId,
  restaurantPrestige,
} from "../src/game/restaurant/restaurantPrestige.ts";
import { chefRecordOf } from "../src/game/restaurant/chefRecord.ts";
import { celebrationFor } from "../src/game/restaurant/celebrations.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(
    `  ${cond ? "ok " : "FAIL"} ${msg}${!cond && detail !== undefined ? ` ${JSON.stringify(detail).slice(0, 300)}` : ""}`,
  );
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const mk = (completed: number, pop = 50, spotless = 0, stars = 0): SaveData => ({
  ...DEFAULT_SAVE,
  levelProgress: {
    currentLevelId: `level-${completed + 1}`,
    highestUnlockedLevelId: `level-${completed + 1}`,
    completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
  },
  business: {
    ...DEFAULT_SAVE.business,
    popularity: { ...DEFAULT_SAVE.business.popularity, score: pop },
    restaurantRecord: {
      services: completed,
      spotless,
      streak: 0,
      bestStreak: 0,
      at: { covers: 0, takeaway: 0, packed: 0, washed: 0, broken: 0 },
      lastHygiene: null,
    },
    ...(stars ? { endlessStars: { total: stars, days: 0, bestDay: 0 } } : {}),
  },
});
const part = (s: SaveData, id: string) => restaurantPrestige(s).parts.find((p) => p.id === id)!;

console.log("A. The tiers");
{
  assert(
    PRESTIGE_TIERS.length === 5 && PRESTIGE_TIERS[0]!.from === 0,
    "A1: five tiers, starting at 0",
  );
  assert(
    PRESTIGE_TIERS.every((t, i) => i === 0 || t.from > PRESTIGE_TIERS[i - 1]!.from),
    "A2: the thresholds rise strictly",
  );
  assert(
    new Set(PRESTIGE_TIERS.map((t) => t.name)).size === 5 &&
      PRESTIGE_TIERS.every((t, i) => t.index === i),
    "A3: unique names, indexes in order",
  );
  assert(
    PRESTIGE_TIERS.every((t) => t.name.split(/\s+/).length <= 3 && t.feel.split(/\s+/).length <= 8),
    "A4: short names and one short feel line each",
  );
  assert(
    PRESTIGE_FROM_LEVEL >= 3 && PRESTIGE_FROM_LEVEL <= 8,
    "A5: the card opens in the first levels",
  );
}

console.log("B. The points");
{
  const fresh = restaurantPrestige(mk(0));
  assert(fresh.tier.index === 0, "B1: a fresh restaurant is a Neighbourhood Spot", fresh.points);
  assert(
    part(mk(9), "stage").points % STAGE_POINTS === 0 && part(mk(9), "stage").points > 0,
    "B2: stage points are a multiple of the stage weight",
  );
  assert(
    part(mk(9), "ranking").points === 9 * PLACE_POINTS,
    "B3: three points a place climbed (9 places after 9 levels)",
    part(mk(9), "ranking"),
  );
  assert(
    part(mk(9, 49), "popularity").points === 0 && part(mk(9, 20), "popularity").points === 0,
    "B4: popularity below 50 takes nothing away (0 points)",
  );
  assert(part(mk(9, 60), "popularity").points === 20, "B5: popularity 60 is 20 points");
  assert(
    part(mk(9, 50, 500), "spotless").points === SPOTLESS_POINTS_MAX &&
      part(mk(9, 50, 7), "spotless").points === 7,
    "B6: spotless services count one each, up to the cap",
  );
  assert(
    part(mk(9, 50, 0, 1000), "endless").points === ENDLESS_POINTS_MAX &&
      part(mk(9, 50, 0, 20), "endless").points === 10,
    "B7: Endless stars count one point per two, up to the cap",
  );
  const sample = [mk(14, 66, 12, 8), mk(60, 90, 80, 300)].map(restaurantPrestige);
  assert(
    sample.every((p) => p.parts.reduce((t, x) => t + x.points, 0) === p.points),
    "B8: the parts add up to the total",
  );
  let prev = -1;
  let monotone = true;
  for (let c = 0; c <= 91; c++) {
    const pts = restaurantPrestige(mk(c)).points;
    if (pts < prev) monotone = false;
    prev = pts;
  }
  assert(monotone, "B9: more campaign never means fewer points");
  assert(
    restaurantPrestige(mk(40, 10, 0)).points === restaurantPrestige(mk(40, 50, 0)).points,
    "B10: a bad night never takes prestige away",
  );
}

console.log("C. The tier and its bar");
{
  const lf = PRESTIGE_TIERS[1]!.from;
  // level 9 default is 87 points: 3 below the first threshold; popularity 52 adds 4 points
  const below = restaurantPrestige(mk(9));
  const above = restaurantPrestige(mk(9, 52));
  assert(
    below.points === lf - 3 &&
      below.tier.index === 0 &&
      above.points === lf + 1 &&
      above.tier.index === 1,
    "C1: the first threshold is the boundary",
    [below.points, above.points],
  );
  const top = restaurantPrestige(mk(91, 100, 80, 200));
  assert(
    top.tier.index === 4 && top.next === null && top.fraction === 1,
    "C2: the top tier has no next and a full bar",
    top.points,
  );
  const mid = restaurantPrestige(mk(14));
  assert(
    mid.next !== null && mid.fraction > 0 && mid.fraction < 1,
    "C3: between tiers the bar is partial",
    mid.fraction,
  );
  assert(
    restaurantPrestige(mk(0)).fraction >= 0 && restaurantPrestige(mk(0)).fraction < 1,
    "C4: a fresh restaurant starts its first bar",
  );
}

console.log("D. The pacing (design intent)");
{
  const firstLevel = (idx: number, pop: number, spotlessOf: (c: number) => number) => {
    for (let c = 0; c <= 91; c++)
      if (restaurantPrestige(mk(c, pop, spotlessOf(c))).tier.index >= idx) return c + 1;
    return null;
  };
  const dflt = [1, 2, 3].map((i) => firstLevel(i, 50, () => 0));
  assert(
    dflt[0]! >= 8 && dflt[0]! <= 20,
    "D1: by default Local Favourite comes in the teens",
    dflt,
  );
  assert(dflt[1]! >= 35 && dflt[1]! <= 60, "D2: City Landmark around the middle", dflt);
  assert(dflt[2] !== null && dflt[2]! >= 70, "D3: Culinary Destination near the end", dflt);
  const good = [1, 2, 3].map((i) => firstLevel(i, 75, (c) => Math.min(60, Math.floor(c / 2))));
  assert(
    good.every((g, i) => g !== null && g < dflt[i]!),
    "D4: a good player gets every tier sooner",
    [good, dflt],
  );
  assert(
    restaurantPrestige(mk(91, 75, 60)).tier.index < 4,
    "D5: Living Legend is not handed out by the campaign alone",
  );
  assert(
    restaurantPrestige(mk(91, 90, 60, 100)).tier.index === 4,
    "D6: it is reachable with excellence and the Endless restaurant",
  );
}

console.log("E. Announcing");
{
  const s0 = mk(2);
  assert(
    announcePrestige(s0).headline === null && announcePrestige(s0).save === s0,
    "E1: the starting tier is never announced",
  );
  const a = announcePrestige(mk(14));
  assert(a.headline?.name === "Local Favourite", "E2: reaching a tier announces it", a.headline);
  assert(
    chefRecordOf(a.save).seen.includes(prestigeSeenId(1)),
    "E3: the marker is in chefRecord.seen",
  );
  const b = announcePrestige(a.save);
  assert(
    b.headline === null && b.save === a.save,
    "E4: a second call says nothing and returns the same save",
  );
  const o = announcePrestige(mk(60, 75, 30)); // City Landmark in one jump
  assert(
    o.headline?.index === 2 &&
      chefRecordOf(o.save).seen.includes(prestigeSeenId(1)) &&
      chefRecordOf(o.save).seen.includes(prestigeSeenId(2)),
    "E5: an old save several tiers up hears about the highest, every tier is marked",
    o.headline,
  );
  assert(announcePrestige(o.save).headline === null, "E6: and nothing more afterwards");
  const later = mk(80, 70, 40);
  const higher = announcePrestige({
    ...later,
    business: { ...later.business, chefRecord: chefRecordOf(o.save) },
  });
  assert(
    higher.headline?.index === 3,
    "E7: a later tier is announced when it is reached",
    higher.headline,
  );
}

console.log("F. Pure and honest");
{
  const src = code("src/game/restaurant/restaurantPrestige.ts");
  assert(
    !/credits|appendLedgerEntry|economyLedger|Math\.random|Date\.now|new Date|performance\.now|window\.|localStorage|fetch\(/.test(
      src,
    ),
    "F1: no wallet, ledger, clock, random or storage in the rule file",
  );
  const text = PRESTIGE_TIERS.flatMap((t) => [t.name, t.feel]);
  assert(
    text.every((t) => !/\bonly\s+\d+\s*%|% of (chefs|players|restaurants)|top\s+\d+\s*%/i.test(t)),
    "F2: no population claim",
  );
  assert(
    !/restaurantPrestige/.test(code("src/game/SaveManager.ts")),
    "F3: no save field of its own",
  );
  assert(
    JSON.stringify(Object.keys(announcePrestige(mk(60)).save)) ===
      JSON.stringify(Object.keys(DEFAULT_SAVE)),
    "F4: announcing adds no top-level save field",
  );
}

console.log("G. Wiring");
{
  const cr = code("src/components/kc/CityRanking.tsx");
  assert(
    /export function PrestigeCard/.test(cr) &&
      /data-testid="prestige-card"/.test(cr) &&
      /PRESTIGE_FROM_LEVEL/.test(cr),
    "G1: the Progress card exists and opens from its level",
  );
  assert(
    /<PrestigeCard save=\{save\} \/>/.test(code("src/components/kc/RestaurantProgress.tsx")),
    "G2: Restaurant Progress shows it",
  );
  const app = code("src/App.tsx");
  assert(
    /announcePrestige\(nextSave\)/.test(app) &&
      /sendAnalyticsEvent\("prestige_reached"/.test(app) &&
      /prestige: prestigeHeadline/.test(app),
    "G3: a service announces a tier up, measures it and passes it to the celebration",
  );
  const c = celebrationFor({
    rank: null,
    popularity: null,
    spotlessStreak: 0,
    prestige: { tier: "Local Favourite" },
  });
  assert(
    c?.kind === "prestige" &&
      c.title === "Your restaurant is a Local Favourite!" &&
      c.lines.includes("🏛️ Prestige: Local Favourite"),
    "G4: a tier up gets its own celebration card",
    c,
  );
  const both = celebrationFor({
    rank: { from: 5, to: 4, passed: "x" },
    popularity: null,
    spotlessStreak: 0,
    prestige: { tier: "City Landmark" },
  });
  assert(
    both?.kind === "rank" && both.lines.some((l) => l.includes("Prestige")),
    "G5: with a rank rise too, one card carries both",
  );
}

console.log(
  failures === 0
    ? "\nRESTAURANT PRESTIGE QA: ALL PASS"
    : `\nRESTAURANT PRESTIGE QA: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
