/**
 * CAR PARK QA (developer 2026-11-15: the guests' cars and the neighbour's share one lot; tap a clear vehicle and it drives out).
 * business/carPark.ts.
 *
 *  A  Every lot is solvable BY CONSTRUCTION: 500 seeds per tier, each solved by the real solver, no overlap, in bounds, the vehicle count
 *     of the tier, few vehicles free at the start and a long enough chain (the difficulty), the same seed is the same lot, some vehicles
 *     are the neighbour's (grey / white), and one lot takes well under a second.
 *  B  The moves: a blocked vehicle does not leave, a free one does, a tow removes any one vehicle and the lot stays solvable.
 *  C  Stars: 0 honks 3, 1 honk 2, 2 honks 1, a tow costs one star (a cleared lot keeps at least one), 3 honks 0.
 *  D  The routine and the save: locked below Level 15, the last step of the day, once a business day, the Prep Cook only from Level 30 and
 *     with no stars, and a round moves no money, no stock and no ledger entry.
 *
 * Run: npx tsx scripts/car-park-qa.mts   (CARPARK_QA_SEEDS=50 for a quick run)
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE } from "../src/game/SaveManager.ts";
import { flowSteps, PREP_COOK_STEPS } from "../src/game/business/deliveryFlow.ts";
import {
  CAR_PARK_FIRST_LEVEL,
  CAR_PARK_PREP_COOK_LEVEL,
  CAR_PARK_STRIKES,
  CAR_PARK_TIERS,
  autoCarPark,
  blockersFor,
  canLeave,
  canPrepCookClearCarPark,
  carParkDue,
  finishCarPark,
  generateLot,
  carParkTierAt,
  isLotCleared,
  leave,
  lotFor,
  solve,
  starsFor,
  towVehicle,
  type CarParkLot,
} from "../src/game/business/carPark.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const art = path.resolve(import.meta.dirname, "../public/business/carpark");
const SEEDS = Number(process.env.CARPARK_QA_SEEDS ?? 500);

function chainOf(lot: CarParkLot): number {
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const deps = blockersFor(
      lot,
      lot.vehicles.find((v) => v.id === id)!,
    );
    const d = deps.length ? Math.max(...deps.map((x) => depth(x) + 1)) : 0;
    memo.set(id, d);
    return d;
  };
  return Math.max(0, ...lot.vehicles.map((v) => depth(v.id)));
}

console.log("A. Every lot is solvable, and as hard as its tier");
{
  const levels = CAR_PARK_TIERS.map((t) => t.from);
  assert(
    levels[0] === CAR_PARK_FIRST_LEVEL,
    "A0: the first tier starts at the first Car Park level",
  );
  for (const level of levels) {
    const tier = CAR_PARK_TIERS.findLast((t) => t.from <= level)!;
    const bad: string[] = [];
    let slowest = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const t0 = performance.now();
      const lot = generateLot(level, seed);
      slowest = Math.max(slowest, performance.now() - t0);
      const taken = new Set<string>();
      let inBounds = true;
      let overlap = false;
      for (const v of lot.vehicles)
        for (let i = 0; i < v.length; i++) {
          const x = v.axis === "h" ? v.x + i : v.x;
          const y = v.axis === "v" ? v.y + i : v.y;
          if (x < 0 || y < 0 || x >= lot.cols || y >= lot.rows) inBounds = false;
          if (taken.has(`${x},${y}`)) overlap = true;
          taken.add(`${x},${y}`);
        }
      const free = lot.vehicles.filter((v) => blockersFor(lot, v).length === 0).length;
      const why: string[] = [];
      if (solve(lot)?.length !== lot.vehicles.length) why.push("unsolvable");
      if (!inBounds) why.push("out of bounds");
      if (overlap) why.push("overlap");
      if (lot.vehicles.length < tier.minVehicles || lot.vehicles.length > tier.maxVehicles)
        why.push(`count ${lot.vehicles.length}`);
      if (free < tier.minFree || free > tier.maxFree) why.push(`free ${free}`);
      if (chainOf(lot) < tier.chain) why.push(`chain ${chainOf(lot)}`);
      if (!lot.vehicles.some((v) => v.neighbor) || !lot.vehicles.some((v) => !v.neighbor))
        why.push("no neighbour / no guest");
      for (const v of lot.vehicles) {
        const file = `${v.length >= 4 ? "bus" : v.length === 3 ? "van" : "car"}-${v.color}.webp`;
        if (!fs.existsSync(path.join(art, file))) why.push(`no picture ${file}`);
      }
      if (JSON.stringify(lot) !== JSON.stringify(generateLot(level, seed)))
        why.push("not deterministic");
      if (why.length) bad.push(`seed ${seed}: ${why.join(", ")}`);
    }
    assert(
      bad.length === 0,
      `A${level}: ${SEEDS} lots at Level ${level} (${tier.cols}x${tier.rows}) are solvable, in bounds, in the vehicle range and hard enough (${bad.length} bad); slowest ${Math.round(slowest)} ms`,
      bad.slice(0, 5),
    );
    assert(slowest < 800, `A${level}t: a lot builds in well under a second`, slowest);
  }
  const lots = new Set(
    Array.from({ length: 40 }, (_, s) =>
      JSON.stringify(
        generateLot(32, s + 1).vehicles.map((v) => [v.x, v.y, v.length, v.axis, v.dir]),
      ),
    ),
  );
  assert(lots.size >= 38, "A9: different seeds are different lots, not mirrored copies", lots.size);
}

// RULE CHANGE (developer 2026-11-19: every mini-game climbs level by level like the rest, `difficultyRamp.ts`): vehicles, free vehicles and the chain
// move from one tier's values to the next tier's between their first levels.
console.log("A+. The ramp between tiers");
{
  const bad: string[] = [];
  for (const t of CAR_PARK_TIERS) {
    const at = carParkTierAt(t.from);
    if (
      at.minVehicles !== t.minVehicles ||
      at.maxVehicles !== t.maxVehicles ||
      at.minFree !== t.minFree ||
      at.maxFree !== t.maxFree ||
      at.chain !== t.chain
    )
      bad.push(`tier ${t.from} is not its own on its first level`);
  }
  let prev: ReturnType<typeof carParkTierAt> | null = null;
  const steps = Math.max(6, Math.floor(SEEDS / 50)); // 10 lots a level at the default 500 seeds
  for (let level = 15; level <= 91; level++) {
    const t = carParkTierAt(level);
    if (
      prev &&
      (t.minVehicles < prev.minVehicles ||
        t.maxVehicles < prev.maxVehicles ||
        t.minFree > prev.minFree ||
        t.maxFree > prev.maxFree ||
        t.chain < prev.chain)
    )
      bad.push(`level ${level} is easier than level ${level - 1}`);
    prev = t;
    for (let seed = 1; seed <= steps; seed++) {
      const lot = generateLot(level, seed);
      const free = lot.vehicles.filter((v) => blockersFor(lot, v).length === 0).length;
      if (
        solve(lot)?.length !== lot.vehicles.length ||
        lot.vehicles.length < t.minVehicles ||
        lot.vehicles.length > t.maxVehicles ||
        free < t.minFree ||
        free > t.maxFree ||
        chainOf(lot) < t.chain
      )
        bad.push(
          `level ${level} seed ${seed}: ${lot.vehicles.length} vehicles, ${free} free, chain ${chainOf(lot)}`,
        );
    }
  }
  assert(
    bad.length === 0,
    "A10: every level 15-91 builds solvable lots that meet the ramped numbers, and no level is easier than the one before",
    bad.slice(0, 5),
  );
  assert(
    new Set([15, 17, 19, 21].map((l) => carParkTierAt(l).maxVehicles)).size >= 3,
    "A11: Levels 15-21 really climb (it was one lot of 5-6 vehicles)",
  );
}

console.log("B. The moves");
{
  const lot = generateLot(22, 1);
  const blocked = lot.vehicles.find((v) => !canLeave(lot, v.id))!;
  const free = lot.vehicles.find((v) => canLeave(lot, v.id))!;
  assert(!!blocked && !!free, "B1: a lot has a blocked vehicle and a free one");
  assert(
    leave(lot, blocked.id) === lot,
    "B2: a blocked vehicle does not leave (the lot is unchanged)",
  );
  assert(
    leave(lot, free.id).vehicles.length === lot.vehicles.length - 1,
    "B3: a free vehicle drives out",
  );
  const towed = towVehicle(lot, blocked.id);
  assert(
    towed.vehicles.length === lot.vehicles.length - 1 && solve(towed) !== null,
    "B4: a tow removes a blocked vehicle and the lot stays solvable",
  );
  assert(
    towVehicle(lot, "nope").vehicles.length === lot.vehicles.length,
    "B5: a tow of nothing changes nothing",
  );
  let cleared = lot;
  for (const id of solve(lot)!) cleared = leave(cleared, id);
  assert(isLotCleared(cleared), "B6: playing the solver's order clears the lot");
}

console.log("C. Stars");
{
  assert(CAR_PARK_STRIKES === 3, "C0: three strikes");
  assert(
    starsFor(0, false) === 3 &&
      starsFor(1, false) === 2 &&
      starsFor(2, false) === 1 &&
      starsFor(3, false) === 0,
    "C1: no honk 3 stars, one 2, two 1, three honks 0",
  );
  assert(
    starsFor(0, true) === 2 && starsFor(1, true) === 1 && starsFor(2, true) === 1,
    "C2: a tow costs one star but a cleared lot keeps one",
  );
}

console.log("D. The routine and the save");
{
  const save = (day: number, extra = {}) => ({
    ...DEFAULT_SAVE,
    business: {
      ...DEFAULT_SAVE.business,
      calendar: { ...DEFAULT_SAVE.business.calendar, businessDay: day },
      ...extra,
    },
  });
  assert(
    !flowSteps(save(3), CAR_PARK_FIRST_LEVEL - 1).some((s) => s.id === "carpark"),
    "D1: locked below Level 15",
  );
  const steps = flowSteps(save(3), CAR_PARK_FIRST_LEVEL);
  assert(
    steps.at(-1)?.id === "carpark" && steps.at(-1)?.to === "car-park",
    "D2: the last step of the opening routine, and it opens the Car Park",
    steps.map((s) => s.id),
  );
  const done = finishCarPark(save(3), 15, 0, false, 3);
  assert(
    !flowSteps(done, 15).some((s) => s.id === "carpark") && !carParkDue(done, 15),
    "D3: once a business day",
  );
  assert(
    carParkDue(save(4, { carPark: { doneDay: 3 } }), 15),
    "D4: due again the next business day",
  );
  assert(
    done.credits === DEFAULT_SAVE.credits &&
      done.business.inventory === DEFAULT_SAVE.business.inventory,
    "D5: a round moves no money and no stock",
  );
  assert(
    (done.economyLedger?.length ?? 0) === (DEFAULT_SAVE.economyLedger?.length ?? 0),
    "D6: no ledger entry",
  );
  const auto = autoCarPark(save(3));
  assert(
    auto.business.carPark?.doneDay === 3 && !auto.business.carPark?.stars,
    "D7: the Prep Cook ends the step with no stars",
  );
  const hired = save(3, {
    staff: {
      ...DEFAULT_SAVE.business.staff,
      hiredRoles: [...DEFAULT_SAVE.business.staff.hiredRoles, "prep-cook"],
    },
  });
  assert(
    !canPrepCookClearCarPark(save(3), 40) &&
      !canPrepCookClearCarPark(hired, CAR_PARK_PREP_COOK_LEVEL - 1) &&
      canPrepCookClearCarPark(hired, CAR_PARK_PREP_COOK_LEVEL),
    "D8: the Prep Cook needs a hire and Level 30",
  );
  assert(PREP_COOK_STEPS.includes("carpark"), "D9: the Prep Cook's step list knows the Car Park");
  assert(
    lotFor(save(3), 22).vehicles.length > 0 &&
      JSON.stringify(lotFor(save(3), 22)) === JSON.stringify(lotFor(save(3), 22)),
    "D10: today's lot is the same every time it is asked for",
  );
}

console.log(failures ? `\nCAR PARK QA: ${failures} FAILURE(S)` : "\nCAR PARK QA: ALL PASS");
process.exit(failures ? 1 : 0);
