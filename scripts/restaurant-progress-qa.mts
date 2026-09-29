/**
 * RESTAURANT PROGRESS QA — the screen that replaced Rack.
 *
 *  A. Every value is derived from the real save/definitions (level, chapter,
 *     café rank, popularity, knives, boards, Blacksmith, kitchen stage).
 *  B. Next goal = the existing reward timeline; none after the campaign.
 *  C. Money: only exact figures (balance, level rewards, Business lifetime revenue).
 *  D. Milestones derive from the save; the city benchmark is deterministic and
 *     clearly fictional.
 *  E. Read-only: the view model never mutates the save; the screen has no
 *     purchase/equip/upgrade path; no new save fields; no chart library.
 *  F. Rack is gone; the nav/hotspot say Progress; Settings shows only real options.
 *  G. Rank bar, popularity stars, completion %, chapters/recipes/staff/Business
 *     stats, real-event milestones, one progression screen, dead mock types gone.
 *
 * Run: npx tsx scripts/restaurant-progress-qa.mts
 */
const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => void memoryStore.set(k, v),
  removeItem: (k: string) => void memoryStore.delete(k),
  clear: () => memoryStore.clear(),
  key: () => null,
  length: 0,
} as Storage;

import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { LEVELS, CHAPTER_TITLES } from "../src/game/levels/levelDefinitions.ts";
import { getNextRewardPreview } from "../src/game/levels/levelMastery.ts";
import { CAFE_MILESTONES } from "../src/game/cafe/cafeDefinitions.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { migrateKitchenDevelopment, syncKitchenUpgradeOwnership } from "../src/game/kitchen/KitchenUpgradeManager.ts";
import { dollars, formatUsd } from "../src/game/money.ts";
import { getCafeProgress } from "../src/game/cafe/CafeProgressionManager.ts";
import { STAFF_CATALOG } from "../src/game/economy/staffDefinitions.ts";
import {
  restaurantProgress,
  cityBenchmark,
  popularityStars,
  popularityMood,
  CITY_BENCHMARK,
  UPGRADE_STEPS_PER_KNIFE,
} from "../src/game/progression/restaurantProgress.ts";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`);
  } else {
    console.log(`ok   ${label}`);
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf8");

/** A save that has completed levels 1..n (so level n+1 is current). */
function saveAt(n: number, extra: Partial<SaveData> = {}): SaveData {
  const base = structuredClone(DEFAULT_SAVE);
  const done = LEVELS.slice(0, n).map((l) => l.id);
  const next = LEVELS[Math.min(n, LEVELS.length - 1)]!.id;
  // Economy V2.5: kitchen tiers are bought. These fixtures model a player who built every
  // tier as soon as it unlocked (exactly what the pre-V2.5 migration grants), unless `extra`
  // says otherwise.
  return syncKitchenUpgradeOwnership({
    ...migrateKitchenDevelopment({
      ...base,
      version: 2,
      levelProgress: { ...base.levelProgress, completedLevelIds: done, currentLevelId: next, highestUnlockedLevelId: next },
    }),
    ...extra,
  });
}

// ===== A: real derived values =====
{
  const s = saveAt(86, {
    ownedKnifeIds: ["chef", "santoku", "paring", "nakiri", "bread"],
    equippedKnifeId: "nakiri",
    ownedBoardIds: ["walnut", "maple", "herb", "marble"],
    knifeUpgrades: { nakiri: { sharpness: 3, speed: 2, handling: 4 }, chef: { sharpness: 2 } },
  });
  s.business = { ...s.business, popularity: { score: 84 } };
  const p = restaurantProgress(s);
  assert(p.level.current === 87 && p.level.completed === 86 && p.level.total === 250, `A: level 87 / 250 with 86 completed (got ${p.level.current}, ${p.level.completed})`);
  assert(p.chapter.number === LEVELS[86]!.chapter && p.chapter.total === 25 && p.chapter.title === CHAPTER_TITLES[LEVELS[86]!.chapter], `A2: chapter ${p.chapter.number} / 25 · ${p.chapter.title} (from the level data)`);
  const expectedRank = [...CAFE_MILESTONES].reverse().find((m) => 87 >= m.levelRequired)!;
  const expectedNext = CAFE_MILESTONES.find((m) => m.levelRequired > 87);
  assert(p.rank.title === expectedRank.title && p.nextRank?.title === expectedNext?.title && p.nextRank?.levelRequired === expectedNext?.levelRequired, `A3: rank "${p.rank.title}", next "${p.nextRank?.title}" at Lv ${p.nextRank?.levelRequired} (existing café ranks)`);
  assert(p.popularity === 84, "A4: popularity is Business Mode's own score (84)");
  assert(p.knivesOwned === 5 && p.knives.length === KNIFE_CATALOG.length && p.knives.find((k) => k.equipped)?.knife.id === "nakiri", `A5: knives 5 / ${KNIFE_CATALOG.length}, Nakiri in hand`);
  assert(p.knives.find((k) => k.knife.id === "nakiri")!.blacksmithLevel === 1 + 2 + 1 + 3 && p.blacksmith.upgradeSteps === (2 + 1 + 3) + 1, `A6: Blacksmith — Nakiri ★7, ${p.blacksmith.upgradeSteps} upgrade steps across owned knives`);
  assert(p.blacksmith.maxForOwned === 5 * UPGRADE_STEPS_PER_KNIFE && p.blacksmith.maxAll === KNIFE_CATALOG.length * 12 && UPGRADE_STEPS_PER_KNIFE === 12, "A7: mastery maxima (12 steps per knife) come from the Blacksmith constants");
  assert(p.boardsOwned === 4 && p.boards.length === BOARD_CATALOG.length, `A8: boards 4 / ${BOARD_CATALOG.length}`);
  const expectedKitchen = [...KITCHEN_UPGRADE_CATALOG].reverse().find((u) => 87 >= u.unlockLevel)!;
  assert(p.kitchen.current === expectedKitchen.name && p.kitchen.stages.filter((st) => st.reached).length === KITCHEN_UPGRADE_CATALOG.filter((u) => 87 >= u.unlockLevel).length, `A9: kitchen stage "${p.kitchen.current}" and journey reflect the real kitchen upgrades`);
  const fresh = restaurantProgress(saveAt(0));
  assert(fresh.level.current === 1 && fresh.level.completed === 0 && fresh.knivesOwned === 1 && fresh.blacksmith.upgradeSteps === 0 && fresh.popularity === 50 && fresh.kitchen.current === "Humble Kitchen", "A10: a new player: Level 1, 1 knife, no upgrades, default popularity 50, Humble Kitchen");
}

// ===== B: next goal =====
{
  for (const n of [5, 40, 89, 90, 125, 245]) {
    const s = saveAt(n);
    const p = restaurantProgress(s);
    const want = getNextRewardPreview(p.level.reached);
    assert(!!p.nextGoal && p.nextGoal.name === want?.name && p.nextGoal.atLevel === want?.atLevel && p.nextGoal.atLevel > p.level.reached, `B: at ${n} completed → next goal "${p.nextGoal?.icon} ${p.nextGoal?.name} · Lv ${p.nextGoal?.atLevel}" (the existing reward timeline)`);
  }
  const done = restaurantProgress(saveAt(250));
  assert(done.campaignComplete && done.nextGoal === null && done.level.completed === 250, "B2: after Level 250 there is no future goal — Campaign Complete");
}

// ===== C: money =====
{
  const s = saveAt(40, { credits: 21519 });
  s.business = { ...s.business, finance: { ...s.business.finance, lifetime: { ...s.business.finance.lifetime, revenue: 281550 } } };
  const p = restaurantProgress(s);
  // Economy V2.5: each level pays its paid reward (levelRewards.ts), not the stored one.
  const exactRewards = LEVELS.slice(0, 40).reduce((t, l) => t + paidLevelReward(l), 0);
  assert(p.money.balance === 21519 && formatUsd(p.money.balance) === "$215.19", "C: balance is the wallet, shown as $215.19");
  assert(p.money.levelRewards === exactRewards, `C2: level rewards = the exact sum of the 40 completed levels' paid rewards (${formatUsd(exactRewards)})`);
  assert(p.money.businessRevenue === 281550 && formatUsd(p.money.businessRevenue) === "$2,815.50", "C3: Business revenue is Business Mode's lifetime total ($2,815.50)");
  const curve = p.money.rewardCurve;
  assert(curve.length === 40 && curve.every((q, i) => i === 0 || (q.level > curve[i - 1]!.level && q.cumulative > curve[i - 1]!.cumulative)) && curve[curve.length - 1]!.cumulative === exactRewards, "C4: earnings chart = cumulative real level rewards, one point per completed level, ending at the total");
  assert(restaurantProgress(saveAt(0)).money.rewardCurve.length === 0, "C5: no completed levels → no chart points (never a fake line)");
}

