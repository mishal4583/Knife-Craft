/**
 * CITY RANKING QA (developer 2026-10-09: "add some mock restaurants and
 * implement a ranking — gradually progress to the top 1 restaurant after
 * completing the campaign").
 *
 *  C1 the guide: 49 made-up rivals + the player = 50, unique, reputations
 *     strictly rising weakest → best;
 *  C2 the climb: #50 before any level, never down as levels complete, at
 *     most one rival passed per level, never more than 8 levels without
 *     passing one, #2 at Level 249 and #1 exactly at Level 250;
 *  C3 each rival is passed by completing its own level;
 *  C4 derived from the save (no new save field), the Endless stars after
 *     Level 250 only add reputation;
 *  C5 rankChange: the first completion that passes a rival names it, a
 *     replay (no new level) or a level that passes nobody returns null;
 *  W  wiring: the Kitchen card and Restaurant Progress show it in the
 *     restaurant build, App's completion adds the Level Complete line, the
 *     classic build keeps its café rank card.
 *
 * Run: npx tsx scripts/restaurant-city-ranking-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  CITY_RESTAURANTS,
  REPUTATION_PER_LEVEL,
  RIVALS,
  cityRanking,
  cityRankingAt,
  completedCampaignLevels,
  rankChange,
  reputationFor,
} from "../src/game/restaurant/cityRanking.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const done = (n: number) => Array.from({ length: n }, (_, i) => `level-${i + 1}`);
const saveAt = (n: number, extra: Partial<SaveData> = {}): SaveData => ({
  ...DEFAULT_SAVE,
  levelProgress: {
    currentLevelId: `level-${Math.min(n + 1, 250)}`,
    highestUnlockedLevelId: `level-${Math.min(n + 1, 250)}`,
    completedLevelIds: done(n),
  },
  ...extra,
});

console.log("C1. The guide");
{
  const ids = new Set(RIVALS.map((r) => r.id));
  const names = new Set(RIVALS.map((r) => r.name));
  assert(
    RIVALS.length === 49 &&
      CITY_RESTAURANTS === 50 &&
      ids.size === 49 &&
      names.size === 49 &&
      RIVALS.every((r, i) => i === 0 || r.reputation > RIVALS[i - 1]!.reputation) &&
      RIVALS.every((r) => r.emoji && r.cuisine && r.district),
    "C1: 49 rivals + you = 50 restaurants, unique, reputations strictly rising weakest → best",
  );
}

console.log("C2. The climb");
{
  const ranks = Array.from({ length: 251 }, (_, n) => cityRankingAt(n).rank);
  let maxGap = 0;
  let since = 0;
  for (let n = 1; n <= 250; n++) {
    since = ranks[n]! < ranks[n - 1]! ? 0 : since + 1;
    maxGap = Math.max(maxGap, since);
  }
  assert(
    ranks[0] === 50 &&
      ranks.every((r, n) => n === 0 || r <= ranks[n - 1]!) &&
      ranks.every((r, n) => n === 0 || ranks[n - 1]! - r <= 1) &&
      maxGap <= 8 &&
      ranks[249] === 2 &&
      ranks[250] === 1 &&
      ranks.slice(0, 250).every((r) => r > 1),
    `C2: #50 → #1 one rival at a time, never more than 8 levels without passing one (longest ${maxGap}); #1 only at Level 250`,
  );
  const at = cityRankingAt(250);
  assert(
    at.next === null && at.fraction === 1 && at.table[0]!.player && at.table.length === 50,
    "C2: at Level 250 you top the table — nobody left to pass",
  );
}

console.log("C3. Each rival has its level");
{
  assert(
    RIVALS.every(
      (r) =>
        cityRankingAt(r.passedAtLevel - 1).next?.id === r.id &&
        cityRankingAt(r.passedAtLevel).passed?.id === r.id,
    ),
    "C3: every rival is the next to pass until its level is completed, then the last one passed",
  );
}

console.log("C4. Derived from the save");
{
  const s = saveAt(47);
  const c = cityRanking(s);
  const stars = cityRanking({
    ...saveAt(250),
    business: { ...DEFAULT_SAVE.business, endlessStars: { total: 12, days: 6, bestDay: 3 } },
  });
  assert(
    completedCampaignLevels(s) === 47 &&
      c.rank === cityRankingAt(47).rank &&
      c.reputation === 47 * REPUTATION_PER_LEVEL &&
      completedCampaignLevels({
        levelProgress: { ...s.levelProgress, completedLevelIds: [...done(47), "level-3"] },
      }) === 47 &&
      stars.rank === 1 &&
      stars.reputation === reputationFor(250, 12) &&
      !/cityRanking|cityRank/.test(read("src/game/SaveManager.ts")),
    "C4: the ranking reads the completed levels (duplicates once), Endless stars only add reputation, nothing is saved",
  );
}

console.log("C5. Rank changes");
{
  const pass = RIVALS[20]!; // a mid-table rival
  const before = saveAt(pass.passedAtLevel - 1);
  const after = saveAt(pass.passedAtLevel);
  const moved = rankChange(before, after);
  const quiet = RIVALS.find((r, i) => i > 0 && r.passedAtLevel - RIVALS[i - 1]!.passedAtLevel > 1)!;
  assert(
    moved !== null &&
      moved.to === moved.from - 1 &&
      moved.passed.length === 1 &&
      moved.passed[0]!.id === pass.id &&
      rankChange(after, after) === null &&
      rankChange(saveAt(quiet.passedAtLevel - 2), saveAt(quiet.passedAtLevel - 1)) === null,
    `C5: completing Level ${pass.passedAtLevel} passes ${pass.name} (#${moved?.from} → #${moved?.to}); a replay or a quiet level moves nothing`,
  );
}

console.log("W. Wiring");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const progress = read("src/components/kc/RestaurantProgress.tsx");
  const app = read("src/App.tsx");
  assert(
    /RESTAURANT_MODE \? \(\s*<CityRankBadge save=\{save\} \/>/.test(kitchen) &&
      /CAFE_MILESTONES\.length/.test(kitchen) &&
      /<CityRankHero save=\{save\} \/>/.test(progress) &&
      /<CityLeaderboard save=\{save\} \/>/.test(progress) &&
      /<RankHero p=\{p\} \/>/.test(progress) &&
      /RESTAURANT_MODE && isFirstCompletion \? rankChange\(save, finalSave\)/.test(app) &&
      /label: "🏆 City ranking"/.test(app),
    "W: the Kitchen card and Restaurant Progress show the city ranking (restaurant build), Level Complete says when you climb, the classic build keeps its café rank",
  );
}

console.log(failures ? `CITY RANKING QA: ${failures} FAILURE(S)` : "CITY RANKING QA: ALL PASS");
process.exit(failures ? 1 : 0);
