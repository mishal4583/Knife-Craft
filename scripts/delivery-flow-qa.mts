/**
 * DELIVERY FLOW QA (developer 2026-11-11): "receive the delivery, check for damaged product, unpack, sort to the fridge, then the Fridge Check;
 * every mini-game mandatory and in its right order" (business/deliveryFlow.ts).
 *   A the steps: which wait, in which order, what is locked
 *   B the check (Delivery Inspection) is mandatory: counted past the daily rewarded limit, and a basket unpacked does not make the next one "checked"
 *   C the service gate: nothing opens while a step waits, a Prep Cook step clears it
 *   D wiring: App gates the service and sends Unpack to the check, the Inventory shows the routine at the top, the chips agree
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SAVE, type SaveData } from "../src/game/SaveManager.ts";
import { INGREDIENTS } from "../src/game/definitions.ts";
import {
  basketsLeft,
  fridgeSortOf,
  roundFor as sortRound,
  autoPutAway,
} from "../src/game/business/fridgeSort.ts";
import {
  INSPECTION_FIRST_LEVEL,
  MAX_ROUNDS_PER_DAY,
  autoInspect,
  finishRound as finishInspection,
  pendingInspections,
  roundsLeft,
  shiftInspected,
} from "../src/game/business/deliveryInspection.ts";
import { addToSupplyCrate } from "../src/game/business/stockroomSort.ts";
import { SUPPLY_CATALOG } from "../src/game/business/businessSupplies.ts";
import { isFridgeCheckOpen } from "../src/game/restaurant/fridgeCheck.ts";
import { SAUCE_REQUIRED_FROM, coverSauceToday } from "../src/game/business/sauceStation.ts";
import {
  SKIPS_PER_DAY,
  flowSteps,
  serviceGate,
  skipsLeft,
  unpackLocked,
  withSkipUsed,
} from "../src/game/business/deliveryFlow.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const PRODUCE = Object.keys(INGREDIENTS).filter((id) =>
  ["Fruit", "Vegetable", "Aromatic", "Herb"].includes(
    (INGREDIENTS as Record<string, { category: string }>)[id]!.category,
  ),
);
function deliverySave(ingredients: string[], level = 3): SaveData {
  const s = structuredClone(DEFAULT_SAVE) as SaveData;
  s.business = {
    ...s.business,
    fridgeSort: { crate: ingredients, counts: {}, seed: 1 },
  } as SaveData["business"];
  void level;
  return s;
}
const ONE = deliverySave(["tomato", "carrot"]);
const MANY = deliverySave(PRODUCE.slice(0, 24));

console.log("A. The steps");
{
  const none = structuredClone(DEFAULT_SAVE) as SaveData;
  assert(
    flowSteps(none, 9).length === 0 && serviceGate(none, 9).open,
    "A1: nothing waits = no steps, the service opens (Level 9: the Sauce Station is a duty from Level 10)",
  );
  // Rule added 2026-11-11 ("Sauce Station and Fridge Check are still not mandatory"): from Level 10 one Sauce round a day is a step of the routine.
  const sauceDay = flowSteps(none, 12).find((x) => x.id === "sauce");
  assert(
    SAUCE_REQUIRED_FROM === 10 &&
      flowSteps(none, 9).every((x) => x.id !== "sauce") &&
      sauceDay?.n === 5 &&
      !sauceDay.lockedBy &&
      !serviceGate(none, 12).open,
    "A1b: from Level 10 'Make today's sauce' is step 5 and holds the service until it is done",
  );
  const covered = coverSauceToday(none);
  assert(
    flowSteps(covered, 12).every((x) => x.id !== "sauce") &&
      serviceGate(covered, 12).open &&
      covered.credits === none.credits &&
      covered.economyLedger.length === none.economyLedger.length &&
      flowSteps(withSkipUsed(none), 12).some((x) => x.id === "sauce"),
    "A1c: the Prep Cook / the ad skip meets the day's duty (no money, no ledger); a skip used alone does not",
  );
  let used = none;
  for (let i = 0; i < SKIPS_PER_DAY; i++) used = withSkipUsed(used);
  assert(
    skipsLeft(none) === SKIPS_PER_DAY &&
      skipsLeft(used) === 0 &&
      skipsLeft(withSkipUsed(none)) === SKIPS_PER_DAY - 1,
    "A1d: the rewarded skip has a daily cap (3) that is counted per business day",
  );
  assert(INSPECTION_FIRST_LEVEL === 3, "A2: the check opens with the first delivery, Level 3");
  assert(flowSteps(ONE, 2).length === 0, "A3: before Level 3 there is no routine");
  // Level 3 (the delivery check opens, Fridge Sort does not yet): only the check waits; the crate is there, the sorting game is a level away.
  assert(
    flowSteps(ONE, 3)
      .map((s) => s.id)
      .join() === "inspect" && !sortRound(ONE, 3),
    "A3b: at Level 3 only the delivery check waits (Fridge Sort opens at Level 4, developer 2026-11-11)",
    flowSteps(ONE, 3).map((s) => s.id),
  );
  const steps = flowSteps(ONE, 4);
  assert(
    steps.map((s) => s.id).join() === "inspect,unpack" && steps[0]!.n === 1 && steps[1]!.n === 2,
    "A4: a delivery waits: first CHECK it, then UNPACK it",
    steps.map((s) => s.id),
  );
  assert(
    steps[0]!.lockedBy === null &&
      steps[1]!.lockedBy === "Check the delivery first" &&
      unpackLocked(ONE, 4),
    "A5: Unpack is locked until the check is done",
  );
  const checked = autoInspect(ONE);
  const after = flowSteps(checked, 4);
  assert(
    pendingInspections(checked, 4) === 0 &&
      after.map((s) => s.id).join() === "unpack" &&
      after[0]!.lockedBy === null &&
      !unpackLocked(checked, 4),
    "A6: once every basket is checked, Unpack opens",
    after,
  );
  assert(
    !!sortRound(ONE, 4) === true && serviceGate(ONE, 4).next?.id === "inspect",
    "A7: the gate points at the check first",
  );
}

console.log("B. The check is mandatory");
{
  const baskets = basketsLeft(MANY, 4);
  assert(
    baskets > MAX_ROUNDS_PER_DAY,
    `B1: a big delivery has more baskets (${baskets}) than today's ${MAX_ROUNDS_PER_DAY} rewarded rounds`,
  );
  let s = MANY;
  let rewarded = 0;
  while (roundsLeft(s, 4) > 0 && rewarded < 20) {
    s = finishInspection(s, { stars: 2, score: 500, found: 2, total: 2 }).save;
    rewarded++;
  }
  const rest = pendingInspections(s, 4);
  assert(
    roundsLeft(s, 4) === 0 && rest > 0,
    "B2: after the rewarded rounds some baskets still wait for their check",
    { rewarded, rest },
  );
  const rewardsBefore = JSON.stringify([
    s.business.deliveryInspection?.stars,
    s.business.deliveryInspection?.rounds,
  ]);
  let t = s;
  let free = 0;
  while (pendingInspections(t, 4) > 0 && free < 30) {
    t = finishInspection(t, {
      stars: 3,
      score: 900,
      found: 2,
      total: 2,
      practice: true,
      counts: true,
    }).save;
    free++;
  }
  assert(
    pendingInspections(t, 4) === 0 &&
      JSON.stringify([
        t.business.deliveryInspection?.stars,
        t.business.deliveryInspection?.rounds,
      ]) === rewardsBefore,
    "B3: the free rounds past the limit still count as the check but give no stars and no rounds",
    { free },
  );
  const idle = finishInspection(s, { stars: 3, score: 900, found: 2, total: 2, practice: true });
  assert(
    idle.save === s && pendingInspections(idle.save, 4) === rest,
    "B4: a plain practice round (no 'counts') changes nothing",
  );
  // Unpacking a basket must not make the NEXT basket look checked.
  let u = autoInspect(autoInspect(deliverySave(PRODUCE.slice(0, 24))));
  const before = u;
  const need = pendingInspections(u, 4);
  // One basket leaves the crate (what Fridge Sort does when its round is finished); autoPutAway would empty the whole delivery.
  const firstBasket = sortRound(before, 4)!.ingredients;
  const unpacked = structuredClone(before);
  unpacked.business.fridgeSort = {
    ...unpacked.business.fridgeSort,
    crate: (before.business.fridgeSort!.crate ?? []).filter(
      (id) => !firstBasket.includes(id as never),
    ),
  } as never;
  const shifted = shiftInspected(before, unpacked, 4);
  const gone = basketsLeft(before, 4) - basketsLeft(unpacked, 4);
  assert(
    gone === 1 &&
      pendingInspections(unpacked, 4) === basketsLeft(unpacked, 4) - 2 &&
      pendingInspections(shifted, 4) === basketsLeft(unpacked, 4) - 1,
    "B5: after a basket is unpacked the checked count drops with it (2 checked, 1 unpacked: 1 checked is left, so the next basket is NOT counted as checked)",
    {
      need,
      gone,
      pendingNoShift: pendingInspections(unpacked, 4),
      pendingShift: pendingInspections(shifted, 4),
      left: basketsLeft(unpacked, 4),
    },
  );
  void u;
  u = deliverySave(["tomato", "carrot"]);
  assert(shiftInspected(u, u, 4) === u, "B6: nothing unpacked = nothing shifts");
  assert(fridgeSortOf(ONE).crate?.length === 2, "B7: (control) the test crate is what it says");
}

console.log("C. The service gate");
{
  const g = serviceGate(ONE, 4);
  assert(!g.open && g.steps.length === 2, "C1: a delivery waiting blocks the service");
  const afterCheck = serviceGate(autoInspect(ONE), 4);
  assert(
    !afterCheck.open && afterCheck.next?.id === "unpack",
    "C2: checked but not unpacked still blocks, pointing at Unpack",
  );
  const done = autoPutAway(autoInspect(ONE));
  assert(
    serviceGate(done, 4).open,
    "C3: checked and unpacked: the service opens",
    flowSteps(done, 4),
  );
  assert(serviceGate(ONE, 2).open, "C4: before the games exist the service is never blocked");
}

console.log("C2. The shelves and the Fridge Check join the routine");
{
  const L = 20;
  const supplies = addToSupplyCrate(
    structuredClone(DEFAULT_SAVE) as SaveData,
    [{ id: SUPPLY_CATALOG[0]!.id, packs: 3 }],
    L,
  );
  const sh = flowSteps(supplies, L);
  assert(
    sh.some((x) => x.id === "shelves") && !serviceGate(supplies, L).open,
    "C5: supplies waiting for the shelves block the service (inventory sorting is mandatory too)",
    sh.map((x) => x.id),
  );
  assert(
    flowSteps(supplies, 5).every((x) => x.id !== "shelves"),
    "C5b: before the game opens (Level 6) there is no shelves step",
  );
  // A night with spoiled stock and the closing chore open: the Fridge Check is a step. The same chore with nothing to judge is not.
  const night = structuredClone(DEFAULT_SAVE) as SaveData;
  night.business.calendar = { businessDay: 40 };
  night.business.inventory = {
    salmon: { ingredientId: "salmon", quantity: 2, unitCost: 300, purchaseDay: 38 },
    tomato: { ingredientId: "tomato", quantity: 2, unitCost: 300, purchaseDay: 35 },
    bread: { ingredientId: "bread", quantity: 2, unitCost: 300, purchaseDay: 40 },
  } as never;
  const chore = (save: SaveData): SaveData => ({
    ...save,
    business: {
      ...save.business,
      cleanliness: { tasks: [{ kind: "spoiled-out", count: 1, since: 40 }] } as never,
    },
  });
  const withChore = chore(night);
  assert(
    isFridgeCheckOpen(withChore, 60, "spoiled-out") &&
      flowSteps(withChore, 60).some((x) => x.id === "fridge-check"),
    "C6: the closing 'throw out spoiled food' chore, when the game replaces it, is the Fridge Check step",
    flowSteps(withChore, 60).map((x) => x.id),
  );
  assert(
    flowSteps(chore(structuredClone(DEFAULT_SAVE) as SaveData), 60).some(
      (x) => x.id === "fridge-check",
    ),
    "C7: with nothing in the fridge the Fridge Check is still a step (a training deck, 2026-11-11); the ad skip or the Prep Cook clears it",
  );
  assert(
    flowSteps(withChore, 5).every((x) => x.id !== "fridge-check"),
    "C8: before freshness exists (Level 10) there is no Fridge Check step",
  );
}

console.log("D. Wiring");
{
  const app = read("src/App.tsx");
  assert(
    /const gate = serviceGate\(save, restaurantLevelOf\(save\.levelProgress\)\)/.test(app) &&
      /if \(!gate\.open\)/.test(app),
    "D1: App.onSelectLevel stops the service while the routine is not done",
  );
  assert(
    /if \(firstPlay\)/.test(app),
    "D2: only a service that is not done yet is gated (a replay is not)",
  );
  assert(
    /gateHoldRef\.current/.test(app) && /s = "delivery-inspection"/.test(app),
    "D3: go('gameplay') waits while the sheet is open; Unpack sends the player to the check first",
  );
  assert(
    /shiftInspected\(current, out\.save, level\)/.test(app) &&
      /shiftInspected\(current, autoPutAway\(current\), level\)/.test(app),
    "D4: unpacking shifts the checked count (both the game and the Prep Cook)",
  );
  const inv = read("src/components/kc/inventory/InventoryScreen.tsx");
  assert(
    /<DeliveryRoutineCard/.test(inv) &&
      inv.indexOf("<DeliveryRoutineCard") < inv.indexOf("<RestaurantAttentionPanel"),
    "D5: the routine is at the TOP of the Inventory",
  );
  const chip = read("src/components/kc/inventory/FridgeSortChip.tsx");
  assert(
    /unpackLocked/.test(chip) && /Fridge Sort/.test(chip),
    "D6: the Unpack chip is locked while baskets wait for their check",
  );
  const comp = read("src/components/kc/business/DeliveryRoutine.tsx");
  assert(
    /data-testid="service-gate"/.test(comp) &&
      /data-testid="gate-go"/.test(comp) &&
      /Prep Cook/.test(comp),
    "D7: the sheet lists the steps, one button to the next, and mentions the Prep Cook",
  );
  const appSrc = read("src/App.tsx");
  assert(
    /flow-skip-/.test(comp) &&
      /AD_PLACEMENT\.skipStep/.test(appSrc) &&
      /status !== "rewarded"\) return "no"/.test(appSrc) &&
      /skip_step/.test(read("public/playgama-bridge-config.json")) &&
      /skipsLeft\(latest\) === 0/.test(appSrc),
    "D9: the rewarded skip: a button per next step, one placement (skip_step, in the Bridge config), granted only on `rewarded`, capped per day",
  );
  const rules = read("src/game/business/deliveryFlow.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(
    !/credits|economyLedger|Math\.random|inventory\[/.test(rules),
    "D8: the routine moves no money or stock",
  );
}

console.log(
  failures === 0 ? "\nDELIVERY FLOW QA: ALL PASS" : `\nDELIVERY FLOW QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
