/**
 * PHASE 11 QA (developer 2026-11-01, the eight fixes; docs/planning/PHASE11-FIXES-AND-DAY2-CLEANING-PLAN-2026-11-01.md).
 *
 *   P. Grandma's pointers: the Market's alone before Level 1 is finished; every other waits until Level 2.
 *   H. The Business hub opens at Level 1, its pages keep their own levels; Cleanliness opens with cleaning (Day 2).
 *   C. The cash lies beside the party that paid (never on the other table), on every stage, party size and table;
 *      a swipe collects as well as a tap; the Served card has no Collect cash button.
 *   N. Next Customer waits for a dirty table that can be wiped, never for one that cannot (no soft-lock).
 *   S. The table is scrubbed in the cleaning game and wiped only when the game is finished.
 *   D. Cleaning from Day 2: the morning, the lull and the night have chores in all three areas at Levels 3-4.
 *
 * Run: npx tsx scripts/phase11-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const FL = await import("../src/game/restaurant/firstLevels.ts");
const { cashSpotBeside } = await import("../src/game/restaurant/tableCash.ts");
const SF = await import("../src/game/restaurant/serviceFloor.ts");
const CL = await import("../src/game/restaurant/cleanliness.ts");
const { CLEANING_FROM_LEVEL } = await import("../src/game/config/cleaningStart.ts");
const { RESTAURANT_MAP_ZONES: RESTAURANT_ZONES } =
  await import("../src/components/kc/restaurantMap/restaurantMapZones.ts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

// ── P. pointers ──────────────────────────────────────────────────────────
{
  check(
    "P1 before Level 1 is finished only the Market is pointed at; once it is seen, nothing until Level 2",
    FL.sectionToPoint(1, []) === "shop" && FL.sectionToPoint(1, ["shop"]) === null,
    { first: FL.sectionToPoint(1, []), second: FL.sectionToPoint(1, ["shop"]) },
  );
  check(
    "P2 from Level 2 (Level 1 finished) the Inventory pointer comes, then nothing more that is not open",
    FL.sectionToPoint(2, ["shop"]) === "inventory" &&
      FL.sectionToPoint(2, ["shop", "inventory"]) === null,
  );
  check(
    "P3 Business is pointed at only once it opens (Level 5) and never after Level 15",
    FL.sectionToPoint(4, ["shop", "inventory"]) === null &&
      FL.sectionToPoint(5, ["shop", "inventory"]) === "business" &&
      FL.sectionToPoint(16, []) === null,
  );
  const inventoryAt1 = FL.sectionToPoint(1, ["shop"]);
  check(
    "P4 the reported case: the Inventory pointer is not shown at Level 1",
    inventoryAt1 !== "inventory",
  );
}

// ── H. the Business hub ──────────────────────────────────────────────────
{
  check(
    "H1 the Business hub and its Kitchen button are open from Level 1",
    FL.isShortcutOpen("business", 1) && FL.lockedScreenHint("business", 1) === null,
  );
  check(
    "H2 the Business pages behind it keep their own level (Staff, Equipment, Menu … are still locked at Level 1)",
    [
      "business-staff",
      "business-refrigerator",
      "business-menu",
      "business-suppliers",
      "business-kitchen-upgrades",
    ].every((s) => FL.lockedScreenHint(s, 1) !== null && FL.lockedScreenHint(s, 4) !== null) &&
      FL.lockedScreenHint("business-staff", 5) === null,
  );
  check(
    "H3 the Cleanliness page opens with cleaning itself (Day 2), not with the Business section",
    FL.lockedScreenHint("business-cleanliness", CLEANING_FROM_LEVEL) === null &&
      FL.lockedScreenHint("business-cleanliness", 1) === null &&
      FL.TAB_OPENS_AT.business === 5,
  );
  const dash = read("src/components/kc/business/BusinessDashboard.tsx");
  check(
    "H4 the hub lists only the pages that are open (a locked page has no tab)",
    /lockedScreenHint\(BUSINESS_TAB_SCREEN\[t\.id\], level\)/.test(dash),
  );
  const kitchen = read("src/components/kc/Kitchen.tsx");
  check(
    "H5 the Kitchen's round Business button asks isShortcutOpen",
    /isShortcutOpen\(item\.id, reached\)/.test(kitchen),
  );
}

// ── C. the cash beside the party ─────────────────────────────────────────
{
  const stages = Object.keys(SF.FLOOR_SEATS) as (keyof typeof SF.FLOOR_SEATS)[];
  let ok = true;
  const bad: unknown[] = [];
  for (const stage of stages)
    for (const table of [0, 1] as const)
      for (const size of [1, 2, 3, 4]) {
        const mine = SF.FLOOR_SEATS[stage][table];
        const other = SF.FLOOR_SEATS[stage][table === 0 ? 1 : 0];
        const p = cashSpotBeside(stage, table, size);
        const dMine = Math.hypot(p.x - mine.seat.x, p.y - mine.seat.y);
        const dOther = Math.hypot(p.x - other.seat.x, p.y - other.seat.y);
        const inside = p.x > 3 && p.x < 97 && p.y > 3 && p.y < 97;
        if (!(inside && dMine < 16 && dMine < dOther)) {
          ok = false;
          bad.push({ stage, table, size, p, dMine, dOther });
        }
      }
  check(
    "C1 on every stage, table and party size the cash lies within reach of the party's own seats and nearer to them than to the other table",
    ok,
    bad[0],
  );
  const c = SF.takeawaySpot("humble");
  const t = cashSpotBeside("humble", 0, 1, true);
  check(
    "C2 a takeaway customer's cash lies at the counter beside them",
    Math.hypot(t.x - c.x, t.y - c.y) < 8,
    { t, c },
  );
  const tc = read("src/components/kc/common/TableCash.tsx");
  check(
    "C3 a swipe collects too (a pressed mouse or a finger over the pile), once per amount",
    /swipe/.test(tc) &&
      /addEventListener\("pointermove"/.test(tc) &&
      /e\.pointerType === "mouse" && \(e\.buttons & 1\) === 0/.test(tc) &&
      // a gesture on an overlay above the room (the scrubbing game) never collects the cash underneath
      /room\.contains\(e\.target\)/.test(tc) &&
      /done\.current = true/.test(tc),
  );
  const room = read("src/components/kc/game/DiningCashView.tsx");
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  check(
    "C4 both dining views place the pile with cashSpotBeside and allow a swipe; the room stops the page scrolling under a swipe",
    /cashSpotBeside/.test(room) &&
      /swipe/.test(room) &&
      /touch-none/.test(room) &&
      /cashSpotBeside/.test(floor) &&
      /swipe/.test(floor),
  );
  const soc = read("src/components/kc/game/ServiceOrderComplete.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  check(
    "C5 there is no Collect cash button on the Served card and no prop that drives one",
    !/Collect cash/.test(soc) && !/onCollectCash/.test(soc + prep),
  );
}

// ── N. Next Customer waits for the table ────────────────────────────────
{
  const soc = read("src/components/kc/game/ServiceOrderComplete.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  check(
    "N1 the card disables Next Customer and says why while a table waits; Auto waits too and nextOnce refuses",
    /blockNext\?: string/.test(soc) &&
      /disabled=\{!!blockNext\}/.test(soc) &&
      /data-testid="next-blocked"/.test(soc) &&
      /nextLatch\.current \|\| blockNext/.test(soc) &&
      /if \(blockNext\) return;/.test(soc),
  );
  check(
    "N2 it is passed only for a dirty table that CAN be wiped (a missing supply never blocks: no soft-lock)",
    /care && !care\.wiped && !care\.need/.test(prep) && /blockNext:/.test(prep),
  );
}

// ── S. the scrub game ────────────────────────────────────────────────────
{
  const prep = read("src/components/kc/game/Preparation.tsx");
  check(
    "S1 wiping a table opens the cleaning game for the dining room's tables; the table is wiped only when it is finished",
    /<AreaCleaningPrototype[\s\S]{0,200}area="dining"[\s\S]{0,60}task="tables"/.test(prep) &&
      /onComplete=\{\(\) => \{\s*setScrubbing\(false\);\s*wipeDone\(\);/.test(prep) &&
      /onClose=\{\(\) => setScrubbing\(false\)\}/.test(prep) &&
      /if \(service\.tableWipe\.scrub\) setScrubbing\(true\);\s*else wipeDone\(\);/.test(prep),
  );
  const app = read("src/App.tsx");
  check(
    "S2 App hands the game its room, art stage and a fresh dirt layout each time",
    /scrub: \{[\s\S]{0,400}cleanlinessRoomImageUrl\("dining"[\s\S]{0,200}cleaningVariant\(/.test(
      app,
    ),
  );
}

// ── D. cleaning from Day 2 ───────────────────────────────────────────────
{
  check(
    // Rule changed (developer 2026-11-08, the first-20-levels plan): Day 2 still opens at Level 3 (the day ceremony) but cleaning starts one level later, Level 4.
    "D1 cleaning starts at Level 4, the level after Day 2 opens (the day ceremony stays at Level 3; a day is two services)",
    CLEANING_FROM_LEVEL === 4 &&
      CL.isCleanlinessLive(4) &&
      !CL.isCleanlinessLive(3) &&
      FL.dayCeremonyAt(3) &&
      !FL.dayCeremonyAt(2),
  );
  const areaOf = (kinds: string[]) =>
    new Set(kinds.map((k) => CL.TASK_RULES[k as keyof typeof CL.TASK_RULES].area));
  // Rule changed (developer 2026-11-08): chores are staged by cause: the first cleaning level has the stations, one bucket and ONE closing chore (the boards);
  // the dining reset arrives with dine-in (Level 12 / 14) and the restroom at Level 16 (early-levels-qa A3 / the staged schedule in cleanliness.ts).
  const opening = CL.phaseChores("opening", 4);
  const lull = CL.phaseChores("lull", 4);
  const closingFirst = CL.phaseChores("closing", 4, 1);
  const openingLate = CL.phaseChores("opening", 16);
  const closing = CL.phaseChores("closing", 40, 1);
  check(
    "D2 the first cleaning level brings the stations, a bucket and ONE closing chore (the boards); from Level 16 the morning also checks the restroom; the full night (Level 40) has closing chores in the kitchen, the dining area AND the restroom",
    opening.length > 0 &&
      areaOf(opening).has("kitchen") &&
      lull.length > 0 &&
      areaOf(lull).has("kitchen") &&
      closingFirst.join() === "wipe-boards" &&
      areaOf(openingLate).has("restroom") &&
      ["kitchen", "dining", "restroom"].every((a) => areaOf(closing).has(a as never)),
    { opening, lull, closingFirst, openingLate, closing },
  );
  check(
    "D3 Levels 2 and 3 (before cleaning starts) have none of them",
    [2, 3].every(
      (n) =>
        CL.phaseChores("opening", n).length === 0 &&
        CL.phaseChores("lull", n).length === 0 &&
        CL.phaseChores("closing", n).length === 0,
    ),
  );
  const cleaning = RESTAURANT_ZONES.find((z: { id: string }) => z.id === "cleaning");
  const restroom = RESTAURANT_ZONES.find((z: { id: string }) => z.id === "restroom");
  check(
    "D4 the Cleaning and Restroom rooms on the map open with cleaning",
    cleaning?.unlockLevel === CLEANING_FROM_LEVEL && restroom?.unlockLevel === CLEANING_FROM_LEVEL,
    { cleaning: cleaning?.unlockLevel, restroom: restroom?.unlockLevel },
  );
  const s: SaveData = {
    ...DEFAULT_SAVE,
    levelProgress: {
      currentLevelId: "level-4",
      highestUnlockedLevelId: "level-4",
      completedLevelIds: ["level-1", "level-2", "level-3"],
      campaignVersion: 4,
    },
  };
  const after = CL.tasksAfterService(s, 4, {
    recipes: [],
    dineIn: 0,
    customers: 1,
  } as never);
  check(
    "D5 the first cleaning level's service leaves cleaning tasks behind (the service-time cleaning)",
    CL.cleanlinessOf(after).tasks.length > 0,
    CL.cleanlinessOf(after).tasks.map((t) => t.kind),
  );
}

// ── D6. the first cleaning morning looks at the restroom too ─────────────
{
  const base: SaveData = {
    ...DEFAULT_SAVE,
    levelProgress: {
      currentLevelId: "level-16",
      highestUnlockedLevelId: "level-16",
      completedLevelIds: Array.from({ length: 15 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
  };
  // The restroom arrives at Level 16 (2026-11-08 schedule): its first cleaning morning checks it; a morning after a done night does not repeat that.
  const first = CL.addPhaseChores(base, "opening", 16, 2, 0);
  const firstKinds = CL.cleanlinessOf(first).tasks.map((t) => t.kind);
  const later = {
    ...base,
    business: {
      ...base.business,
      cleanliness: { ...CL.cleanlinessOf(base), choreKeys: ["2:closing:2"] },
    },
  } as SaveData;
  const laterKinds = CL.cleanlinessOf(CL.addPhaseChores(later, "opening", 17, 3, 0)).tasks.map(
    (t) => t.kind,
  );
  check(
    "D6 the first cleaning morning brings the restroom check (no night pass has happened yet); a morning after a done night does not repeat it",
    firstKinds.includes("restroom-check") &&
      firstKinds.includes("stations") &&
      !laterKinds.includes("restroom-check") &&
      laterKinds.includes("stations"),
    { firstKinds, laterKinds },
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
