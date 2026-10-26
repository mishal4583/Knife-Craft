/**
 * EARLY_MENU_QA — early game phase 2 (developer 2026-10-25): the restaurant menu and its menu
 * guests open at Level 5 (was 11). `BUSINESS_MENU_FIRST_LEVEL` is the one switch; the menu's
 * own schedule already placed its first point at the source design's old L11 = new L5.
 *   A. the unlock: the menu system, the Business tab, the map's office and counter, 1 guest;
 *   B. every dish offered at L5–10: a real recipe, cuts already taught, ingredients sold in the
 *      Market, and its stock buyable so the guest can be served;
 *   C. from Level 11 on the menu's dishes, guests, systems, day and choice level equal
 *      1965342's (rebuilt from `git show 1965342:…/restaurantProgression.ts`); the dishes'
 *      ORDER moves (Garlic Bread first), so some seeded guests pick another dish (reported);
 *   D. old saves: through SaveManager, progress, wallet and ledger are kept; completed levels get
 *      no guests (no retroactive pay); a guest already served is never offered again;
 *   E. no save field, wallet, ledger or payment code changed.
 *
 * Run: npx tsx scripts/early-menu-qa.mts
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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { DEFAULT_SAVE, SaveManager, type SaveData } from "../src/game/SaveManager.ts";
import { getLevel, type LevelProgress } from "../src/game/levels/LevelManager.ts";
import * as progression from "../src/game/restaurant/restaurantProgression.ts";
import {
  BUSINESS_MENU_FIRST_LEVEL,
  menuDishIdsAt,
  menuGuestsPerService,
  restaurantSystem,
} from "../src/game/restaurant/restaurantProgression.ts";
import { TAB_OPENS_AT, isTabOpen, grandmaTipFor } from "../src/game/restaurant/firstLevels.ts";
import { RESTAURANT_MAP_ZONES } from "../src/components/kc/restaurantMap/restaurantMapZones.ts";
import { getBusinessDish } from "../src/game/business/businessDishCatalog.ts";
import { getCampaignRecipe } from "../src/game/recipes/campaignRecipes.ts";
import { techniqueFirstLevel } from "../src/game/coaching.ts";
import { ALL_INGREDIENT_IDS } from "../src/game/business/inventoryAnalytics.ts";
import {
  menuGuestQueue,
  menuGuestsFor,
  nextMenuGuest,
  remainingMenuGuests,
} from "../src/game/restaurant/menuGuests.ts";
import { generateOrder } from "../src/game/service/OrderGenerator.ts";
import { makeSeededRand } from "../src/game/business/businessDeterministicRandom.ts";
import { servicePlanFor } from "../src/game/restaurant/preServiceCheck.ts";
import { purchaseIngredient } from "../src/game/business/BusinessInventoryManager.ts";
import { lbPerMarketUnit, marketStep } from "../src/game/business/measure.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE = "1965342";
let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`ok   ${label}`);
}

const progressAt = (n: number, menuGuests?: Record<string, number>): LevelProgress => ({
  ...DEFAULT_SAVE.levelProgress,
  currentLevelId: `level-${n}`,
  highestUnlockedLevelId: `level-${n}`,
  completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  ...(menuGuests ? { menuGuests } : {}),
});
const saveAt = (n: number, menuGuests?: Record<string, number>): SaveData => ({
  ...DEFAULT_SAVE,
  credits: 500_000,
  levelProgress: progressAt(n, menuGuests),
  business: { ...DEFAULT_SAVE.business, inventory: {} },
});
const lv = (n: number) => getLevel(`level-${n}`)!;

console.log("A. The unlock");
{
  const zone = (id: string) => RESTAURANT_MAP_ZONES.find((z) => z.id === id);
  assert(
    BUSINESS_MENU_FIRST_LEVEL === 5 &&
      restaurantSystem("menu").firstLevel === 5 &&
      TAB_OPENS_AT.business === 5 &&
      !isTabOpen("business", 4) &&
      isTabOpen("business", 5),
    "A1: the menu system and the Business tab open at Level 5 (was 11)",
  );
  assert(
    menuGuestsPerService(4) === 0 &&
      [5, 10, 15].every((n) => menuGuestsPerService(n) === 1) &&
      menuGuestsPerService(16) === 2,
    "A2: 1 menu guest per service from L5 (none before); 2 from L16 as before",
  );
  assert(
    zone("office")?.unlockLevel === 5 &&
      zone("service")?.unlockLevel === 5 &&
      /Level 5\./.test(zone("office")?.unlockDescription ?? ""),
    "A3: the map's office and service counter open with Business at L5",
    { office: zone("office"), service: zone("service") },
  );
  assert(
    grandmaTipFor(5)?.to === "business" && /menu/i.test(grandmaTipFor(5)?.text ?? ""),
    "A4: Grandma's L5 tip points at the new menu in Business",
  );
}

console.log("B. The dishes offered at L5–10");
{
  const problems: string[] = [];
  const early: string[] = [];
  for (let n = 5; n <= 10; n++) {
    for (const id of menuDishIdsAt(n)) {
      const dish = getBusinessDish(id);
      const recipe = getCampaignRecipe(dish?.sourceRecipeId ?? "");
      if (!dish || !recipe) {
        problems.push(`L${n} ${id}: no dish or recipe`);
        continue;
      }
      for (const c of recipe.components) {
        const taught = techniqueFirstLevel(c.technique as never) ?? Infinity;
        if (taught > n) problems.push(`L${n} ${id}: ${c.technique} taught at L${taught}`);
        if (!ALL_INGREDIENT_IDS.includes(c.ingredientId as never))
          problems.push(`L${n} ${id}: ${c.ingredientId} not sold`);
      }
      // A dish whose own campaign level comes later (information, not a failure).
      const ownLevel = [5, 6, 7, 8, 9, 10].find((k) => lv(k).recipePoolIds?.includes(recipe.id));
      if (n === progression.dishUnlockLevel(id) && (!ownLevel || ownLevel > n))
        early.push(`${dish.name} from L${n}${ownLevel ? ` (its level: L${ownLevel})` : ""}`);
    }
  }
  assert(
    problems.length === 0,
    "B1: every L5–10 dish is a real recipe, its cuts are taught, its ingredients are in the Market",
    problems,
  );
  console.log(
    `     info: dishes offered before the player cooks them as a level: ${early.join("; ")}`,
  );
  const unbuyable: string[] = [];
  for (let n = 5; n <= 10; n++) {
    let s = saveAt(n);
    const first = nextMenuGuest(s, lv(n));
    const plan = servicePlanFor(s, lv(n));
    if (!first || !plan) {
      unbuyable.push(`L${n}: no guest or plan`);
      continue;
    }
    for (const r of [...(plan.check.applies ? plan.check.missingRows : []), ...plan.guests.rows]) {
      const b = purchaseIngredient(
        s,
        r.ingredientId,
        r.buyUnits,
        0,
        1,
        0,
        lbPerMarketUnit(r.ingredientId, "lb"),
        marketStep(r.ingredientId),
      );
      if (b.ok) s = b.save;
      else unbuyable.push(`L${n} ${r.ingredientId}: ${b.reason}`);
    }
    if (first.inStock) unbuyable.push(`L${n}: in stock with an empty fridge`);
    if (!nextMenuGuest(s, lv(n))?.inStock) unbuyable.push(`L${n}: still out of stock after buying`);
  }
  assert(
    unbuyable.length === 0,
    "B2: at each of L5–10 the guest needs real stock, and the Market sells what the plan lists",
    unbuyable,
  );
}

console.log(`C. Nothing moves from Level 11 on (against ${BASE})`);
{
  const src = execSync(`git show ${BASE}:src/game/restaurant/restaurantProgression.ts`, {
    cwd: ROOT,
    encoding: "utf8",
  }).replace(
    /from "\.\.\/(levels|recipes|business)\/([A-Za-z0-9]+)"/g,
    (_, dir: string, m: string) =>
      `from "${pathToFileURL(path.resolve(ROOT, `src/game/${dir}/${m}.ts`)).href}"`,
  );
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kc-menu-"));
  const file = path.join(tmp, "restaurantProgression.baseline.ts");
  fs.writeFileSync(file, src);
  const base = (await import(pathToFileURL(file).href)) as typeof progression;
  fs.rmSync(tmp, { recursive: true, force: true });
  const late: string[] = [];
  for (let n = 11; n <= 150; n++) {
    // The same dishes; their order moves (Garlic Bread now joins first, at L5), see C1b.
    if ([...menuDishIdsAt(n)].sort().join() !== [...base.menuDishIdsAt(n)].sort().join())
      late.push(`L${n} menu`);
    if (menuGuestsPerService(n) !== base.menuGuestsPerService(n)) late.push(`L${n} guests`);
    if (progression.menuTargetAt(n) !== base.menuTargetAt(n)) late.push(`L${n} target`);
    if (progression.servicesForDayAt(n).join() !== base.servicesForDayAt(n).join())
      late.push(`L${n} day`);
  }
  assert(
    base.BUSINESS_MENU_FIRST_LEVEL === 11 && late.length === 0,
    "C1: from L11 to L150 the menu's dishes, its guests, its target and the day equal the baseline's",
    late.slice(0, 5),
  );
  // The guest picker (menuGuests.ts) draws from the menu in its order with a per-level seed, so
  // the new order can change WHICH dish a guest orders from L11 on (never how many). Measured
  // here with the default save (all dishes on, the chef's capacity); reported, not a failure.
  const picks = (ids: readonly string[], n: number) => {
    const pool = ids
      .map((id) => getCampaignRecipe(getBusinessDish(id)?.sourceRecipeId ?? ""))
      .filter((r): r is NonNullable<typeof r> => !!r);
    const rand = makeSeededRand(n * 104729 + 17);
    const out: string[] = [];
    for (let i = 0; i < menuGuestsFor(saveAt(n), n); i++) {
      const pick = generateOrder(
        {
          unlockedRecipes: pool,
          recentRecipeIds: out,
          recentCuisineIds: out.map((id) => getCampaignRecipe(id)?.cuisineId),
        },
        rand,
      );
      if (!pick) break;
      out.push(pick.id);
    }
    return out.join();
  };
  const moved: number[] = [];
  for (let n = 11; n <= 150; n++)
    if (picks(menuDishIdsAt(n), n) !== picks(base.menuDishIdsAt(n), n)) moved.push(n);
  assert(
    picks(menuDishIdsAt(40), 40) ===
      menuGuestQueue(saveAt(40), lv(40))
        .map((r) => r.id)
        .join(),
    "C1b: the replica matches the game's guest queue (L40)",
  );
  console.log(
    `     info: levels 11–150 where a guest now orders a different dish (same count): ${moved.length} — ${moved.join(",")}`,
  );
  const others = (s: readonly progression.RestaurantSystem[]) =>
    s
      .filter((x) => x.id !== "menu")
      .map((x) => `${x.id}@${x.firstLevel}`)
      .join();
  assert(
    others(progression.RESTAURANT_SYSTEMS) === others(base.RESTAURANT_SYSTEMS) &&
      progression.MENU_CHOICE_LEVEL === base.MENU_CHOICE_LEVEL &&
      progression.CUISINES.map((c) => `${c.id}@${c.firstLevel}`).join() ===
        base.CUISINES.map((c) => `${c.id}@${c.firstLevel}`).join(),
    "C2: every other system, the cuisines and the menu-choice level (L35) are unchanged",
  );
  const before: string[] = [];
  for (let n = 1; n <= 10; n++) {
    if (base.menuDishIdsAt(n).length || base.menuGuestsPerService(n)) before.push(`L${n}`);
  }
  assert(
    before.length === 0 && menuDishIdsAt(4).length === 0 && menuDishIdsAt(5).length === 1,
    "C3: the baseline had no menu or guests in L1–10; now the menu starts at L5",
    before,
  );
}

console.log("D. Old saves and players already past Level 5");
{
  const old = {
    ...saveAt(8),
    credits: 123_456,
    economyLedger: [
      {
        id: "x1",
        category: "campaign-settlement",
        amount: 9_000,
        balanceAfter: 123_456,
        at: 1,
      },
    ],
  } as unknown as SaveData;
  delete (old.levelProgress as { menuGuests?: unknown }).menuGuests;
  await SaveManager.save(old);
  const back = await SaveManager.load();
  assert(
    back.levelProgress.completedLevelIds.join() === old.levelProgress.completedLevelIds.join() &&
      back.levelProgress.currentLevelId === "level-8" &&
      back.levelProgress.highestUnlockedLevelId === "level-8" &&
      back.credits === old.credits &&
      back.economyLedger.length === old.economyLedger.length,
    "D1: an old save at L8 loads with its progress, wallet and ledger unchanged",
    {
      completed: back.levelProgress.completedLevelIds.length,
      credits: back.credits,
      ledger: back.economyLedger.length,
    },
  );
  assert(
    [5, 6, 7].every(
      (n) => nextMenuGuest(back, lv(n)) === null && remainingMenuGuests(back, lv(n)).length === 0,
    ),
    "D2: the levels it already finished (L5–7) get no guests: nothing is offered or paid retroactively",
  );
  const g = nextMenuGuest(back, lv(8));
  assert(
    !!g && g.number === 1 && g.total === 1,
    "D3: its current level (L8) now has its one guest, numbered 1 of 1",
    g && { number: g.number, total: g.total },
  );
  const served = saveAt(8, { "level-8": 1 });
  // Rule changed (developer 2026-10-25, early game phase 3): after the menu guest a walk-in
  // follows (was: nothing). The guest itself is still never offered again.
  const afterGuest = nextMenuGuest(served, lv(8));
  const bothServed = saveAt(8, { "level-8": 2 });
  assert(
    remainingMenuGuests(served, lv(8)).length === 0 &&
      afterGuest?.kind === "walk-in" &&
      nextMenuGuest(bothServed, lv(8)) === null,
    "D4: a guest already served at L8 is never offered again (no duplicate guest or payment); the walk-in follows, then nothing",
    afterGuest && { kind: afterGuest.kind, number: afterGuest.number },
  );
  const later = saveAt(40, { "level-40": 1 });
  const g40 = nextMenuGuest(later, lv(40));
  assert(
    !!g40 && g40.number === 2 && remainingMenuGuests(later, lv(40)).length === g40.total - 1,
    "D5: a player at L40 keeps its served count; the next guest continues from it",
    g40 && { number: g40.number, total: g40.total },
  );
}

console.log("E. No save, wallet, ledger or payment change");
{
  // Early game phase 3 (developer 2026-10-25): walk-ins change menuGuests.ts and App.tsx's
  // offer label; walkin-qa guards them. The save, wallet, ledger and payment stay unchanged.
  const diff = execSync(
    `git diff ${BASE} --stat -- src/game/SaveManager.ts src/game/business/businessTypes.ts src/game/economy ':!src/game/economy/staffDefinitions.ts' src/game/business/BusinessServiceManager.ts src/game/levels/LevelManager.ts`,
    { cwd: ROOT, encoding: "utf8" },
  );
  // Rule changed (developer 2026-10-26, "the game starts at 0 cash"): SaveManager may change
  // only the new save's opening credits (DEFAULT_SAVE.credits $1,240 → $0) and its comment.
  const saveLines = execSync(`git diff -U0 ${BASE} -- src/game/SaveManager.ts`, {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter((l) => /^[+-](?![+-])/.test(l))
    .filter(
      (l) =>
        !/^-\s*\/\*\* \$1,240\.00 starting balance|^-\s*credits: dollars\(1240\),$|^\+\s*credits: 0,$|^\+\s*(\/\*\*|\*\/|\*( .*)?)$/.test(
          l,
        ),
    );
  const rest = execSync(
    `git diff ${BASE} --stat -- src/game/business/businessTypes.ts src/game/economy ':!src/game/economy/staffDefinitions.ts' src/game/business/BusinessServiceManager.ts src/game/levels/LevelManager.ts`,
    { cwd: ROOT, encoding: "utf8" },
  );
  assert(
    saveLines.length === 0 && rest.trim() === "",
    "E1: SaveManager (but the new save's opening $0), the business and level save types, the wallet / ledger and payment are unchanged (phase 4: staffDefinitions.ts changes its unlock levels only)",
    { saveLines, rest },
  );
}

console.log(
  failures === 0 ? "\nEARLY MENU QA: ALL PASS" : `\nEARLY MENU QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
