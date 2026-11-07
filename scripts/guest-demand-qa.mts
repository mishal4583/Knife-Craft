/**
 * GUEST DEMAND QA (Phase 8A + the hurried guests of 8B, developer 2026-11-01):
 *   D. Demand that scales with capacity (restaurant/guestDemand.ts, menuGuests.ts):
 *      - the floor never drops: at every level and in every kind of restaurant the guests (and the guests + the
 *        walk-in) are at least what the old timetable rule gave;
 *      - nothing before dine-in changes (the early game is untouched), and no guests where the timetable has none;
 *      - the pull is capped, its four parts read their own inputs (reputation, menu, rush hour, spotless);
 *      - served = min(wanted, capacity), turned away = the rest; a hire or a kitchen seat raises what is served;
 *      - deterministic, pure, no money and no random in the module; the queue the order engine builds has exactly
 *        the planned length.
 *   H. Hurried guests (serviceFlow.ts): never a level's own order, never before dine-in, about one in four, a
 *      shorter patience, fixed for a service.
 *
 * Run: npx tsx scripts/guest-demand-qa.mts
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
const { getLevel } = await import("../src/game/levels/LevelManager.ts");
const M = await import("../src/game/restaurant/menuGuests.ts");
const G = await import("../src/game/restaurant/guestDemand.ts");
const P = await import("../src/game/restaurant/restaurantProgression.ts");
const { kitchenGuestSeats } = await import("../src/game/restaurant/restaurantInvestments.ts");
const { SPECIALIST_CHEFS } = await import("../src/game/restaurant/staffRequirements.ts");
const { openDay } = await import("../src/game/restaurant/restaurantDay.ts");
const F = await import("../src/game/restaurant/serviceFlow.ts");
const { LEVELS } = await import("../src/game/levels/levelDefinitions.ts");

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

const ALL_ROLES = ["prep-cook", "line-cook", "server", "head-chef"] as const;
type Shape = {
  roles?: number;
  specialists?: boolean;
  pop?: number;
  spotless?: boolean;
  tiers?: string[];
};
const saveAt = (n: number, s: Shape = {}): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  levelProgress: {
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
  ownedKitchenUpgradeIds: s.tiers ?? [],
  business: {
    ...structuredClone(DEFAULT_SAVE.business),
    popularity: { score: s.pop ?? 50 },
    staff: {
      ...DEFAULT_SAVE.business.staff,
      hiredRoles: ALL_ROLES.slice(
        0,
        s.roles ?? 0,
      ) as unknown as typeof DEFAULT_SAVE.business.staff.hiredRoles,
    },
    restaurantStaff: {
      ...(DEFAULT_SAVE.business.restaurantStaff as object),
      specialists: s.specialists ? SPECIALIST_CHEFS.map((c) => c.id) : [],
    } as typeof DEFAULT_SAVE.business.restaurantStaff,
    ...(s.spotless
      ? {
          restaurantRecord: {
            services: 3,
            spotless: 3,
            streak: 2,
            bestStreak: 2,
            at: { covers: 0, takeaway: 0, packed: 0, washed: 0, broken: 0 },
            lastHygiene: null,
          },
        }
      : {}),
  },
});
const DINE_IN = Array.from({ length: LEVELS.length }, (_, i) => i + 1).find((n) =>
  P.isSystemLive("dine-in", n),
)!;
const shapes: Shape[] = [
  {},
  { roles: 2 },
  { roles: 4 },
  { roles: 4, specialists: true },
  { roles: 4, specialists: true, pop: 80, spotless: true },
  { roles: 1, pop: 65 },
];
const oldGuests = (s: SaveData, n: number) =>
  P.menuGuestsPerService(n) <= 0
    ? 0
    : Math.min(P.menuGuestsPerService(n) + kitchenGuestSeats(s), M.menuGuestCapacity(s));
const oldTotal = (s: SaveData, n: number) => {
  const g = oldGuests(s, n);
  const room = M.menuGuestCapacity(s) - g;
  return (
    g +
    (n >= M.WALK_IN_RULES.fromLevel ? Math.max(0, Math.min(M.WALK_IN_RULES.perService, room)) : 0)
  );
};

// ── D ────────────────────────────────────────────────────────────────────
{
  const bad: string[] = [];
  for (let n = 1; n <= LEVELS.length; n++)
    for (const [i, sh] of shapes.entries()) {
      const s = saveAt(n, sh);
      const g = M.menuGuestsFor(s, n);
      const t = g + M.walkInsFor(s, n);
      if (g < oldGuests(s, n) || t < oldTotal(s, n))
        bad.push(`L${n}/shape${i}: ${g}/${t} < ${oldGuests(s, n)}/${oldTotal(s, n)}`);
    }
  check(
    "D1 the floor never drops: at all 91 levels and 6 kinds of restaurant, guests (and guests + walk-in) are at least the old timetable's",
    bad.length === 0,
    bad.slice(0, 5),
  );
}
{
  const bad: string[] = [];
  for (let n = 1; n < DINE_IN; n++)
    for (const sh of shapes) {
      const s = saveAt(n, sh);
      if (G.guestPullFor(s, n).total !== 0 || M.menuGuestsFor(s, n) !== oldGuests(s, n))
        bad.push(`L${n}`);
    }
  check(
    `D2 nothing before dine-in (L${DINE_IN}) changes: no pull, the old guest count exactly`,
    bad.length === 0 && DINE_IN > 5,
    bad.slice(0, 5),
  );
}
{
  const bad: string[] = [];
  for (let n = 1; n <= LEVELS.length; n++)
    if (P.menuGuestsPerService(n) <= 0) {
      const s = saveAt(n, shapes[4]!);
      if (M.menuGuestsFor(s, n) !== 0 || G.guestPullFor(s, n).total !== 0) bad.push(`L${n}`);
    }
  check("D3 no guests (and no pull) where the timetable has none", bad.length === 0, bad);
}
{
  let max = 0;
  for (let n = DINE_IN; n <= LEVELS.length; n++) {
    const p = G.guestPullFor(
      openDay(saveAt(n, { roles: 4, specialists: true, pop: 100, spotless: true }), n),
      n,
    );
    max = Math.max(max, p.total);
    if (p.reputation > 2 || p.menu > 1 || p.hour > 1 || p.spotless > 1) max = 99;
  }
  check(
    "D4 the pull is capped: reputation ≤ 2, menu ≤ 1, hour ≤ 1, spotless ≤ 1, together ≤ GUEST_PULL_RULES.max",
    max <= G.GUEST_PULL_RULES.max && max >= 3,
    { max },
  );
}
{
  const n = Math.max(DINE_IN + 5, 60);
  const base = G.guestPullFor(saveAt(n, { roles: 4 }), n);
  const rep = (pop: number) => G.guestPullFor(saveAt(n, { roles: 4, pop }), n).reputation;
  check(
    "D5 reputation: 0 below 60, 1 at 60–74, 2 from 75",
    base.reputation === 0 && rep(59) === 0 && rep(60) === 1 && rep(74) === 1 && rep(75) === 2,
    [rep(59), rep(60), rep(74), rep(75)],
  );
  check(
    "D6 spotless: +1 only while the last service was spotless (the streak is on)",
    base.spotless === 0 && G.guestPullFor(saveAt(n, { spotless: true }), n).spotless === 1,
  );
  // The player chooses the menu from MENU_CHOICE_LEVEL on: five dishes left on is a small menu, it pulls nobody.
  const m = Math.max(n, P.MENU_CHOICE_LEVEL + 2);
  const { activeMenuDishes } = await import("../src/game/restaurant/restaurantMenu.ts");
  const full = saveAt(m, { roles: 4 });
  const small = saveAt(m, { roles: 4 });
  const ids = activeMenuDishes(full.business.menuActivation, m).map((d) => d.id);
  small.business.menuActivation = {
    inactiveDishIds: ids.slice(G.GUEST_PULL_RULES.menuDishes - 5),
  } as typeof small.business.menuActivation;
  check(
    "D7 menu: +1 with a big cookable menu, 0 with a small one",
    ids.length >= G.GUEST_PULL_RULES.menuDishes &&
      G.guestPullFor(full, m).menu === 1 &&
      G.guestPullFor(small, m).menu === 0,
    { dishes: ids.length },
  );
}
{
  // Rush hours: a day opened at `start` has Lunch/Dinner/…; the pull reads the meal of each service.
  const start = DINE_IN + 4;
  const opened = openDay(saveAt(start, { roles: 4 }), start);
  const names = P.servicesForDayAt(start);
  const rows = names.map((name, i) => ({
    name,
    hour: G.guestPullFor(opened, start + i).hour,
    said: G.serviceNameAt(opened, start + i),
  }));
  const ok = rows.every(
    (r) =>
      r.said === r.name && r.hour === (G.GUEST_PULL_RULES.rushServices.includes(r.name) ? 1 : 0),
  );
  check(
    "D8 rush hour: Lunch and Dinner bring +1, the other meals none; the meal comes from the open day",
    ok && rows.some((r) => r.hour === 1),
    rows,
  );
}
{
  const bad: string[] = [];
  for (const n of [DINE_IN, DINE_IN + 10, 55, 75, 91])
    for (const sh of shapes) {
      const s = saveAt(n, sh);
      const d = G.guestDemandFor(s, n, M.menuGuestCapacity(s));
      if (
        d.served !== Math.min(d.wanted, d.capacity) ||
        d.turnedAway !== d.wanted - d.served ||
        d.wanted !== d.base + d.seats + d.pull.total
      )
        bad.push(`L${n}`);
      const plan = M.serviceGuestPlan(s, n);
      if (plan.total !== plan.guests + plan.walkIns || plan.guests !== d.served)
        bad.push(`plan L${n}`);
    }
  check(
    "D9 served = min(wanted, capacity); turned away = the rest; wanted = timetable + seats + pull; the plan adds up",
    bad.length === 0,
    bad.slice(0, 5),
  );
}
{
  const n = 70;
  const served = [0, 1, 2, 3, 4].map((r) =>
    M.menuGuestsFor(saveAt(n, { roles: r, pop: 80, spotless: true }), n),
  );
  const monotone = served.every((v, i) => i === 0 || v >= served[i - 1]!);
  const thin = M.serviceGuestPlan(saveAt(n, { roles: 1, pop: 80, spotless: true }), n);
  const full = M.serviceGuestPlan(
    saveAt(n, { roles: 4, specialists: true, pop: 80, spotless: true }),
    n,
  );
  check(
    "D10 capacity is the limit and a hire raises what is served: guests grow with the team, a thin team turns guests away",
    monotone &&
      served[4]! > served[1]! &&
      thin.turnedAwayTotal > 0 &&
      full.turnedAwayTotal <= thin.turnedAwayTotal,
    { served, thin: thin.turnedAwayTotal, full: full.turnedAwayTotal },
  );
}
{
  const n = 75;
  const s = saveAt(n, { roles: 4, specialists: true, pop: 80, spotless: true });
  const level = getLevel(`level-${n}`)!;
  const a = JSON.stringify(M.serviceGuestPlan(s, n));
  const b = JSON.stringify(M.serviceGuestPlan(structuredClone(s), n));
  const q = M.menuGuestQueue(s, level).length;
  const w = M.walkInQueue(s, level).length;
  const sameLength =
    !!level.batchGroupRecipeIds?.length ||
    (q === M.menuGuestsFor(s, n) && w === M.walkInsFor(s, n));
  check(
    "D11 deterministic, and the queue the order engine builds has exactly the planned length",
    a === b && sameLength,
    { q, w },
  );
}
{
  const code = read("src/game/restaurant/guestDemand.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const staff = read("src/game/restaurant/staffRequirements.ts");
  check(
    "D12 pure: the module touches no wallet, ledger, save write or random, and the staff requirements still read the timetable alone",
    !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random|SaveManager\./.test(
      code,
    ) &&
      /menuGuestsPerService/.test(staff) &&
      !/guestDemand|menuGuestsFor/.test(staff),
  );
}

// ── H: hurried guests ────────────────────────────────────────────────────
{
  const orders = Array.from({ length: LEVELS.length }, (_, i) =>
    F.isHurried(i + 1, "order", 0),
  ).some(Boolean);
  const early = Array.from({ length: DINE_IN - 1 }, (_, i) => [
    F.isHurried(i + 1, "guest", 0),
    F.isHurried(i + 1, "walk-in", 0),
    F.isHurried(i + 1, "guest", 1),
  ])
    .flat()
    .some(Boolean);
  let hurried = 0;
  let total = 0;
  for (let n = DINE_IN; n <= LEVELS.length; n++)
    for (let i = 0; i < 4; i++) {
      total++;
      if (F.isHurried(n, "guest", i)) hurried++;
    }
  const share = hurried / total;
  check(
    "H1 a level's own order is never hurried, nothing before dine-in is, and about one guest in four after it",
    !orders && !early && share > 0.2 && share < 0.3,
    { share: +share.toFixed(3) },
  );
}
{
  const n = DINE_IN + 7;
  const input = {
    levelId: `level-${n}`,
    levelNumber: n,
    orders: 2,
    guests: 4,
    walkIns: 1,
    capacity: 6,
  };
  const a = F.arrivalSchedule(input);
  const b = F.arrivalSchedule(input);
  const pace = F.paceAt(n);
  const hurried = a.filter((x) => x.hurried);
  check(
    "H2 hurried guests have a shorter patience (×0.7), the level's orders never walk out, the schedule is fixed for a service",
    JSON.stringify(a) === JSON.stringify(b) &&
      a.filter((x) => x.kind === "order").every((x) => x.patienceMs === Infinity && !x.hurried) &&
      hurried.every(
        (x) => x.patienceMs === Math.round(pace.patienceMs * F.HURRIED_RULES.patienceFactor),
      ) &&
      a
        .filter((x) => !x.hurried && x.kind !== "order")
        .every((x) => x.patienceMs === pace.patienceMs) &&
      hurried.length > 0,
    { hurried: hurried.length },
  );
  const q = F.startQueue(a, n);
  check(
    "H3 the door shows who is hurried",
    F.doorView(q).faces.every((f) => typeof f.hurried === "boolean"),
  );
}
{
  const src = read("src/components/kc/game/Preparation.tsx");
  check(
    "H4 the floor marks a hurried guest with a ⏱️ on the door face",
    /f\.hurried \? "⏱️"/.test(src) && /data-hurried/.test(src),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