// ===== D: milestones + benchmark =====
{
  const p = restaurantProgress(saveAt(55, { ownedKnifeIds: ["chef", "santoku", "damascus"] }));
  const m = (label: string) => p.milestones.find((x) => x.label === label)?.done;
  assert(m("Completed 10 levels") === true && m("Completed 50 levels") === true && m("Completed 100 levels") === false, "D: level milestones follow completed levels");
  assert(m("Santoku in your kit") === true && m("Damascus Knife in your kit") === true && m("Nakiri in your kit") === false, "D2: knife milestones follow real ownership");
  assert(p.milestones.find((x) => x.id === "campaign-complete")?.done === false && restaurantProgress(saveAt(250)).milestones.every((x) => x.label.startsWith("Completed") ? x.done : true), "D3: the campaign milestone is only done at 250");
  const b84 = cityBenchmark(84);
  assert(JSON.stringify(b84.map((r) => r.name)) === JSON.stringify(["Golden Spoon", "Hearth & Herb", "The Green Table", "Your Restaurant", "Cozy Cravings", "Copper Pot Bistro", "Corner Crumb"]) && b84[3]!.rank === 4 && b84[3]!.isPlayer, "D4: popularity 84 places Your Restaurant 4th among the benchmark");
  assert(cityBenchmark(99)[0]!.isPlayer && cityBenchmark(0)[CITY_BENCHMARK.length]!.isPlayer && cityBenchmark(86)[3]!.isPlayer, "D5: top / bottom / exact-tie placements are deterministic (a tie ranks below the benchmark)");
  assert(JSON.stringify(cityBenchmark(84)) === JSON.stringify(cityBenchmark(84)) && cityBenchmark(84).filter((r) => r.isPlayer).length === 1, "D6: same input, same ranking; exactly one player row");
  const screen = read("src/components/kc/RestaurantProgress.tsx");
  assert(/city benchmark/i.test(screen) && /fictional/i.test(screen) && /not other players/i.test(screen), "D7: the ranking is labelled a city benchmark of fictional restaurants, not players");
}

