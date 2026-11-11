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
import { flowSteps, serviceGate, unpackLocked } from "../src/game/business/deliveryFlow.ts";

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
    flowSteps(none, 12).length === 0 && serviceGate(none, 12).open,
    "A1: nothing waits = no steps, the service opens",
  );
  assert(INSPECTION_FIRST_LEVEL === 3, "A2: the check opens with the first delivery, Level 3");
  assert(flowSteps(ONE, 2).length === 0, "A3: before Level 3 there is no routine");
  const steps = flowSteps(ONE, 3);
  assert(
    steps.map((s) => s.id).join() === "inspect,unpack" && steps[0]!.n === 1 && steps[1]!.n === 2,
    "A4: a delivery waits: first CHECK it, then UNPACK it",
    steps.map((s) => s.id),
  );
  assert(
    steps[0]!.lockedBy === null &&
      steps[1]!.lockedBy === "Check the delivery first" &&
      unpackLocked(ONE, 3),
    "A5: Unpack is locked until the check is done",
  );
  const checked = autoInspect(ONE);
  const after = flowSteps(checked, 3);
  assert(
    pendingInspections(checked, 3) === 0 &&
      after.map((s) => s.id).join() === "unpack" &&
      after[0]!.lockedBy === null &&
      !unpackLocked(checked, 3),
    "A6: once every basket is checked, Unpack opens",
    after,
  );
  assert(
    !!sortRound(ONE, 3) === true && serviceGate(ONE, 3).next?.id === "inspect",
    "A7: the gate points at the check first",
  );
}

console.log("B. The check is mandatory");
{
  const baskets = basketsLeft(MANY, 3);
  assert(
    baskets > MAX_ROUNDS_PER_DAY,
    `B1: a big delivery has more baskets (${baskets}) than today's ${MAX_ROUNDS_PER_DAY} rewarded rounds`,
  );
  let s = MANY;
  let rewarded = 0;
  while (roundsLeft(s, 3) > 0 && rewarded < 20) {
    s = finishInspection(s, { stars: 2, score: 500, found: 2, total: 2 }).save;
    rewarded++;
  }
  const rest = pendingInspections(s, 3);
  assert(
    roundsLeft(s, 3) === 0 && rest > 0,
    "B2: after the rewarded rounds some baskets still wait for their check",
    { rewarded, rest },
  );
  const rewardsBefore = JSON.stringify([
    s.business.deliveryInspection?.stars,
    s.business.deliveryInspection?.rounds,
  ]);
  let t = s;
  let free = 0;
  while (pendingInspections(t, 3) > 0 && free < 30) {
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
    pendingInspections(t, 3) === 0 &&
      JSON.stringify([
        t.business.deliveryInspection?.stars,
        t.business.deliveryInspection?.rounds,
      ]) === rewardsBefore,
    "B3: the free rounds past the limit still count as the check but give no stars and no rounds",
    { free },
  );
  const idle = finishInspection(s, { stars: 3, score: 900, found: 2, total: 2, practice: true });
  assert(
    idle.save === s && pendingInspections(idle.save, 3) === rest,
    "B4: a plain practice round (no 'counts') changes nothing",
  );
  // Unpacking a basket must not make the NEXT basket look checked.
  let u = autoInspect(autoInspect(deliverySave(PRODUCE.slice(0, 24))));
  const before = u;
  const need = pendingInspections(u, 3);
  // One basket leaves the crate (what Fridge Sort does when its round is finished); autoPutAway would empty the whole delivery.
  const firstBasket = sortRound(before, 3)!.ingredients;
  const unpacked = structuredClone(before);
  unpacked.business.fridgeSort = {
    ...unpacked.business.fridgeSort,
    crate: (before.business.fridgeSort!.crate ?? []).filter(
      (id) => !firstBasket.includes(id as never),
    ),
  } as never;
  const shifted = shiftInspected(before, unpacked, 3);
  const gone = basketsLeft(before, 3) - basketsLeft(unpacked, 3);
  assert(
    gone === 1 &&
      pendingInspections(unpacked, 3) === basketsLeft(unpacked, 3) - 2 &&
      pendingInspections(shifted, 3) === basketsLeft(unpacked, 3) - 1,
    "B5: after a basket is unpacked the checked count drops with it (2 checked, 1 unpacked: 1 checked is left, so the next basket is NOT counted as checked)",
    {
      need,
      gone,
      pendingNoShift: pendingInspections(unpacked, 3),
      pendingShift: pendingInspections(shifted, 3),
      left: basketsLeft(unpacked, 3),
    },
  );
  void u;
  u = deliverySave(["tomato", "carrot"]);
  assert(shiftInspected(u, u, 3) === u, "B6: nothing unpacked = nothing shifts");
  assert(fridgeSortOf(ONE).crate?.length === 2, "B7: (control) the test crate is what it says");
}

console.log("C. The service gate");
{
  const g = serviceGate(ONE, 3);
  assert(!g.open && g.steps.length === 2, "C1: a delivery waiting blocks the service");
  const afterCheck = serviceGate(autoInspect(ONE), 3);
  assert(
    !afterCheck.open && afterCheck.next?.id === "unpack",
    "C2: checked but not unpacked still blocks, pointing at Unpack",
  );
  const done = autoPutAway(autoInspect(ONE));
  assert(
    serviceGate(done, 3).open,
    "C3: checked and unpacked: the service opens",
    flowSteps(done, 3),
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
    flowSteps(chore(structuredClone(DEFAULT_SAVE) as SaveData), 60).every(
      (x) => x.id !== "fridge-check",
    ),
    "C7: with nothing in the fridge to judge the chore stays one tap and blocks nothing",
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
