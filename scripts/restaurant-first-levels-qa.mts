/**
 * FIRST LEVELS QA (developer 2026-10-09, "Levels 1–15 retention", pass 1 —
 * presentation only; restaurant/firstLevels.ts).
 *
 *  T  the bottom-bar sections open one at a time: Kitchen always, Inventory
 *     L3, Market L7, Progress L10, Restaurant L11;
 *  G  Grandma's fifteen Level Complete lines, verbatim, and none after L15;
 *  D  before Level 21 a day ends quietly with the same closeDay (no money,
 *     no ledger, no stock moves; only the day number), the ceremony starts
 *     at Level 21;
 *  M  the Level 10 card lists the Market's first purchases from their own
 *     catalogs (Santoku, Maple Board; never required) and the menu next;
 *  E  nothing paid changes: Levels 1–15's completion rewards and order,
 *     the knife and board unlock levels and prices;
 *  W  wiring: the bottom bar's locks, the Kitchen's places, the Market's
 *     browse-only look before L10, App's quiet day-end, Level Complete's
 *     Grandma line / opened sections / new day, the big Level 10 card;
 *  P  Grandma's pointer (developer 2026-10-10): a hand at each section while
 *     it's NEW, the earliest first, once (opened or "Later" →
 *     business.sectionsSeen); no money, stock or other save field moves.
 *
 * Run: npx tsx scripts/restaurant-first-levels-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import {
  FIRST_PURCHASE_LEVEL,
  GRANDMA_LINES,
  TAB_OPENS_AT,
  dayCeremonyAt,
  firstPurchaseRows,
  grandmaLineFor,
  grandmaTipFor,
  isTabNew,
  isTabOpen,
  lockedScreenHint,
  markSectionSeen,
  SECTION_POINTER,
  sectionToPoint,
  tabsOpeningAt,
} from "../src/game/restaurant/firstLevels.ts";
import {
  closeDay,
  openDay,
  recordService,
  restaurantDayOf,
} from "../src/game/restaurant/restaurantDay.ts";
import { servicesForDayAt } from "../src/game/restaurant/restaurantProgression.ts";
import { getLevel, getLevels } from "../src/game/levels/LevelManager.ts";
import { paidLevelReward } from "../src/game/levels/levelRewards.ts";
import { KNIFE_CATALOG } from "../src/game/knives/knifeDefinitions.ts";
import { BOARD_CATALOG } from "../src/game/boards/boardDefinitions.ts";
import { dollars } from "../src/game/money.ts";

let failures = 0;
function assert(cond: unknown, msg: string) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

console.log("T. Sections open one at a time");
{
  const at = (n: number) =>
    ["kitchen", "inventory", "shop", "rack", "business"].filter((id) => isTabOpen(id, n)).join();
  assert(
    at(1) === "kitchen" &&
      at(2) === "kitchen" &&
      at(3) === "kitchen,inventory" &&
      at(6) === "kitchen,inventory" &&
      at(7) === "kitchen,inventory,shop" &&
      at(10) === "kitchen,inventory,shop,rack" &&
      at(11) === "kitchen,inventory,shop,rack,business" &&
      at(250) === at(11),
    "T1: Kitchen from the start, Inventory L3, Market L7, Progress L10, Restaurant L11; all open after",
  );
  assert(
    tabsOpeningAt(3).join() === "inventory" &&
      tabsOpeningAt(7).join() === "shop" &&
      tabsOpeningAt(10).join() === "rack" &&
      tabsOpeningAt(11).join() === "business" &&
      tabsOpeningAt(4).length === 0 &&
      Object.values(TAB_OPENS_AT).every((n) => n <= 15),
    "T2: each section opens at exactly one level, all of them by Level 15",
  );
}

console.log("G. Grandma's lines");
{
  assert(
    Object.keys(GRANDMA_LINES).length === 15 &&
      Array.from({ length: 15 }, (_, i) => grandmaLineFor(i + 1)).every((l) => !!l) &&
      grandmaLineFor(1) === "There you go. Our first plate is back on the table." &&
      grandmaLineFor(10) === "Look at this place. We're really bringing it back." &&
      grandmaLineFor(15) === "A good kitchen starts with a well-stocked pantry." &&
      grandmaLineFor(16) === null &&
      grandmaLineFor(0) === null,
    "G1: one line for each of Levels 1–15 (the developer's words), none after",
  );
}

console.log("D. Quiet day-end before Level 21");
{
  const saveAt = (n: number): SaveData => ({
    ...DEFAULT_SAVE,
    credits: 123_456,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  });
  const finished = (n: number) => {
    let s = openDay(saveAt(n), n);
    for (let i = 0; i < servicesForDayAt(n).length; i++) s = recordService(s, n + i);
    return s;
  };
  const day = finished(9);
  const closed = closeDay(day, 11);
  assert(
    restaurantDayOf(day).closingDue &&
      !dayCeremonyAt(11) &&
      restaurantDayOf(closed).day === restaurantDayOf(day).day + 1 &&
      !restaurantDayOf(closed).closingDue &&
      closed.credits === day.credits &&
      closed.economyLedger.length === day.economyLedger.length &&
      JSON.stringify(closed.business.inventory) === JSON.stringify(day.business.inventory) &&
      JSON.stringify(closed.business.calendar) === JSON.stringify(day.business.calendar),
    "D1: the quiet close before Level 21 only turns the day (no money, ledger, stock or calendar change)",
  );
  assert(
    Array.from({ length: 20 }, (_, i) => dayCeremonyAt(i + 1)).every((v) => !v) &&
      dayCeremonyAt(21) &&
      dayCeremonyAt(250),
    "D2: the opening card and Closing Time show from Level 21 (fridge & freshness)",
  );
}

console.log("M. The Level 10 card");
{
  const rows = firstPurchaseRows();
  assert(
    FIRST_PURCHASE_LEVEL === 10 &&
      rows.some((r) => r.label === "🔪 Santoku" && r.value === "in the Market · $350.00") &&
      rows.some((r) => r.label === "🪵 Maple Board" && r.value === "in the Market · $300.00") &&
      rows.at(-1)?.value === "your first menu at Level 11",
    "M1: Santoku and Maple Board from their catalogs (prices unchanged), then the first menu",
  );
}

console.log("E. Nothing paid changes");
{
  // Snapshot taken from main before this pass (cents).
  const expected = [
    5000, 5200, 5500, 5800, 6100, 6400, 6800, 7200, 7600, 8000, 8000, 8300, 8600, 8900, 9200,
  ];
  const levels = getLevels().slice(0, 15);
  assert(
    levels.every((l, i) => l.id === `level-${i + 1}`) &&
      levels.every((l, i) => paidLevelReward(l) === expected[i]) &&
      getLevel("level-10")!.title === "Simple Garden Salad",
    "E1: Levels 1–15 keep their order and completion rewards",
  );
  const santoku = KNIFE_CATALOG.find((k) => k.name === "Santoku");
  const maple = BOARD_CATALOG.find((b) => b.name === "Maple Board");
  assert(
    santoku?.unlockLevel === 10 &&
      santoku.price === dollars(350) &&
      maple?.unlockLevel === 10 &&
      maple.price === dollars(300),
    "E2: the first knife and board unlock at Level 10 at their old prices",
  );
}

console.log("L. Locked links and Grandma's tips (developer 2026-10-09)");
{
  assert(
    lockedScreenHint("business-equipment", 3) === "🔒 Restaurant opens at Level 11" &&
      lockedScreenHint("shop-ingredients", 6) === "🔒 Market opens at Level 7" &&
      lockedScreenHint("inventory-supplies", 2) === "🔒 Inventory opens at Level 3" &&
      lockedScreenHint("rack", 9) === "🔒 Progress opens at Level 10" &&
      lockedScreenHint("business-equipment", 11) === null &&
      lockedScreenHint("kitchen-upgrades", 1) === null &&
      lockedScreenHint("gameplay", 1) === null &&
      lockedScreenHint("settings", 1) === null,
    "L1: every screen of a closed section is refused with when it opens (Restaurant → Equipment at L3 included); other screens never",
  );
  const tips = Array.from({ length: 15 }, (_, i) => [i + 1, grandmaTipFor(i + 1)] as const);
  assert(
    tips.every(([n, t]) => n === 9 || (!!t && t.text.length <= 70)) &&
      tips.every(([n, t]) => !t?.to || isTabOpen(t.to, n)) &&
      grandmaTipFor(3)?.to === "inventory" &&
      grandmaTipFor(7)?.to === "shop" &&
      grandmaTipFor(16) === null,
    "L2: a short tip for each of Levels 1–15 (L9's pointer is its own button); a tip's button only opens a section already open",
  );
  assert(
    isTabNew("inventory", 3) &&
      isTabNew("inventory", 4) &&
      !isTabNew("inventory", 5) &&
      !isTabNew("inventory", 2) &&
      !isTabNew("kitchen", 1),
    "L3: a section says NEW for its first two levels",
  );
}

console.log("W. Wiring");
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const router = read("src/ScreensRouter.tsx");
  const shop = read("src/components/kc/Shop.tsx");
  const app = read("src/App.tsx");
  const layer = read("src/components/kc/restaurant/ServiceCheckLayer.tsx");
  const banner = read("src/components/kc/story/MilestoneBanner.tsx");
  assert(
    /const reached = useContext\(NavLevelContext\);/.test(kitchen) &&
      /RESTAURANT_MODE && reached !== null && !isTabOpen\(n\.id, reached\)/.test(kitchen) &&
      /locked \? setHint\(`🔒 \$\{n\.label\} opens at Level \$\{opensAt\}`\) : go\(n\.id\)/.test(
        kitchen,
      ) &&
      /<NavLevelContext\.Provider value=\{restaurantLevelOf\(save\.levelProgress\)\}>/.test(router),
    "W1: a closed section shows a lock and its level, a tap says when it opens (restaurant build)",
  );
  assert(
    /opensAt=\{closedUntil\("rack"\)\}/.test(kitchen) &&
      /opensAt=\{closedUntil\("shop"\)\}/.test(kitchen) &&
      /if \(closedUntil\("rack"\) === null\) go\("rack"\);/.test(kitchen),
    "W2: the Kitchen's Progress and Market places (and the ranking card) wait for their level",
  );
  assert(
    /RESTAURANT_MODE && restaurantLevelOf\(save\.levelProgress\) < FIRST_PURCHASE_LEVEL/.test(
      shop,
    ) && /c\.id === "knives" \|\| c\.id === "boards"/.test(shop),
    "W3: before Level 10 the Market shows knives and boards to look at, nothing else",
  );
  assert(
    /if \(RESTAURANT_MODE && isFirstCompletion\) nextSave = quietDayEnd\(nextSave\);/.test(app) &&
      /grandmaLineFor\(n\)/.test(app) &&
      /tabsOpeningAt\(reachedNow\)/.test(app) &&
      /`☀️ Day \$\{levelRewardNotice\.newDay\} begins`/.test(app) &&
      /quote: levelRewardNotice\.grandma/.test(app) &&
      /storyEvent\.milestone\.bit === 1\s*\?\s*\{ grand: true, rows: firstPurchaseRows\(\)/.test(
        app,
      ) &&
      /opening=\{dayCeremonyAt\(n\) \? plan\.opening : null\}/.test(layer) &&
      /data-testid="banner-grandma"/.test(banner),
    "W4: Level Complete carries Grandma's line, the opened sections and the new day; Level 10's card is the big one",
  );
}

{
  const app = read("src/App.tsx");
  const inv = read("src/components/kc/inventory/InventoryScreen.tsx");
  const market = read("src/components/kc/MarketIngredients.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /lockedScreenHint\(s, restaurantLevelOf\(saveRef\.current\.levelProgress\)\)/.test(app) &&
      /const marketOpen = useTabOpen\("shop"\);/.test(inv) &&
      /onEquipment=\{restaurantOpen \? toEquipment : undefined\}/.test(inv) &&
      /onChangeSupplier && restaurantOpen/.test(market) &&
      /grandmaTipFor\(todayNumber\)/.test(kitchen) &&
      /isTabNew\(n\.id, reached\)/.test(kitchen),
    "W5: App.go refuses closed sections; Inventory / Market hide their links until they open; the Kitchen shows the tip and the NEW badge",
  );
}

console.log("P. Grandma's pointer at a new section (developer 2026-10-10)");
{
  const pointed = Array.from({ length: 15 }, (_, i) => sectionToPoint(i + 1, []));
  assert(
    pointed.join() === ",,inventory,inventory,,,shop,shop,,rack,rack,business,,," &&
      sectionToPoint(11, ["rack"]) === "business" &&
      sectionToPoint(3, ["inventory"]) === null &&
      sectionToPoint(40, []) === null &&
      (["inventory", "shop", "rack", "business"] as const).every(
        (t) => SECTION_POINTER[t].title.length <= 28 && SECTION_POINTER[t].line.length <= 80,
      ),
    "P1: each section is pointed at while it's NEW, the earliest unseen first (L11: Progress, then Restaurant); never once seen or on an old save",
    pointed,
  );
  const s: SaveData = {
    ...DEFAULT_SAVE,
    levelProgress: {
      currentLevelId: "level-7",
      highestUnlockedLevelId: "level-7",
      completedLevelIds: Array.from({ length: 6 }, (_, i) => `level-${i + 1}`),
    },
  };
  const once = markSectionSeen(s, "shop");
  const twice = markSectionSeen(once, "shop");
  const { sectionsSeen, ...rest } = once.business;
  assert(
    sectionsSeen?.join() === "shop" &&
      twice === once &&
      JSON.stringify(rest) === JSON.stringify(s.business) &&
      once.credits === s.credits &&
      once.economyLedger === s.economyLedger &&
      once.levelProgress === s.levelProgress,
    "P2: seeing a section records only business.sectionsSeen (once); no money, ledger, stock or progress",
  );
  const app = read("src/App.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  assert(
    /const seen = markSectionSeen\(saveRef\.current, section\);/.test(app) &&
      /screen === "kitchen" &&/.test(app) &&
      /data-testid="section-pointer"/.test(kitchen) &&
      /guide && active === "kitchen"/.test(kitchen),
    "P3: App records a section as seen when it's opened, points only on the Kitchen; the bottom bar draws the hand",
  );
}

console.log(failures ? `FIRST LEVELS QA: ${failures} FAILURE(S)` : "FIRST LEVELS QA: ALL PASS");
process.exit(failures ? 1 : 0);