// ===== E: read-only, no new save fields, no chart library =====
{
  const s = saveAt(120, { credits: 123456 });
  const before = JSON.stringify(s);
  restaurantProgress(s);
  assert(JSON.stringify(s) === before, "E: computing the screen never mutates the save");
  const model = read("src/game/progression/restaurantProgress.ts");
  assert(!/credits\s*[-+]?=|economyLedger\s*=|appendLedgerEntry|SaveManager\.save|: SaveData\s*=>\s*\{/.test(model) && !/\bbuy|equip[A-Z]|upgradeKnife\(|sharpenKnife\(/.test(model.replace(/equipped/g, "")), "E2: the view model has no wallet/ledger writes and no purchase/equip calls");
  const screen = read("src/components/kc/RestaurantProgress.tsx");
  assert(!/buy[A-Z]|equip[A-Z]|upgradeKnife|sharpenKnife|persist|onPurchase|KButton/.test(screen), "E3: the screen has no purchase, equip, upgrade or sharpen action (display only)");
  assert(JSON.stringify(Object.keys(DEFAULT_SAVE)) === JSON.stringify(["version", "credits", "equippedKnifeId", "equippedBoardId", "ownedKnifeIds", "ownedBoardIds", "ownedKitchenUpgradeIds", "equippedKitchenUpgradeId", "ownedKitchenInvestmentIds", "knifeSharpness", "knifeUpgrades", "ownedStaffIds", "selectedSupplierId", "economyLedger", "recipeProgress", "settings", "levelProgress", "story", "dailyOrder", "endless", "business"]), "E4: no new save fields");
  assert(!/from ["'](recharts|chart\.js|d3|echarts|victory|nivo|apexcharts)/.test(screen) && /<svg/.test(screen), "E5: charts are small inline SVG — no chart library");
}

// ===== F: Rack replaced; settings are real =====
{
  assert(!fs.existsSync(path.resolve(ROOT, "src/components/kc/Rack.tsx")), "F: the old Rack screen is gone");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const navGlyphs = [...kitchen.matchAll(/\{ id: "[a-z-]+", label: "[^"]+", glyph: "([^"]+)" \}/g)].map((x) => x[1]);
  assert(navGlyphs.length >= 4 && new Set(navGlyphs).size === navGlyphs.length, `F2b: every bottom-nav destination has its own icon (${navGlyphs.join(" ")})`);
  assert(/\{ id: "rack", label: "Progress", glyph: "🏆" \}/.test(kitchen) && /label="Progress"/.test(kitchen) && !/label="Rack"/.test(kitchen), "F2: bottom nav and Kitchen shortcut say 🏆 Progress, not Rack");
  const router = read("src/ScreensRouter.tsx");
  assert(/screen === "rack" \? <RestaurantProgress go=\{go\} save=\{save\} \/>/.test(router), "F3: the existing route now opens Restaurant Progress (no second navigation system)");
  // The old in-Business "Market" overview was folded into the Business Equipment tab.
  const shopFor = read("src/components/kc/business/BusinessRefrigerator.tsx");
  assert(!/Rack/.test(shopFor.replace(/\/\*[\s\S]*?\*\//g, "")) && /Manage in the Market/.test(shopFor), "F4: Business points to the Market (where equipping/sharpening live), not Rack");
  const journal = read("src/components/kc/Journal.tsx");
  const settings = journal.slice(journal.indexOf("export function Settings"));
  assert(/label="Sound"/.test(settings) && !/label="Music"|label="Reduced motion"|label="Language"|label="Accessibility"|Larger cut guides|[Mm]usic by/.test(settings), "F5: Settings shows only real options (Sound + Reset Progress) and promises no music");
  const ui = ["src/components/kc/Kitchen.tsx", "src/components/kc/RestaurantProgress.tsx", "src/components/kc/Shop.tsx", "src/components/kc/business/BusinessRefrigerator.tsx", "src/components/kc/business/BusinessDashboard.tsx"];
  const rackText = ui.filter((f) => /[">][^"<]*\bRack\b[^"<]*["<]/.test(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
  assert(rackText.length === 0, `F6: no player-facing "Rack" text remains${rackText.length ? " — " + rackText.join(", ") : ""}`);
}

// ===== G: rank, popularity, statistics, milestones, one progression screen =====
{
  const s87 = saveAt(86);
  const p87 = restaurantProgress(s87);
  const cafe = getCafeProgress(s87.levelProgress);
  assert(p87.rank.fraction === cafe.progressFraction && p87.rank.fraction >= 0 && p87.rank.fraction <= 1, `G: rank bar = the café rank's own progress fraction (${Math.round(p87.rank.fraction * 100)}%)`);
  const p125 = restaurantProgress(saveAt(125));
  assert(p125.nextRank === null && p125.rank.fraction === 1, "G2: past the last café rank (Lv 120) there is no next rank and the bar is full");
  assert(popularityStars(0) === 0 && popularityStars(50) === 3 && popularityStars(84) === 4 && popularityStars(96) === 5 && popularityStars(100) === 5, "G3: popularity stars round 0–100 to 0–5 (50 → ★★★, 84 → ★★★★)");
  assert(new Set([5, 30, 50, 70, 90].map(popularityMood)).size === 5 && popularityMood(50) === "Your restaurant is becoming more popular.", "G4: a popularity line for each band; 50 reads 'becoming more popular'");
  const p184 = restaurantProgress(saveAt(184));
  assert(p184.level.completed === 184 && (p184.level.completed / p184.level.total) * 100 === 73.6, "G5: campaign completion % is completed / 250 (184 → 73.6%)");
  const chaptersDone = [...new Set(LEVELS.map((l) => l.chapter))].filter((c) => LEVELS.filter((l) => l.chapter === c).every((l) => LEVELS.indexOf(l) < 184)).length;
  assert(p184.chapter.completed === chaptersDone && restaurantProgress(saveAt(250)).chapter.completed === 25 && restaurantProgress(saveAt(0)).chapter.completed === 0, `G6: chapters completed counts fully-finished chapters (${chaptersDone} at 184; 25 at 250; 0 new)`);
  const recipeIds = (ls: typeof LEVELS) => new Set(ls.flatMap((l) => [l.recipeId, ...(l.recipePoolIds ?? [])]));
  assert(p184.recipes.cooked === recipeIds(LEVELS.slice(0, 184)).size && p184.recipes.total === recipeIds(LEVELS).size && restaurantProgress(saveAt(250)).recipes.cooked === p184.recipes.total, `G7: recipes cooked = distinct recipes of completed levels (${p184.recipes.cooked} / ${p184.recipes.total})`);
  const staffSave = saveAt(30, { ownedStaffIds: [STAFF_CATALOG[0]!.id] });
  staffSave.business = { ...staffSave.business, calendar: { ...staffSave.business.calendar, businessDay: 4 } };
  const ps = restaurantProgress(staffSave);
  const ms = (label: string) => ps.milestones.find((x) => x.label === label)?.done;
  assert(ps.staff.hired === 1 && ps.staff.total === STAFF_CATALOG.length && ps.business.day === 4 && ps.business.daysRun === 3, `G8: staff 1 / ${STAFF_CATALOG.length}; Business Day 4 = 3 days run (from the Business calendar)`);
  const fresh = restaurantProgress(saveAt(0));
  const mf = (label: string) => fresh.milestones.find((x) => x.label === label)?.done;
  assert(mf("First dish served") === false && mf("First Business day completed") === false && mf("First staff member hired") === false && mf("First Blacksmith upgrade") === false && fresh.business.daysRun === 0, "G9: a new player has none of the event milestones");
  assert(ms("First dish served") === true && ms("First Business day completed") === true && ms("First staff member hired") === true && ms("First Blacksmith upgrade") === false, "G10: event milestones follow the save (dish, Business day, staff) and stay open until they happen (Blacksmith)");
  const up = restaurantProgress(saveAt(12, { knifeUpgrades: { chef: { speed: 2 } } }));
  assert(up.milestones.find((x) => x.label === "First Blacksmith upgrade")?.done === true, "G11: one real Blacksmith upgrade completes 'First Blacksmith upgrade'");
  const half = (n: number) => restaurantProgress(saveAt(n)).milestones.find((x) => x.label === "Halfway through the campaign")?.done;
  assert(half(124) === false && half(125) === true, "G12: 'Halfway through the campaign' flips at exactly 125 completed levels");
  const finalStart = Math.min(...LEVELS.filter((l) => l.chapter === 25).map((l) => LEVELS.indexOf(l) + 1));
  const fin = (n: number) => restaurantProgress(saveAt(n)).milestones.find((x) => x.label.startsWith("Final chapter reached"))?.done;
  assert(fin(finalStart - 2) === false && fin(finalStart - 1) === true, `G13: 'Final chapter reached' once Level ${finalStart} (Chapter 25's first) is unlocked`);
  assert(fresh.milestones.filter((x) => !x.done && x.atLevel !== undefined).every((x) => x.atLevel! >= 1 && x.atLevel! <= 250) && fresh.milestones.find((x) => x.label.startsWith("First kitchen upgrade"))?.atLevel === KITCHEN_UPGRADE_CATALOG.find((u) => u.unlockLevel > 1)!.unlockLevel, "G14: locked campaign milestones show the real level that unlocks them");
  const all250 = restaurantProgress(saveAt(250, { ownedKnifeIds: KNIFE_CATALOG.map((k) => k.id), ownedStaffIds: STAFF_CATALOG.map((x) => x.id), knifeUpgrades: { chef: { speed: 2 } } }));
  assert(all250.milestones.filter((x) => x.label !== "First Business day completed").every((x) => x.done), "G15: at 250 with every knife/staff and one upgrade, every milestone except the Business-day one is done (that needs a real Business day)");
  const screen = read("src/components/kc/RestaurantProgress.tsx");
  assert(/title=\{"🏆\u00a0Restaurant Progress"\}/.test(screen) && /wrapTitle/.test(screen) && /Local restaurant rankings/.test(screen) && /<Stars n=\{popularityStars\(r\.popularity\)\}/.test(screen), "G16: header '🏆 Restaurant Progress' (wraps on narrow phones); rankings labelled local, with a star rating per restaurant");
  assert(/All \{p\.level\.total\} levels mastered/.test(screen) && /Family Legacy/.test(screen) && /Your restaurant is yours\./.test(screen) && !/richest|number one|#1/i.test(screen), "G17: Campaign Complete shows the Family Legacy reward and 'Your restaurant is yours.' (no unsupported 'richest'/'#1' claim)");
  const data = read("src/components/kc/data.ts");
  const router = read("src/ScreensRouter.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const journal = read("src/components/kc/Journal.tsx");
  assert(!/\| "progression"/.test(data) && !/screen === "progression"/.test(router) && !/export function Progression/.test(journal) && !/go\("progression"\)/.test(kitchen) && !/Chef's Journey/.test(journal.replace(/\/\/.*$/gm, "")), "G18: one progression screen — Chef's Journey merged into Restaurant Progress; the Kitchen rank badge opens it");
  const types = read("src/types/game.ts");
  assert(!/reducedMotion|music|Decoration|Achievement|GameEvents/.test(types), "G19: the old mock UI contract (fake Settings with music/reduced motion, decor, achievements) is gone");
  const cardsPath = "src/components/kc/common/Cards.tsx";
  const cards = fs.existsSync(path.resolve(ROOT, cardsPath)) ? read(cardsPath) : "";
  assert(!/DecorCard|AchievementCard|CustomerCard|@\/types\/game/.test(cards), "G20: mock decor/achievement/customer cards are gone");
  const srcFiles = (fs.readdirSync(path.resolve(ROOT, "src"), { recursive: true }) as string[]).filter((f) => /\.(ts|tsx)$/.test(f));
  const qaLeft = srcFiles.filter((f) => /QA_MODE|qaMode|QA MODE|VITE_KNIFECRAFT_QA|IngredientLab|ingredient-lab/.test(read(path.join("src", f))));
  assert(qaLeft.length === 0 && !fs.existsSync(path.resolve(ROOT, "src/game/qaMode.ts")) && !fs.existsSync(path.resolve(ROOT, ".env.local.example")), `G23: QA Mode is fully removed — no level-unlock bypass, no QA badge, no Ingredient Lab${qaLeft.length ? " — still in " + qaLeft.join(", ") : ""}`);
  const model = read("src/game/progression/restaurantProgress.ts");
  const board = kitchen.slice(kitchen.indexOf("export function OrderBoard"));
  assert(/const campaignComplete = levels\.every\(\(l\) => isCompleted\(l\.id, levelProgress\)\)/.test(board) && /🏆 Campaign Complete/.test(board) && /levels mastered — replay any level or run your restaurant/.test(board) && /nextReward && !campaignComplete/.test(board) && /stageAfter && !campaignComplete/.test(board), "G22: after Level 250 the Order Board shows '🏆 Campaign Complete' instead of early-game Next/Reward hints (unchanged before 250)");
  assert(/balance: save\.credits/.test(model) && !/coins?\s*:/.test(model.replace(/reward\.coins/g, "")), "G21: one wallet — the balance is save.credits (cents); no coin/second currency");
}

console.log(failures === 0 ? "\nRESTAURANT PROGRESS QA: ALL PASS" : `\nRESTAURANT PROGRESS QA: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
