/**
 * DINING FLOOR QA (Phase 9, developer 2026-11-01):
 *   F. The fridge: Commercial 100, Professional 240 (prices and the Basic 40 unchanged).
 *   T. Takeaway customers: the order rule that tags them, and that the floor now seats them alone (never in a party).
 *   W. A person carries the food: the waiter's walk from the pass, the Server's look, no flying plate.
 *   C. Wiping the table (cleanliness.wipeTable) and the closing tables task.
 *   H. Cleaners by the hour (Phase 10): three, one per area, hired for the rest of today at a wage that grows, gone tomorrow.
 *   N. Table care from the first customer: a free wipe before supplies, the napkin refill every third table.
 *   D. The starting team (Server + Cashier, opening cash = $10 + their fees) and the map's cleaner slots.
 *   K. The Cashier: counts the till, stands at the counter, takeaway customers beside them.
 *   A/B. The App / Preparation / ServiceFloor wiring, the fixes of 2026-11-01.
 *
 * Run: npx tsx scripts/dining-floor-qa.mts
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
const { REFRIGERATOR_CATALOG } = await import("../src/game/business/refrigeratorDefinitions.ts");
const SS = await import("../src/game/restaurant/serviceSupplies.ts");
const SF = await import("../src/game/restaurant/serviceFloor.ts");
const CL = await import("../src/game/restaurant/cleanliness.ts");
const DH = await import("../src/game/restaurant/diningHire.ts");
const SR = await import("../src/game/restaurant/staffRequirements.ts");
const P = await import("../src/game/restaurant/restaurantProgression.ts");
const { BUSINESS_STAFF_CATALOG } = await import("../src/game/business/businessStaff.ts");
const { CAMPAIGN_RECIPES } = await import("../src/game/recipes/campaignRecipes.ts");
const { dollars } = await import("../src/game/money.ts");
const ST = await import("../src/game/config/startingTeam.ts");
const CC = await import("../src/game/restaurant/closingChores.ts");
const SL = await import("../src/game/restaurant/staffLife.ts");
const { openDay, recordService, restaurantDayOf } =
  await import("../src/game/restaurant/restaurantDay.ts");

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
const code = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

const DINE_IN = Array.from({ length: 148 }, (_, i) => i + 1).find((n) =>
  P.isSystemLive("dine-in", n),
)!;
const TAKEAWAY = Array.from({ length: 148 }, (_, i) => i + 1).find((n) =>
  P.isSystemLive("takeaway", n),
)!;
const stocked = (s: SaveData, units = 20): SaveData => ({
  ...s,
  business: {
    ...s.business,
    supplies: {
      ...s.business.supplies,
      stock: {
        ...s.business.supplies.stock,
        disinfectant: { units, costBasis: 100 },
        "sponges-cloths": { units, costBasis: 100 },
        "floor-cleaner": { units, costBasis: 100 },
        "bin-liners": { units, costBasis: 100 },
        brooms: { units: 1, costBasis: 100 },
        "mop-bucket": { units: 1, costBasis: 100 },
        "toilet-cleaner": { units, costBasis: 100 },
      },
    },
  },
});
const base = (credits = dollars(500)): SaveData =>
  stocked({ ...structuredClone(DEFAULT_SAVE), credits });

// ── F: the fridge ────────────────────────────────────────────────────────
{
  check(
    "F1 the fridge tiers: Basic 40, Commercial 100, Professional 240, prices unchanged (free / $2,000 / $4,800)",
    JSON.stringify(REFRIGERATOR_CATALOG.map((r) => [r.capacity, r.price])) ===
      JSON.stringify([
        [40, 0],
        [100, 200_000],
        [240, 480_000],
      ]),
    REFRIGERATOR_CATALOG.map((r) => [r.capacity, r.price]),
  );
}

// ── T: takeaway ──────────────────────────────────────────────────────────
{
  const recipe = CAMPAIGN_RECIPES[0]!;
  const before = Array.from({ length: Math.max(0, TAKEAWAY - 1) }, (_, i) =>
    SS.orderServiceFor(i + 1, 0, recipe),
  );
  const after: (string | null)[] = [];
  for (let n = TAKEAWAY; n <= 148; n++)
    for (let i = 0; i < 4; i++) after.push(SS.orderServiceFor(n, i, recipe));
  const share = after.filter((x) => x === "takeaway").length / after.length;
  const again =
    SS.orderServiceFor(TAKEAWAY + 3, 2, recipe) === SS.orderServiceFor(TAKEAWAY + 3, 2, recipe);
  check(
    "T1 verified: takeaway is a seeded tag (about 30 %) that starts at the takeaway stage; before it every order is dine-in (or none before dine-in)",
    before.every((x) => x === null || x === "dine-in") &&
      share > 0.2 &&
      share < 0.45 &&
      again &&
      TAKEAWAY > DINE_IN,
    { TAKEAWAY, DINE_IN, share },
  );
}
{
  SF.resetPartiesForTests();
  // Find a leader id whose party has 2+ places, so a takeaway between the two dine-in orders is a real test.
  let leader = "";
  for (let i = 0; i < 200 && !leader; i++)
    if (SF.partySizeFor(`lead-${i}`, 3) >= 2) leader = `lead-${i}`;
  const dish = { emoji: "🍝", name: "Pasta" };
  const a = SF.seatInParty(leader, "c1", dish, [dish, dish], 1000);
  const t = SF.seatInParty("take-1", "c2", dish, [], 1100, true);
  const b = SF.seatInParty("follow-1", "c3", dish, [], 1200);
  check(
    "T2 a takeaway customer is alone and never joins or replaces a seated party: the next dine-in order still joins the first party",
    a.party.size >= 2 &&
      t.party.size === 1 &&
      t.arriving &&
      t.leaving === null &&
      t.party !== a.party &&
      b.party === a.party &&
      b.arriving === false,
    { size: a.party.size },
  );
  SF.markPartyServed("take-1", "🍝", "🙂", 1300);
  SF.finishPartyDelivery("take-1", "🍝", "🙂", 1300);
  check(
    "T3 the takeaway customer leaves as soon as the bag is handed over (a party of one is complete)",
    SF.partyCompleteWith(t) && t.party.left,
  );
  SF.resetPartiesForTests();
}
{
  check(
    "T4 the takeaway customer has no table to walk to: they stand at the counter beside the Cashier (see K3), and the waiter hands the bag over right beside them when there is no Cashier",
    Math.hypot(
      SF.takeawayStand("humble").x - SF.takeawaySpot("humble").x,
      SF.takeawayStand("humble").y - SF.takeawaySpot("humble").y,
    ) < 8,
  );
}

// ── W: the waiter ────────────────────────────────────────────────────────
{
  const table = SF.FLOOR_SEATS.humble[0];
  const stand = SF.waiterStand(table);
  const path = SF.waiterPath(stand);
  check(
    "W1 the waiter walks from the pass to beside the table, sets the plate down, and the beat lasts the walk plus the set-down",
    path[0]!.x === SF.FLOOR_PASS.x &&
      path[0]!.y === SF.FLOOR_PASS.y &&
      path.at(-1) === stand &&
      SF.serveMs(stand) === SF.walkMs(path) + SF.SET_DOWN_MS &&
      SF.walkMs(path) > 500,
    { walk: SF.walkMs(path) },
  );
  check(
    "W2 the Server has their own look (apron colour), the cook is in whites",
    SF.WAITER_LOOKS.server.outfit !== SF.WAITER_LOOKS.cook.outfit &&
      SF.WAITER_LOOKS.cook.outfit === "#f4efe6",
  );
  const stands = (Object.values(SF.FLOOR_SEATS) as (typeof SF.FLOOR_SEATS)["humble"][]).flatMap(
    (pair) => pair.map((s) => SF.waiterStand(s)),
  );
  check(
    "W3 the waiter's stand is on the floor view at every stage and every seat",
    stands.every(
      (p) =>
        p.x > SF.FLOOR_VIEW.x0 &&
        p.x < SF.FLOOR_VIEW.x1 &&
        p.y > SF.FLOOR_VIEW.y0 &&
        p.y < SF.FLOOR_VIEW.y1,
    ),
  );
  const src = code("src/components/kc/game/ServiceFloor.tsx");
  check(
    "W4 no plate flies any more: the floor has the waiter layer, carries the plates, and shows them on the table only once set down",
    !/sfplate/.test(src) &&
      /service-floor-waiter/.test(src) &&
      /sf-carry/.test(src) &&
      /sfwout/.test(src) &&
      /sfwback/.test(src),
  );
}

// ── C: wiping the table ──────────────────────────────────────────────────
{
  const n = DINE_IN + 2;
  const s0 = base();
  const first = CL.wipeTable(s0, n, 2, "player");
  const usesBefore = CL.usesAvailable(s0, "disinfectant");
  const usesAfter = first.ok ? CL.usesAvailable(first.save, "disinfectant") : -1;
  const second = first.ok ? CL.wipeTable(first.save, n, 3, "staff") : first;
  const usesAfter2 = second.ok ? CL.usesAvailable(second.save, "disinfectant") : -2;
  check(
    "C1 the first wipe of a service takes the closing tables task's supplies once (a disinfectant use and a cloth use); the rest of that service's tables are free",
    first.ok &&
      second.ok &&
      usesBefore - usesAfter === 1 &&
      usesAfter2 === usesAfter &&
      CL.cleanlinessOf(second.save).wipes?.n === 5,
    { usesBefore, usesAfter, usesAfter2 },
  );
  const bare: SaveData = { ...structuredClone(DEFAULT_SAVE) };
  const short = CL.wipeTable(bare, n, 1, "player");
  check(
    "C2 with the supplies short nothing changes and it says what is needed (no block, no money)",
    !short.ok &&
      short.needs.length > 0 &&
      short.save === bare &&
      !CL.cleanlinessOf(short.save).wipes,
    short.ok ? null : short.needs,
  );
  const allWiped = first.ok ? CL.wipeTable(first.save, n, 2, "player") : first;
  const rec = CAMPAIGN_RECIPES[0]!;
  const kinds = (sv: SaveData) => CL.cleanlinessOf(sv).tasks.map((t) => t.kind);
  const after = (sv: SaveData, dineIn: number) =>
    CL.tasksAfterService(sv, n, { recipes: [rec], dineIn, customers: dineIn });
  const wipedAll = after(first.ok ? first.save : s0, 2); // wiped 2 guests, 2 covers
  const wipedSome = after(first.ok ? first.save : s0, 5); // wiped 2 of 5
  const none = after(s0, 2);
  const otherLevel = after(first.ok ? first.save : s0, 2);
  void allWiped;
  void otherLevel;
  check(
    "C3 every guest's table wiped on the floor: no closing 'tables' task; some left, or none wiped: the task is added as before",
    !kinds(wipedAll).includes("tables") &&
      kinds(wipedSome).includes("tables") &&
      kinds(none).includes("tables"),
    { wipedAll: kinds(wipedAll), wipedSome: kinds(wipedSome), none: kinds(none) },
  );
  const next = first.ok
    ? CL.tasksAfterService(first.save, n + 1, { recipes: [rec], dineIn: 2, customers: 2 })
    : s0;
  check(
    "C4 a wipe counts only for its own service: the next service's tables still get their closing task",
    CL.cleanlinessOf(next).tasks.some((t) => t.kind === "tables"),
  );
  const staffWipe = CL.wipeTable(s0, n, 1, "staff");
  check(
    "C5 a wipe by the Server or the Dining cleaner is counted as their work (byCleaner)",
    staffWipe.ok &&
      CL.cleanlinessOf(staffWipe.save).byCleaner === 1 &&
      CL.cleanlinessOf(first.ok ? first.save : s0).byCleaner === 0,
  );
  const old = structuredClone(DEFAULT_SAVE);
  check(
    "C6 an old save has no wipes and no hourly cleaners",
    !CL.cleanlinessOf(old).wipes && (CL.cleanlinessOf(old).hourly ?? []).length === 0,
  );
}

// ── T: two tables, a wipe only when no table is clean (developer 2026-11-02) ─────────────────────────────
{
  // "Show the wipe the table concept only when no table is free ... when both tables become used or dirty ask the player to wipe
  // it ... at night chores both the tables are wiped properly." The rule lives in Preparation (floorDone / wipeDone) on top of
  // serviceFloor's dirty-table memory; here the same rule is replayed on the real functions.
  const n = DINE_IN + 4;
  const rec = CAMPAIGN_RECIPES[0]!;
  const play = (sizes: number[]) => {
    SF.resetSeatsForTests();
    let sv = base();
    const asks: boolean[] = [];
    const tables: number[] = [];
    let wiped = 0;
    sizes.forEach((size, i) => {
      const table = SF.seatForOrder(`order-${i}`);
      tables.push(table);
      SF.markTableDirty(table); // the party leaves: its table is dirty
      const ask = SF.cleanTableCount() === 0; // ask only when no table is clean
      asks.push(ask);
      if (ask) {
        const w = CL.wipeTable(sv, n, size, "player");
        if (w.ok) {
          sv = w.save;
          wiped += size;
          SF.markTableClean(SF.nextTable());
        }
      }
    });
    return { sv, asks, tables, wiped, total: sizes.reduce((a, b) => a + b, 0) };
  };
  const one = play([2]);
  check(
    "T1 one customer: one table dirty, the other still free: the player is NOT asked to wipe",
    one.asks.join() === "false" && SF.cleanTableCount() === 1,
    one.asks,
  );
  const four = play([1, 3, 2, 4]);
  check(
    "T2 the first customer leaves a free table (no wipe); from the second on both tables are dirty, so the player is asked each time",
    four.asks.join() === "false,true,true,true",
    four.asks,
  );
  check(
    "T3 the next customer sits at a clean table: the two tables alternate, and a wiped table is the one used next",
    four.tables.join() === "0,1,0,1" &&
      four.tables.every((t, i) => i === 0 || t !== four.tables[i - 1]),
    four.tables,
  );
  const closing = CL.tasksAfterService(four.sv, n, {
    recipes: [rec],
    dineIn: four.total,
    customers: four.total,
  });
  check(
    "T4 the tables left dirty (never both wiped during the service) are the closing chore: the 'tables' task is added, so tonight both tables are wiped properly",
    four.wiped < four.total && CL.cleanlinessOf(closing).tasks.some((t) => t.kind === "tables"),
    { wiped: four.wiped, total: four.total },
  );
  for (const sizes of [[1], [2, 2], [1, 1, 1], [4, 1, 3, 2, 1, 1]]) {
    const r = play(sizes);
    const c = CL.tasksAfterService(r.sv, n, {
      recipes: [rec],
      dineIn: r.total,
      customers: r.total,
    });
    if (!(r.wiped < r.total) || !CL.cleanlinessOf(c).tasks.some((t) => t.kind === "tables")) {
      check("T5 every service shape leaves the closing 'tables' chore", false, sizes);
    }
  }
  check(
    "T5 every service shape ([1], [2,2], [1,1,1], six parties) leaves the closing 'tables' chore",
    true,
  );
  SF.resetParties();
  check("T6 a new service starts with both tables clean", SF.cleanTableCount() === 2);
  const src = fs.readFileSync(
    path.resolve(import.meta.dirname, "../src/components/kc/game/Preparation.tsx"),
    "utf8",
  );
  check(
    "T7 wiring: a leaving party only dirties its table and the wipe is offered only when no table is clean; a wipe cleans the next party's table",
    /markTableDirty\(partySeat\.party\.table\);\s*setCare\(cleanTableCount\(\) > 0 \? null : \{ wiped: false \}\)/.test(
      src,
    ) && /markTableClean\(nextTable\(\)\)/.test(src),
  );
}

// ── H: cleaners by the hour (Phase 10: the rest of today, the wage grows, gone tomorrow) ────────────────
{
  const n = Math.max(DINE_IN, CL.CLEANING_FROM_LEVEL + 1);
  const s0 = base();
  check(
    "H1 an hourly Cleaner costs the hourly wage for each hour left today: $15 an hour at the start, more as the restaurant progresses",
    CL.hourlyCleanerWage(1) === 1500,
    CL.hourlyCleanerWage(1),
  );
  check(
    "H1b the wage grows with the restaurant (never falls), about doubling by the last service",
    CL.hourlyCleanerWage(148) > CL.hourlyCleanerWage(74) &&
      CL.hourlyCleanerWage(74) > CL.hourlyCleanerWage(1) &&
      CL.hourlyCleanerWage(148) / CL.hourlyCleanerWage(1) > 1.8 &&
      CL.hourlyCleanerWage(148) % 50 === 0,
    [CL.hourlyCleanerWage(1), CL.hourlyCleanerWage(74), CL.hourlyCleanerWage(148)],
  );
  const hoursFresh = CL.hoursLeftToday(s0, n);
  const opened = openDay(s0, n);
  const afterOne = recordService(opened, n);
  check(
    "H1c the price is the wage × the hours (services) left today: a fresh day has the whole day, each finished service takes one hour off, never below 1",
    hoursFresh === P.servicesForDayAt(n).length &&
      CL.hoursLeftToday(afterOne, n) === Math.max(1, hoursFresh - 1) &&
      CL.hourlyCleanerPrice(s0, n) === CL.hourlyCleanerWage(n) * hoursFresh &&
      CL.hoursLeftToday(s0, n) >= 1,
    { hoursFresh },
  );
  const dining = CL.hireHourlyCleaner(s0, "dining", n);
  check(
    "H2 hiring one for an area puts only that area on shift; the other two areas stay open for their own Cleaners",
    dining.ok &&
      CL.areaCovered(dining.save, "dining") &&
      !CL.areaCovered(dining.save, "kitchen") &&
      !CL.areaCovered(dining.save, "restroom"),
  );
  const three = (() => {
    let sv = s0;
    for (const a of CL.CLEAN_AREAS) {
      const r = CL.hireHourlyCleaner(sv, a, n);
      if (!r.ok) return null;
      sv = r.save;
    }
    return sv;
  })();
  check(
    "H3 three Cleaners can work at once, one for each of the three areas",
    !!three && CL.hourlyAreas(three).length === 3 && CL.CLEAN_AREAS.length === 3,
  );
  check(
    "H4 the same area cannot be hired twice, nothing is hired before cleaning starts, and a permanent Cleaner already covers their areas",
    !CL.hireHourlyCleaner(dining.ok ? dining.save : s0, "dining", n).ok &&
      (CL.hireHourlyCleaner(s0, "kitchen", CL.CLEANING_FROM_LEVEL - 1) as { reason?: string })
        .reason === "locked" &&
      (() => {
        const perm = {
          ...s0,
          business: { ...s0.business, staff: { ...s0.business.staff, hiredRoles: ["cleaner"] } },
        } as unknown as SaveData;
        const r = CL.hireHourlyCleaner(perm, "kitchen", n);
        return !r.ok && r.reason === "covered";
      })(),
  );
  const withTasks = CL.tasksAfterService(s0, n, {
    recipes: [CAMPAIGN_RECIPES[0]!],
    dineIn: 2,
    customers: 2,
  });
  const kitchen = CL.hireHourlyCleaner(withTasks, "kitchen", n);
  const left = kitchen.ok
    ? CL.cleanlinessOf(kitchen.save).tasks.map((t) => CL.TASK_RULES[t.kind].area)
    : [];
  check(
    "H5 the kitchen Cleaner cleans the kitchen's routine tasks at once and leaves the dining room and the restroom alone",
    kitchen.ok &&
      kitchen.cleaned.length > 0 &&
      kitchen.cleaned.every((k) => CL.TASK_RULES[k].area === "kitchen") &&
      left.some((a) => a === "dining" || a === "restroom"),
    { cleaned: kitchen.ok ? kitchen.cleaned : null, left },
  );
  // They stay all day (through every service) and are gone the next day: hire again.
  const nextDay = (sv: SaveData): SaveData => ({
    ...sv,
    business: {
      ...sv.business,
      restaurantDay: { ...restaurantDayOf(sv), day: restaurantDayOf(sv).day + 1 },
    },
  });
  const hired = kitchen.ok ? kitchen.save : s0;
  check(
    "H6 hired for the rest of today: still on shift after a service; the next day they are gone and must be hired again",
    CL.areaCovered(hired, "kitchen") &&
      CL.areaCovered(recordService(openDay(hired, n), n), "kitchen") &&
      !CL.areaCovered(nextDay(hired), "kitchen") &&
      CL.hireHourlyCleaner(nextDay(hired), "kitchen", n).ok,
  );
  // Review fix (2026-11-01): `hourly` stays in the save after the day ends; the team's round must not use it.
  const tomorrow = CL.tasksAfterService(nextDay(hired), n, {
    recipes: [CAMPAIGN_RECIPES[0]!],
    dineIn: 2,
    customers: 2,
  });
  const round = CL.cleanerRound(tomorrow);
  check(
    "H6b yesterday's hourly Cleaner does not keep cleaning for free: the team's round on the next day cleans nothing in their area",
    CL.cleanlinessOf(tomorrow).tasks.some((t) => CL.TASK_RULES[t.kind].area === "kitchen") &&
      round.cleaned.every((k) => CL.TASK_RULES[k].area !== "kitchen"),
    { cleaned: round.cleaned },
  );
  check(
    "H7 only a Cleaner on the dining room clears tables by themself; a Server does not (the player cleans), otherwise the player",
    CL.tableStaff(s0) === null &&
      CL.tableStaff(dining.ok ? dining.save : s0) === "cleaner" &&
      CL.tableStaff({
        ...s0,
        business: {
          ...s0.business,
          staff: { ...s0.business.staff, hiredRoles: ["server", "cashier"] },
        },
      } as unknown as SaveData) === null,
  );
  const mod = code("src/game/restaurant/cleanliness.ts");
  const hireFn = mod.slice(
    mod.indexOf("export function hireHourlyCleaner"),
    mod.indexOf("export function tableStaff"),
  );
  check(
    "H8 hiring is pure: the module function moves no money (App debits the wage with one ledger entry) and uses no random",
    !/debitWallet|appendLedgerEntry|Math\.random/.test(hireFn),
  );
}

// ── N: table care from the first customer, napkins ──────────────────────
{
  const s0 = base();
  const free = CL.wipeTable({ ...structuredClone(DEFAULT_SAVE) }, 1, 1, "player");
  check(
    "N1 from the first customer a table can be wiped: before cleaning supplies exist (Level 5) it is just a cloth, free, and still counts",
    free.ok &&
      CL.cleanlinessOf(free.save).wipes?.n === 1 &&
      CL.cleanlinessOf(free.save).cleaned === 1,
  );
  let sv = s0;
  const marks: boolean[] = [];
  for (let i = 0; i < CL.TISSUE_EVERY; i++) {
    const r = CL.wipeTable(sv, 10 + i, 1, "player");
    if (!r.ok) break;
    sv = r.save;
    marks.push(CL.napkinsLow(sv));
  }
  check(
    "N2 the napkin holders run low after every third wiped table, and one refill tap fills them (no extra supply)",
    CL.TISSUE_EVERY === 3 &&
      marks.length === 3 &&
      !marks[0] &&
      !marks[1] &&
      marks[2] &&
      !CL.napkinsLow(CL.refillNapkins(sv)) &&
      CL.refillNapkins(s0) === s0,
    marks,
  );
}

// ── D: the starting team and the cleaner slots ──────────────────────────
{
  const TEAM = ["server", "cashier"] as const;
  const fresh = structuredClone(DEFAULT_SAVE);
  const fees = TEAM.map((r) => SR.staffHireFee(r)!);
  check(
    "D1 a new game starts with $10.00 for the food plus exactly the Server's and the Cashier's hiring fees (config/startingTeam.ts mirrors staffHireFee)",
    ST.STARTING_FOOD_CASH === dollars(10) &&
      ST.STARTING_TEAM_FEES === fees[0]! + fees[1]! &&
      ST.STARTING_CASH === dollars(10) + fees[0]! + fees[1]! &&
      DEFAULT_SAVE.credits === ST.STARTING_CASH &&
      fees.every((f) => f > 0),
    { start: DEFAULT_SAVE.credits, fees },
  );
  check(
    // Rule changed (developer 2026-11-02): the Server and the Cashier are also REQUIRED from the first service (staff-hire / progression QA).
    // Rule changed (developer 2026-11-07): "hire them when the game needs them" - the first service offers both inside it
    // (serviceHire.ts); from the second service the Pre-Service Check requires them.
    "D2 the Server and the Cashier can be hired from Level 1 (and a service needs both from Level 2), the Prep Cook still at 30",
    SR.TEAM_HIRE_FROM === 1 &&
      SR.staffHireFrom("server") === 1 &&
      SR.staffHireFrom("cashier") === 1 &&
      SR.staffHireFrom("prep-cook") === 30 &&
      SR.staffHireFrom("line-cook") === SR.STAFF_HIRE_FROM &&
      SR.STAFF_RULES.find((r) => r.role === "server")!.fromLevel === 2 &&
      SR.STAFF_RULES.find((r) => r.role === "cashier")!.fromLevel === 2,
  );
  const offers = DH.teamOffers(fresh, 1);
  check(
    "D3 the first shop's Hire your team card: the Server then the Cashier, each at its fee, both affordable from the opening cash",
    offers.map((o) => o.role).join() === "server,cashier" &&
      offers.every((o) => o.affordable && o.fee === SR.staffHireFee(o.role)) &&
      fresh.credits >= ST.STARTING_TEAM_FEES,
    offers.map((o) => [o.role, o.fee]),
  );
  const both = TEAM.reduce<SaveData>((sv, r) => {
    const h = SR.hireRestaurantStaff(sv, r, 1);
    return h.ok ? h.save : sv;
  }, fresh);
  check(
    "D4 hiring both takes exactly their two fees from the opening cash (the $10 for food is left), puts them on the team for good, and the card is gone",
    both.business.staff.hiredRoles.includes("server") &&
      both.business.staff.hiredRoles.includes("cashier") &&
      both.credits === dollars(10) &&
      DH.teamOffers(both, 1).length === 0 &&
      DH.teamOffers({ ...fresh, credits: 0 }, 1).every((o) => !o.affordable),
    both.credits,
  );
  const slots = DH.cleanerSlots(base(), DINE_IN);
  check(
    "D5 the map's cleaner slots: the three areas from the level cleaning starts (none before), priced wage × hours, not on shift until hired",
    DH.cleanerSlots(base(), CL.CLEANING_FROM_LEVEL - 1).length === 0 &&
      slots.map((s) => s.area).join() === CL.CLEAN_AREAS.join() &&
      slots.every((s) => s.price === s.wage * s.hours && !s.onShift && s.affordable),
    slots.map((s) => [s.area, s.price]),
  );
  const k = CL.hireHourlyCleaner(base(), "kitchen", DINE_IN);
  check(
    "D6 a slot shows 'on shift' once hired and cannot be bought again",
    k.ok &&
      DH.cleanerSlots(k.save, DINE_IN).find((s) => s.area === "kitchen")!.onShift &&
      !DH.cleanerSlots(k.save, DINE_IN).find((s) => s.area === "dining")!.onShift,
  );
}

// ── K: the Cashier ──────────────────────────────────────────────────────
{
  const withCashier = (sv: SaveData, on: boolean): SaveData =>
    ({
      ...sv,
      business: {
        ...sv.business,
        staff: { ...sv.business.staff, hiredRoles: on ? ["cashier"] : [] },
      },
    }) as unknown as SaveData;
  const rowOf = (sv: SaveData) => CC.closingRows(sv, 30).find((r) => r.id === "count")!;
  check(
    "K1 the Cashier counts the till at night: with one on the team the closing 'count the takings' row is done for you, without one it is the player's tap",
    rowOf(withCashier(base(), true)).state === "done" &&
      /Cashier/.test(rowOf(withCashier(base(), true)).label) &&
      rowOf(withCashier(base(), false)).state === "todo",
  );
  const cast = (hired: string[]) => SL.staffCast(hired).map((a) => a.id);
  check(
    "K2 the counter's cashier is shown when a Cashier is hired (not by the Server); the Server is shown separately",
    cast(["cashier"]).includes("service-cashier") &&
      !cast(["server"]).includes("service-cashier") &&
      cast(["server"]).includes("staff-server"),
  );
  const stage = "humble" as const;
  const c = SF.cashierSpot(stage);
  const t = SF.takeawaySpot(stage);
  check(
    "K3 a takeaway customer stands right beside the Cashier, in front of the counter, on every stage and inside the floor view",
    (Object.keys(SF.COUNTER_SPOT) as (keyof typeof SF.COUNTER_SPOT)[]).every((st) => {
      const a = SF.cashierSpot(st);
      const b = SF.takeawaySpot(st);
      return (
        b.x > a.x &&
        b.x - a.x < 9 &&
        b.y >= a.y &&
        b.y - a.y < 3 &&
        b.x < SF.FLOOR_VIEW.x1 &&
        b.y > SF.FLOOR_VIEW.y0 &&
        a.y > SF.FLOOR_VIEW.y0
      );
    }) && t.x > c.x,
  );
  const stands = Object.keys(SF.COUNTER_SPOT).map((st) =>
    SF.takeawayStand(st as keyof typeof SF.COUNTER_SPOT),
  );
  check(
    "K4 with a Cashier the bag changes hands at the counter (a short beat, nobody walks); the cashier positions match the staff map's counter",
    SF.BAG_MS > 0 &&
      SF.BAG_MS < SF.serveMs(stands[0]!) &&
      (Object.keys(SF.COUNTER_SPOT) as (keyof typeof SF.COUNTER_SPOT)[]).every((st) => {
        const cs = SL.cashierStops(st)[0]!;
        return (
          Math.abs(cs.x - SF.cashierSpot(st).x) < 0.01 &&
          Math.abs(cs.y - SF.cashierSpot(st).y) < 0.01
        );
      }),
  );
}

// ── A: wiring ───────────────────────────────────────────────────────────
{
  const app = read("src/App.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  check(
    "A1 App: the hourly Cleaner is one wallet debit and one staff-purchase ledger entry for the hours left; no end-of-service dismissal; a wipe goes through cleanliness.wipeTable",
    /hireHourlyCleaner\(current, area, level\)/.test(app) &&
      /hourlyCleanerPrice\(current, level\)/.test(app) &&
      /"staff-purchase",\s*-price,\s*`Cleaner · rest of the day/.test(app) &&
      !/dismissHourlyCleaners/.test(app) &&
      /wipeTable\(current, levelNumber\(campaignServiceSession\.levelId\), guests, by\)/.test(app),
  );
  check(
    "A2 App: takeaway orders use the supplies' own rule (orderServiceFor) and are kept out of the parties, the shared plates and the held plates",
    /const takeawayAt = /.test(app) &&
      /orderServiceFor\(levelNumber\(campaignLevelForSession\.id\), paid \+ offset, recipe\)/.test(
        app,
      ) &&
      /\.filter\(\(_, j\) => !takeawayAt\(j \+ 1\)\)/.test(app) &&
      /if \(takeawayAt\(0\)\) return 0;/.test(app) &&
      /\.\.\.\(currentTakeaway \? \{ takeaway: true \} : \{\}\)/.test(app),
  );
  check(
    "A3 Preparation: a takeaway customer is seated alone, the floor gets the waiter and the cashier, the table care shows after a party left (from the first customer, not only dine-in)",
    /!!service\.takeaway,\s*\)/.test(prep) &&
      /waiter=\{service\.waiter \?\? "cook"\}/.test(prep) &&
      /cashier=\{!!service\.cashier\}/.test(prep) &&
      /data-testid="table-wipe"/.test(prep) &&
      /Refill the napkins/.test(prep) &&
      /service\.tableWipe &&\s*!service\.takeaway/.test(prep) &&
      !/isSystemLive\("dine-in", levelNumber\(campaignLevelForSession\.id\)\)\s*\?\s*\{\s*tableWipe/.test(
        app,
      ),
  );
  check(
    "A4 the dining floor has no hire panel any more (the cleaners are on the map, the team in the first shop)",
    !/dining-hire/.test(floor) && !/data-hire/.test(floor) && !/hire\.offers/.test(floor),
  );
  const router = read("src/ScreensRouter.tsx");
  const map = read("src/components/kc/restaurantMap/MapCleanerHire.tsx");
  const market = read("src/components/kc/MarketIngredients.tsx");
  check(
    "A5 the map has the small cleaner button (a tray of three areas), the Market has the Hire your team card, and neither is on the Cleanliness page",
    /<MapCleanerHire/.test(router) &&
      /map-cleaners-button/.test(map) &&
      /<TeamHireCard/.test(market) &&
      !/hireHourlyCleaner|MapCleanerHire|TeamHireCard/.test(
        read("src/components/kc/business/BusinessCleanliness.tsx"),
      ),
  );
  const fl = code("src/game/restaurant/serviceFloor.ts");
  check(
    "A6 the floor modules stay pure: no wallet, ledger, save write or random in serviceFloor.ts or diningHire.ts",
    !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random|SaveManager\./.test(
      fl,
    ) &&
      !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random|SaveManager\./.test(
        code("src/game/restaurant/diningHire.ts"),
      ),
  );
}

// ── B: the cash on the table, the chore row, the Cleanliness page (developer 2026-11-01 fixes) ──
{
  const soc = read("src/components/kc/game/ServiceOrderComplete.tsx");
  const room = read("src/components/kc/game/DiningCashView.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  check(
    // Rule changed (developer 2026-11-01): no Collect cash button; a tap or a swipe on the pile collects it.
    "B1 the Served card sits under the dining room with the cash beside the party: a tap or a swipe on the pile collects it (no button); the dirty table and the napkins are tappable there too, and the card makes the bill",
    /room\?: ReactNode/.test(soc) &&
      /served && room/.test(soc) &&
      /bill-line/.test(soc) &&
      /<TableCash/.test(room) &&
      /Tap or swipe the cash/.test(room) &&
      /swipe/.test(room) &&
      !/Collect cash/.test(soc) &&
      /data-testid="dirty-table"/.test(room) &&
      /data-testid="napkins-low"/.test(room) &&
      /onCollect=\{collectTableCash\}/.test(prep),
  );
  const chores = read("src/components/kc/restaurant/ShiftChecklist.tsx");
  check(
    "B2 the chore row keeps its name readable: the label has a minimum width so a long Buy button wraps under it",
    /flex-\[1_1_9rem\]/.test(chores) && /max-w-full/.test(chores),
  );
  const cl = read("src/components/kc/business/BusinessCleanliness.tsx");
  const iReady = cl.indexOf("<ReadyCard");
  const iAreas = cl.indexOf("{areas.map((v)");
  const iDay = cl.indexOf("<DayCleanerCard");
  const iStaff = cl.indexOf("<StaffCard");
  const iHist = cl.indexOf("<HistoryCard");
  check(
    "B3 Cleanliness: the Hire a Cleaner offers are the LAST cards (after the areas, supplies and history), worded as optional",
    iReady < iAreas &&
      iAreas < iHist &&
      iHist < iStaff &&
      iStaff < iDay &&
      /Not in the mood to clean\?/.test(cl),
    { iReady, iAreas, iHist, iStaff, iDay },
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
