/**
 * DINING FLOOR QA (Phase 9, developer 2026-11-01):
 *   F. The fridge: Commercial 100, Professional 240 (prices and the Basic 40 unchanged).
 *   T. Takeaway customers: the order rule that tags them, and that the floor now seats them alone (never in a party).
 *   W. A person carries the food: the waiter's walk from the pass, the Server's look, no flying plate.
 *   C. Wiping the table (cleanliness.wipeTable) and the closing tables task.
 *   H. Cleaners by the hour, three of them, one per area (cleanliness.hireHourlyCleaner).
 *   D. The dining side panel's offers (restaurant/diningHire.ts) and the Server from Level 3.
 *   A. The App / Preparation / ServiceFloor wiring, old saves.
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
  const p = SF.takeawayPath();
  check(
    "T4 the takeaway customer walks door → just inside the door and waits there (no table); the waiter hands over beside them",
    p[0]!.y > p[1]!.y &&
      p.at(-1)!.x === SF.TAKEAWAY_SPOT.x &&
      Math.hypot(
        SF.TAKEAWAY_STAND.x - SF.TAKEAWAY_SPOT.x,
        SF.TAKEAWAY_STAND.y - SF.TAKEAWAY_SPOT.y,
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

// ── H: cleaners by the hour ──────────────────────────────────────────────
{
  const n = Math.max(DINE_IN, CL.CLEANING_FROM_LEVEL + 1);
  const s0 = base();
  check(
    "H1 an hourly Cleaner costs one shift hour of the Cleaner's hourly wage ($15) — not the day's wage",
    CL.hourlyCleanerPrice() ===
      BUSINESS_STAFF_CATALOG.cleaner.hourlyWageCents * CL.HOURLY_CLEANER_HOURS &&
      CL.hourlyCleanerPrice() === 1500 &&
      CL.hourlyCleanerPrice() < CL.dayCleanerPrice(),
    { hourly: CL.hourlyCleanerPrice(), day: CL.dayCleanerPrice() },
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
  // Their round: only their area's routine tasks.
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
      left.every((a) => a !== "kitchen" || false) === true &&
      left.some((a) => a === "dining" || a === "restroom"),
    { cleaned: kitchen.ok ? kitchen.cleaned : null, left },
  );
  const gone = kitchen.ok ? CL.dismissHourlyCleaners(kitchen.save) : s0;
  check(
    "H6 the shift ends with the service: the hourly Cleaners leave (the same save otherwise)",
    CL.hourlyAreas(gone).length === 0 &&
      !CL.areaCovered(gone, "kitchen") &&
      CL.dismissHourlyCleaners(s0) === s0,
  );
  check(
    "H7 the Server or the Dining cleaner clears tables by themself: the Dining cleaner, or a hired Server; otherwise the player",
    CL.tableStaff(s0) === null &&
      CL.tableStaff(dining.ok ? dining.save : s0) === "cleaner" &&
      CL.tableStaff({
        ...s0,
        business: { ...s0.business, staff: { ...s0.business.staff, hiredRoles: ["server"] } },
      } as unknown as SaveData) === "server",
  );
  const mod = code("src/game/restaurant/cleanliness.ts");
  const hireFn = mod.slice(
    mod.indexOf("export function hireHourlyCleaner"),
    mod.indexOf("export function dismissHourlyCleaners"),
  );
  check(
    "H8 hiring is pure: the module function moves no money (App debits the wage with one ledger entry) and uses no random",
    !/debitWallet|appendLedgerEntry|Math\.random/.test(hireFn),
  );
}

// ── D: the dining side panel ─────────────────────────────────────────────
{
  const ids = (sv: SaveData, n: number) => DH.diningOffers(sv, n).map((o) => o.id);
  const s0 = base();
  check(
    "D1 the Server can be hired from Level 3 (hiring only: the staff RULE that needs a Server is unchanged), the cleaners from the level cleaning starts",
    SR.staffHireFrom("server") === 3 &&
      SR.SERVER_HIRE_FROM === 3 &&
      SR.staffHireFrom("prep-cook") === 30 &&
      SR.staffHireFrom("line-cook") === SR.STAFF_HIRE_FROM &&
      SR.STAFF_RULES.find((r) => r.role === "server")!.fromLevel > 30 &&
      !ids(s0, 2).includes("server") &&
      ids(s0, 3).includes("server") &&
      !ids(s0, 3).some((x) => x.startsWith("cleaner-")) &&
      ids(s0, CL.CLEANING_FROM_LEVEL).filter((x) => x.startsWith("cleaner-")).length === 3,
    { l3: ids(s0, 3), l5: ids(s0, 5) },
  );
  const offers = DH.diningOffers(s0, DINE_IN);
  check(
    "D2 the offers: the Server first (the hiring fee, once), then the three Cleaners at the hourly wage; affordable follows the wallet",
    offers[0]!.id === "server" &&
      offers[0]!.price === SR.staffHireFee("server") &&
      offers[0]!.per === "once" &&
      offers.slice(1).every((o) => o.per === "hour" && o.price === CL.hourlyCleanerPrice()) &&
      DH.diningOffers({ ...s0, credits: 0 }, DINE_IN).every((o) => !o.affordable) &&
      offers.every((o) => o.affordable),
    offers.map((o) => [o.id, o.price]),
  );
  const hiredServer = {
    ...s0,
    business: { ...s0.business, staff: { ...s0.business.staff, hiredRoles: ["server"] } },
  } as unknown as SaveData;
  const hiredKitchen = CL.hireHourlyCleaner(s0, "kitchen", DINE_IN);
  check(
    "D3 an offer is gone once the person is hired: no Server offer with a Server on the team, no kitchen offer with a kitchen Cleaner on shift",
    !ids(hiredServer, DINE_IN).includes("server") &&
      hiredKitchen.ok &&
      !ids(hiredKitchen.save, DINE_IN).includes("cleaner-kitchen") &&
      ids(hiredKitchen.save, DINE_IN).includes("cleaner-dining"),
  );
  check(
    "D4 the offer ids map to their area (a Server has none)",
    DH.areaOfOffer("server") === null &&
      DH.areaOfOffer("cleaner-dining") === "dining" &&
      DH.areaOfOffer("cleaner-restroom") === "restroom",
  );
  const hire = SR.hireRestaurantStaff(s0, "server", 3);
  check(
    "D5 the Server really can be hired at Level 3 (one hiring fee, the wallet pays it, the Server joins the team)",
    hire.ok &&
      hire.save.business.staff.hiredRoles.includes("server") &&
      hire.save.credits === s0.credits - SR.staffHireFee("server")!,
    hire.ok ? null : hire,
  );
  check("D6 …and not at Level 2", !SR.hireRestaurantStaff(s0, "server", 2).ok);
}

// ── A: wiring and old saves ──────────────────────────────────────────────
{
  const app = read("src/App.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  check(
    "A1 App: the hourly Cleaner is one wallet debit and one staff-purchase ledger entry; the shift ends with the service round; a wipe goes through cleanliness.wipeTable",
    /hireHourlyCleaner\(current/.test(app) &&
      /"staff-purchase",\s*-price,\s*`Cleaner · 1 hour/.test(app) &&
      /dismissHourlyCleaners\(round\.save\)/.test(app) &&
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
    "A3 Preparation: a takeaway customer is seated alone, the floor gets the waiter, the table wipe is offered after a party left; the player's wipe never blocks",
    /!!service\.takeaway,\s*\)/.test(prep) &&
      /waiter=\{service\.waiter \?\? "cook"\}/.test(prep) &&
      /data-testid="table-wipe"/.test(prep) &&
      /Wipe the table/.test(prep) &&
      /service\.tableWipe &&\s*!service\.takeaway/.test(prep),
  );
  check(
    "A4 ServiceFloor: the hire panel shows only before cooking, stops taps reaching the floor, and each offer is a 48 px+ button",
    /mode === "arrive" && hire && hire\.offers\.length > 0/.test(floor) &&
      /data-testid="dining-hire"/.test(floor) &&
      /e\.stopPropagation\(\)/.test(floor) &&
      /min-h-12/.test(floor),
  );
  const fl = code("src/game/restaurant/serviceFloor.ts");
  check(
    "A5 the floor modules stay pure: no wallet, ledger, save write or random in serviceFloor.ts or diningHire.ts",
    !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random|SaveManager\./.test(
      fl,
    ) &&
      !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random|SaveManager\./.test(
        code("src/game/restaurant/diningHire.ts"),
      ),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
